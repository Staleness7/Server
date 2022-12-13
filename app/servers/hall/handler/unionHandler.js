let code = require('../../../constant/code');
let commonDao = require('../../../dao/commonDao');
let userDao = require('../../../dao/userDao');
let userInfoServices = require('../../../services/userInfoServices');
let utils = require('../../../util/utils');
let logger = require('pomelo-logger').getLogger("logic");
let enumeration = require('../../../constant/enumeration');

let DAY_MS = 24 * 60 * 60 * 1000;
let WEEK_MS = 7 * DAY_MS;

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

// 创建联盟
Handler.prototype.createUnion = async function(msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    // 判断参数是否有效
    let unionName = msg.unionName;
    if (!unionName || unionName.length > 20){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }

    // 查询是否有创建联盟的资格
    let userData = await userDao.getUserDataByUid(session.uid);
    if (!userData.isAgent){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 判断是否达到最大联盟数量
    let unionConfig = JSON.parse(this.app.get('config')['unionConfig'] || '{}');
    let userMaxUnionCount = unionConfig['userMaxUnionCount'] || 20;
    if (userData.unionInfo.length >= userMaxUnionCount){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 判断是否已经创建过牌友圈，如果已经创建过，则无法重复创建
    let union = await commonDao.findOneData('unionModel', {ownerUid: session.uid});
    if (!!union){
        next(null, {code: code.ALREADY_CREATED_UNION});
        return;
    }
    // 创建联盟
    let saveUnionData = {
        ownerUid: session.uid,
        ownerNickname: userData.nickname,
        ownerAvatar: userData.avatar,
        unionName: unionName,
        curMember: 1,
        createTime: Date.now()
    };
    let unionData = await commonDao.createData("unionModel", saveUnionData);
    if (!unionData){
        next(null, {code: code.SQL_ERROR});
        return;
    }
    // 更新用户信息
    let unionInfo = {
        unionID: unionData.unionID,
        partner: true,
        rebateRate: 1,
        joinTime: Date.now()
    };
    let uniqueIDData = await commonDao.findOneAndUpdateEx("uniqueIDModel", {key: 1}, {$inc: {unionInviteID: 7}}, {new: true, upsert: true});
    unionInfo.inviteID = uniqueIDData.unionInviteID;
    let newUserData = await userDao.updateUserDataByUid(session.uid, {$addToSet: {unionInfo: unionInfo}});
    next(null, {code: code.OK, updateUserData: {unionInfo: newUserData.unionInfo}, msg: {unionID: unionData.unionID}});
};

// 加入联盟
Handler.prototype.joinUnion = async function(msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    let inviteID = parseInt(msg.inviteID || "0");
    if (!inviteID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询邀请玩家信息
    let inviteUserData = await userDao.getUserData({"unionInfo.inviteID": inviteID});
    if (!inviteUserData){
        next(null, {code: code.INVITE_ID_ERROR});
        return;
    }
    let inviteUnionInfo = inviteUserData.unionInfo.find(function (ele) {
        return ele.inviteID === inviteID;
    });
    if (!inviteUnionInfo){
        next(null, {code: code.INVITE_ID_ERROR});
        return;
    }
    // 联盟信息
    let unionData = await commonDao.findOneData('unionModel', {unionID: inviteUnionInfo.unionID});
    if (!unionData){
        next(null, {code: code.UNION_NOT_EXIST});
        return;
    }
    // 检查邀请权限
    if (!!unionData.forbidInvite && session.uid !== unionData.ownerUid){
        next(null, {code: code.FORBID_INVITE_SCORE});
        return;
    }
    // 玩家信息
    let userData = await userDao.getUserData({uid: session.uid});
    for (let i = 0; i < userData.unionInfo.length; ++i){
        let info = userData.unionInfo[i];
        if (info.unionID === inviteUnionInfo.unionID){
            next(null, {code: code.ALREADY_IN_UNION});
            return;
        }
    }
    // 更新联盟数据
    await await commonDao.updateData('unionModel', {unionID: inviteUnionInfo.unionID}, {$inc: {curMember: 1}});
    // 修改用户数据
    let addUnionInfo = {
        spreaderID: inviteUserData.uid,
        unionID: inviteUnionInfo.unionID,
        joinTime: Date.now()
    };
    let uniqueIDData = await commonDao.findOneAndUpdateEx("uniqueIDModel", {key: 1}, {$inc: {unionInviteID: 7}}, {new: true, upsert: true});
    addUnionInfo.inviteID = uniqueIDData.unionInviteID;
    let newUserData = await userDao.updateUserDataByUid(session.uid, {$push: {unionInfo: addUnionInfo}});
    next(null, {code: code.OK, updateUserData: {unionInfo: newUserData.unionInfo}, msg: {unionID: inviteUnionInfo.unionID}});
};

// 退出联盟
Handler.prototype.exitUnion = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询联盟数据
    let unionData = await commonDao.findOneData("unionModel", {unionID: msg.unionID});
    if (!unionData){
        let newUserData = await userDao.updateUserDataByUid(session.uid, {$push: {unionInfo: {unionID: msg.unionID}}});
        next(null, {code: code.OK, updateUserData: {unionInfo: newUserData.unionInfo}});
        return;
    }
    // 盟主不能退出联盟，必须将联盟转移给他认之后
    if (unionData.ownerUid === session.uid){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询用户数据
    let userData = await userDao.getUserData({uid: session.uid, "unionInfo.unionID": msg.unionID});
    if (!userData){
        next(null, {code: code.OK});
        return;
    }
    // 查询俱乐部信息
    let unionInfoItem = null;
    for (let i = 0; i < userData.unionInfo.length; ++i){
        if (userData.unionInfo[i].unionID === msg.unionID){
            unionInfoItem = userData.unionInfo[i];
            break;
        }
    }
    if (!unionInfoItem){
        next(null, {code: code.OK});
        return;
    }
    // 删除联盟数据
    let newUserData = await userDao.updateUserDataByUid(session.uid, {$pull:{unionInfo: {unionID: msg.unionID}}});
    // 将下级用户转移给上级玩家
    await commonDao.updateAllData("userModel", {unionInfo: {$elemMatch: {spreaderID: session.uid, unionID: msg.unionID}}}, {"unionInfo.$.spreaderID": unionInfoItem.spreaderID});
    // 更新俱乐部人数
    commonDao.updateData("unionModel", {unionID: msg.unionID}, {$inc: {curMember: -1}}).catch(e=>{logger.error(e.stack)});
    next(null, {code: code.OK, updateUserData: {unionInfo: newUserData.unionInfo}});
};

// 获取用户联盟列表
Handler.prototype.getUserUnionList = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    // 获取用户信息
    let userData = await userDao.getUserDataByUid(session.uid);
    let unionIDList = [];
    for (let i = 0; i < userData.unionInfo.length; ++i){
        unionIDList.push(userData.unionInfo[i].unionID);
    }
    if (unionIDList.length === 0){
        next(null, {code: code.OK, msg: {recordArr: []}});
        return;
    }
    let dataArr = await commonDao.findData("unionModel", {unionID: {$in: unionIDList}});
    let recordArr = [];
    for(let i = 0; i < dataArr.length; ++i){
        let data = dataArr[i];
        recordArr.push({
            unionID: data.unionID,
            unionName: data.unionName,
            ownerUid: data.ownerUid,
            ownerAvatar: data.ownerAvatar,
            ownerNickname: data.ownerNickname,
            memberCount: data.curMember,
            onlineCount: data.onlineMember
        })
    }
    next(null, {code: code.OK, msg: {recordArr: recordArr}});
};

// 获取成员列表
Handler.prototype.getMemberList = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let res = await commonDao.findDataAndCount('userModel', msg.startIndex || 0, msg.count || 20, {roomID: -1, frontendId: -1, "unionInfo.score": -1}, msg.matchData);
    let recordArr = [];
    for (let i = 0; i < res.recordArr.length; ++i){
        let userData = res.recordArr[i];
        let score = 0;
        let safeScore = 0;
        let unionInfoItem = userData.unionInfo.find(function (ele) {
            return ele.unionID === msg.unionID;
        });
        for (let j = 0; j < userData.unionInfo.length; ++j){
            if (userData.unionInfo[j].unionID === msg.unionID){
                score = userData.unionInfo[j].score;
                safeScore = userData.unionInfo[j].safeScore;
            }
        }
        recordArr.push({
            uid: userData.uid,
            nickname: userData.nickname,
            avatar: userData.avatar,
            frontendId: userData.frontendId,
            roomID: userData.roomID,
            spreaderID: unionInfoItem.spreaderID,
            score: unionInfoItem.score,
            safeScore: unionInfoItem.safeScore,
            prohibitGame: unionInfoItem.prohibitGame,

            yesterdayDraw: unionInfoItem.yesterdayDraw,
            yesterdayBigWinDraw: unionInfoItem.yesterdayBigWinDraw,
            yesterdayRebate: unionInfoItem.yesterdayRebate,
            todayRebate: unionInfoItem.todayRebate,

            memberYesterdayDraw: unionInfoItem.memberYesterdayDraw,
            memberYesterdayBigWinDraw: unionInfoItem.memberYesterdayBigWinDraw,
            yesterdayProvideRebate: unionInfoItem.yesterdayProvideRebate,

            totalDraw: unionInfoItem.totalDraw,
            rebateRate: unionInfoItem.rebateRate
        })
    }
    next(null, {code: code.OK, msg: {recordArr: recordArr, totalCount: res.totalCount}});
};

Handler.prototype.getMemberStatisticsInfo = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }

    let groupData = {_id: null, yesterdayTotalDraw:{$sum: "$unionInfo.yesterdayDraw"}, yesterdayTotalProvideRebate: {$sum: "$unionInfo.yesterdayProvideRebate"}, totalCount: {$sum: 1}};
    let execData = [
        {$unwind:"$unionInfo"},
        {$match: msg.matchData},
        {$group: groupData}
    ];
    let result = await commonDao.getStatisticsInfo('userModel', execData);
    let yesterdayTotalDraw = 0;
    let yesterdayTotalProvideRebate = 0;
    let totalCount = 0;
    if (result.length > 0){
        yesterdayTotalDraw = result[0].yesterdayTotalDraw || 0;
        yesterdayTotalProvideRebate = result[0].yesterdayTotalProvideRebate || 0;
        totalCount = result[0].totalCount;
    }
    next(null, {code: code.OK, msg: {yesterdayTotalDraw: yesterdayTotalDraw, totalCount: totalCount, yesterdayTotalProvideRebate: yesterdayTotalProvideRebate}});
};

// 获取成员列表
Handler.prototype.getMemberScoreList = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let res = await commonDao.findDataAndCount('userModel', msg.startIndex || 0, msg.count || 20, {"unionInfo.score": -1}, msg.matchData);
    let recordArr = [];
    for (let i = 0; i < res.recordArr.length; ++i){
        let userData = res.recordArr[i];
        let unionInfoItem = userData.unionInfo.find(function (ele) {
            return ele.unionID === msg.unionID;
        });
        recordArr.push({
            uid: userData.uid,
            nickname: userData.nickname,
            avatar: userData.avatar,
            score: unionInfoItem.score,
            safeScore: unionInfoItem.safeScore
        })
    }
    let groupData = {_id: null, score:{$sum: "$unionInfo.score"}, safeScore: {$sum: "$unionInfo.safeScore"}};
    let execData = [
        {$unwind:"$unionInfo"},
        {$match: msg.matchData},
        {$group: groupData}
    ];
    let result = await commonDao.getStatisticsInfo('userModel', execData);
    let totalScore = 0;
    if (result.length > 0){
        totalScore = result[0].score + result[0].safeScore;
    }
    next(null, {code: code.OK, msg: {recordArr: recordArr, totalCount: res.totalCount, totalScore: totalScore}});
};

// 保险柜操作
Handler.prototype.safeBoxOperation = async function (msg, session, next) {
    try {
        if (!session.uid){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        if (!msg.unionID || !msg.count || typeof msg.count !== 'number'){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 判断玩家数据是否被锁定
        let userData = await userDao.getUnlockUserDataAndLock(session.uid);
        if (!userData){
            next(null, {code: code.USER_DATA_LOCKED});
            return;
        }
        // 判断玩家是否正在游戏中
        if (!!userData.roomID){
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.USER_IN_ROOM_DATA_LOCKED});
            return;
        }
        let unionInfo = null;
        for (let i = 0; i < userData.unionInfo.length; ++i){
            if (userData.unionInfo[i].unionID === msg.unionID){
                unionInfo = userData.unionInfo[i];
                break;
            }
        }
        if (!unionInfo){
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.USER_IN_ROOM_DATA_LOCKED});
            return;
        }
        // 校验数据,大于0,则是存，小于0则是取
        if ((msg.count > 0 && unionInfo.score < msg.count) || (msg.count < 0 && unionInfo.safeScore < -msg.count)){
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.USER_IN_ROOM_DATA_LOCKED});
            return;
        }
        // 更新数据
        let saveData = {
            $inc:{
                "unionInfo.$.score": -msg.count,
                "unionInfo.$.safeScore": msg.count
            }
        };
        let newUserData = await userDao.updateUserDataAndUnlock({uid: session.uid, "unionInfo.unionID": unionInfo.unionID}, saveData);

        // 存储数据
        let saveRecord = {
            uid: session.uid,
            unionID: msg.unionID,
            count: msg.count,
            createTime: Date.now()
        };
        await commonDao.createData("safeBoxRecordModel", saveRecord);

        // 存储分数变化记录
        let newUnionInfo = newUserData.unionInfo.find(function (e) {
            return e.unionID === msg.unionID;
        });
        let scoreChangeRecord = {
            uid: session.uid,
            nickname: newUserData.nickname,
            unionID: msg.unionID,
            changeCount: -msg.count,
            leftCount: newUnionInfo.score,
            leftSafeBoxCount: newUnionInfo.safeScore,
            changeType: enumeration.scoreChangeType.SAFE_BOX,
            describe: msg.count > 0? ("存入" + msg.count):("取出" + msg.count * -1),
            createTime: Date.now()
        };
        await commonDao.createData("userScoreChangeRecordModel", scoreChangeRecord);

        next(null, {code: code.OK, updateUserData: {unionInfo: newUserData.unionInfo}});
    }catch (e){
        logger.error(e.stack);
        next(null, {code: 500});
    }
};

// 保险箱操作记录
Handler.prototype.safeBoxOperationRecord = async function(msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let matchData = {
        uid: session.uid,
        unionID: msg.unionID,
        createTime: {$gte: Date.now() - WEEK_MS}
    };
    let result = await commonDao.findDataAndCount("safeBoxRecordModel", msg.startIndex || 0, msg.count || 20, {createTime: -1}, matchData);
    next(null, {code: code.OK, msg: result});
};

// 修改积分 count > 0 加分 count < 0 减分
Handler.prototype.modifyScore = async function (msg, session, next) {
    try {
        if (!session.uid) {
            next(null, {code: code.INVALID_UERS});
            return;
        }
        if (!msg.unionID || !msg.count || typeof msg.count !== 'number' || !msg.memberUid || session.uid === msg.memberUid) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询联盟数据
        let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
        if (!unionData) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        if (!!unionData.forbidGive && session.uid !== unionData.ownerUid) {
            next(null, {code: code.FORBID_GIVE_SCORE});
            return;
        }
        // 查询用户数据
        let userData = await userDao.getUnlockUserDataAndLock(session.uid);
        if (!userData) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        if (!!userData.roomID) {
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.USER_IN_ROOM_DATA_LOCKED});
            return;
        }
        // 判断是否在联盟中
        let userUnionInfoItem = null;
        for (let i = 0; i < userData.unionInfo.length; ++i) {
            if (userData.unionInfo[i].unionID === msg.unionID) {
                userUnionInfoItem = userData.unionInfo[i];
                break;
            }
        }
        // 非盟主时需要判断积分是否足够,盟主时不需要判断分数
        if (!userUnionInfoItem || (userUnionInfoItem.score < msg.count && session.uid !== unionData.ownerUid)) {
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询会员数据
        let memberUserData = await userDao.getUnlockUserDataAndLock(msg.memberUid);
        if (!memberUserData) {
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.USER_IN_ROOM_DATA_LOCKED});
            return;
        }
        if (!!memberUserData.roomID && msg.count < 0) {
            await userDao.unlockUserData(msg.memberUid);
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.USER_IN_ROOM_DATA_LOCKED});
            return;
        }
        // 判断是否在联盟中
        let memberUnionInfoItem = null;
        for (let i = 0; i < memberUserData.unionInfo.length; ++i) {
            if (memberUserData.unionInfo[i].unionID === msg.unionID) {
                memberUnionInfoItem = memberUserData.unionInfo[i];
                break;
            }
        }
        if (!memberUnionInfoItem || (memberUnionInfoItem.spreaderID !== session.uid) || memberUnionInfoItem.score < -msg.count) {
            await userDao.unlockUserData(msg.memberUid);
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 修改分数
        let newUserData = null;
        // 非盟主时，需改对应修改分数数量
        if (session.uid !== unionData.ownerUid) {
            newUserData = await userDao.updateUserDataAndUnlock({
                uid: session.uid,
                "unionInfo.unionID": msg.unionID
            }, {$inc: {"unionInfo.$.score": -msg.count}});
        }
        // 盟主时，不需要修改
        else {
            await userDao.unlockUserData(session.uid);
            newUserData = userData;
        }
        let newMemberData = await userDao.updateUserDataAndUnlock({
            uid: msg.memberUid,
            "unionInfo.unionID": msg.unionID
        }, {$inc: {"unionInfo.$.score": msg.count}});
        // 添加修改记录
        let createData = {
            uid: session.uid,
            nickname: userData.nickname,
            avatar: userData.avatar,
            gainUid: msg.memberUid,
            gainNickname: memberUserData.nickname,
            unionID: msg.unionID,
            count: msg.count,
            createTime: Date.now()
        };
        commonDao.createData('scoreModifyRecordModel', createData).catch(e => {
            logger.error(e.stack)
        });
        if (!!newMemberData.frontendId) userInfoServices.updateUserDataNotify(newMemberData.uid, newMemberData.frontendId, {unionInfo: newMemberData.unionInfo}).catch(e => {
            logger.error(e.stack)
        });

        // 存储分数变化记录
        let newUnionInfo = newUserData.unionInfo.find(function (e) {
            return e.unionID === msg.unionID;
        });
        let scoreChangeRecordArr = [];
        scoreChangeRecordArr.push({
            uid: newUserData.uid,
            nickname: newUserData.nickname,
            unionID: msg.unionID,
            changeCount: -msg.count,
            leftCount: newUnionInfo.score,
            leftSafeBoxCount: newUnionInfo.safeScore,
            changeType: enumeration.scoreChangeType.MODIFY_LOW,
            describe: msg.count > 0? ("给下级" + newMemberData.uid + "加分" + msg.count):("给下级" + newMemberData.uid + "减分" + msg.count * -1),
            createTime: Date.now()
        });
        let newMemberUnionInfo = newMemberData.unionInfo.find(function (e) {
            return e.unionID === msg.unionID;
        });
        scoreChangeRecordArr.push({
            uid: newMemberData.uid,
            nickname: newMemberData.nickname,
            unionID: msg.unionID,
            changeCount: msg.count,
            leftCount: newMemberUnionInfo.score,
            leftSafeBoxCount: newMemberUnionInfo.safeScore,
            changeType: enumeration.scoreChangeType.MODIFY_UP,
            describe: msg.count > 0? ("上级" + newUserData.uid + "加分" + msg.count):("上级" + newUserData.uid + "减分" + msg.count * -1),
            createTime: Date.now()
        });
        await commonDao.createDataArr("userScoreChangeRecordModel", scoreChangeRecordArr);

        next(null, {code: code.OK, updateUserData: {unionInfo: newUserData.unionInfo}});
    } catch (e){
        logger.error(e.stack);
        next(null, {code: 500});
    }
};

// 添加合伙人
Handler.prototype.addPartner = async function (msg, session, next) {
    try {
        if (!session.uid) {
            next(null, {code: code.INVALID_UERS});
            return;
        }
        if (!msg.unionID || !msg.memberUid) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询联盟数据
        let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
        if (!unionData) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询用户数据
        let userData = await userDao.getUserDataByUid(session.uid);
        if (!userData) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 判断是否在联盟中
        let userUnionInfoItem = userData.unionInfo.find(function (ele) {
            return ele.unionID === msg.unionID;
        });
        if (!userUnionInfoItem) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询会员数据
        let memberUserData = await userDao.getUserDataByUid(msg.memberUid);
        if (!memberUserData) {
            next(null, {code: code.NOT_IN_UNION});
            return;
        }
        // 判断是否在联盟中
        let memberUnionInfoItem = memberUserData.unionInfo.find(function (ele) {
            return ele.unionID === msg.unionID;
        });
        // 只有上级可以添加未合伙人
        if (!memberUnionInfoItem || memberUnionInfoItem.spreaderID !== session.uid) {
            next(null, {code: code.NOT_IN_UNION});
            return;
        }
        // 已经添加过则直接返回
        if (memberUnionInfoItem.partner) {
            next(null, {code: code.OK});
            return;
        }
        // 更新用户数据
        let newMemberData = await userDao.updateUserData({
            uid: msg.memberUid,
            "unionInfo.unionID": msg.unionID
        }, {"unionInfo.$.partner": true});
        if (!!newMemberData.frontendId) userInfoServices.updateUserDataNotify(newMemberData.uid, newMemberData.frontendId, {unionInfo: newMemberData.unionInfo}).catch(e => {
            logger.error(e.stack)
        });

        next(null, {code: code.OK});
    } catch (e){
        logger.error(e.stack);
        next(null, {code: 500});
    }
};

// 查看修改积分日志
Handler.prototype.getScoreModifyRecord = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.matchData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let list = await commonDao.findDataAndCount("scoreModifyRecordModel", msg.startIndex, msg.count, {createTime: -1}, msg.matchData);

    let totalScoreCount = 0;
    {
        let groupData = {_id: null, totalCount:{$sum: "$count"}};
        let execData = [
            {$match: msg.matchData},
            {$group: groupData}
        ];
        let result = await commonDao.getStatisticsInfo('scoreModifyRecordModel', execData);

        if (result.length > 0){
            totalScoreCount = result[0].totalCount;
        }
    }
    let yesterdayTotalCount = 0;
    {
        let groupData = {_id: null, totalCount:{$sum: "$count"}};
        let matchData = utils.clone(msg.matchData);
        let todayStart = utils.getTimeTodayStart();
        matchData.createTime = {$gte: todayStart - 24 * 60 * 60 * 1000, $lt: todayStart};
        let execData = [
            {$match: matchData},
            {$group: groupData}
        ];
        let result = await commonDao.getStatisticsInfo('scoreModifyRecordModel', execData);

        if (result.length > 0){
            yesterdayTotalCount = result[0].totalCount;
        }
    }
    let todayTotalCount = 0;
    {
        let groupData = {_id: null, totalCount:{$sum: "$count"}};
        let matchData = utils.clone(msg.matchData);
        let todayStart = utils.getTimeTodayStart();
        matchData.createTime = {$gte: todayStart};
        let execData = [
            {$match: matchData},
            {$group: groupData}
        ];
        let result = await commonDao.getStatisticsInfo('scoreModifyRecordModel', execData);

        if (result.length > 0){
            todayTotalCount = result[0].totalCount;
        }
    }

    next(null, {code: code.OK, msg: {recordArr: list.recordArr, totalCount: list.totalCount, totalScoreCount: Math.abs(totalScoreCount), yesterdayTotalCount: Math.abs(yesterdayTotalCount), todayTotalCount: Math.abs(todayTotalCount)}});
};

// 邀请玩家
Handler.prototype.inviteJoinUnion = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.uid){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询联盟数据
    let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
    if (!unionData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 检查邀请权限
    if (!!unionData.forbidInvite && session.uid !== unionData.ownerUid){
        next(null, {code: code.FORBID_INVITE_SCORE});
        return;
    }
    // 查询用户数据
    let userData = await userDao.getUserDataByUid(session.uid);
    if (!userData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 判断是否在联盟中
    let userUnionInfoItem = userData.unionInfo.find(function (element) {
        return element.unionID === msg.unionID;
    });
    if (!userUnionInfoItem){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询会员数据
    let memberUserData = await userDao.getUserDataByUid(msg.uid);
    if (!memberUserData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 判断是否在联盟中
    let memberUnionInfoItem = memberUserData.unionInfo.find(function (element) {
        return element.unionID === msg.unionID;
    });
    if (!!memberUnionInfoItem){
        next(null, {code: code.ALREADY_IN_UNION});
        return;
    }
    // 更新联盟数据
    await await commonDao.updateData('unionModel', {unionID: msg.unionID}, {$inc: {curMember: 1}});
    // 加入到联盟中
    let pushData = {
        unionID: msg.unionID,
        spreaderID: session.uid,
        partner: !!msg.partner,
        joinTime: Date.now()
    };
    let uniqueIDData = await commonDao.findOneAndUpdateEx("uniqueIDModel", {key: 1}, {$inc: {unionInviteID: 7}}, {new: true, upsert: true});
    pushData.inviteID = uniqueIDData.unionInviteID;
    let newMemberData = await userDao.updateUserDataByUid(msg.uid, {$push: {unionInfo: pushData}});
    if (!!newMemberData.frontendId) userInfoServices.updateUserDataNotify(newMemberData.uid, newMemberData.frontendId, {unionInfo: newMemberData.unionInfo}).catch(e=>{logger.error(e.stack)});

    next(null, {code: code.OK});
    /*return;
    // 查询是否是重复邀请
    let temp = memberUserData.inviteMsg.find(element=>{
        return element.uid === session.uid && element.unionID === msg.unionID;
    });
    if (!!temp){
        next(null, {code: code.OK});
        return;
    }
    // 添加邀请消息
    let pushData = {
        uid: session.uid,
        nickname: userData.nickname,
        partner: !!msg.partner,
        unionID: msg.unionID,
        unionName: unionData.unionName
    };
    let newMemberData = await userDao.updateUserDataByUid(msg.uid, {$push: {inviteMsg:pushData}});
    if (!!newMemberData.frontendId) userInfoServices.updateUserDataNotify(newMemberData.uid, newMemberData.frontendId, {inviteMsg: newMemberData.inviteMsg}).catch(e=>{console.error(e)});

    next(null, {code: code.OK});*/
};

// 操作俱乐部邀请
Handler.prototype.operationInviteJoinUnion = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.uid || !msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let userData = await userDao.getUserDataByUid(session.uid);
    let inviteMsgItem = userData.inviteMsg.find(function (element) {
        return element.unionID === msg.unionID && element.uid === msg.uid;
    });
    if (!inviteMsgItem){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    async function clearInviteMsg(updateData) {
        return await userDao.updateUserDataByUid(session.uid, updateData);
    }
    // 拒绝则直接删除邀请信息
    if (!msg.agree){
        let newUserData = await clearInviteMsg({$pull: {inviteMsg: {unionID: msg.unionID, uid: msg.uid}}});
        next(null, {code: code.OK, updateUserData: {inviteMsg: newUserData.inviteMsg}});
        return;
    }
    // 判断是否已经达到玩家最大联盟数
    if (userData.unionInfo.length >= 20){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询联盟数据
    let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
    // 联盟不存在，则删除该联盟的信息
    if (!unionData){
        let newUserData = await clearInviteMsg({$pull: {inviteMsg: {unionID: msg.unionID}}});
        next(null, {code: code.REQUEST_DATA_ERROR, updateUserData: {inviteMsg: newUserData.inviteMsg}});
        return;
    }
    // 如果已经在联盟中，则删除联盟信息
    let unionInfoItem = userData.unionInfo.find(function (element) {
        return element.unionID === msg.unionID;
    });
    if (!!unionInfoItem){
        let newUserData = await clearInviteMsg({$pull: {inviteMsg: {unionID: msg.unionID}}});
        next(null, {code: code.OK, updateUserData: {inviteMsg: newUserData.inviteMsg}});
        return;
    }
    // 更新联盟数据
    await await commonDao.updateData('unionModel', {unionID: msg.unionID}, {$inc: {curMember: 1}});
    // 加入到联盟中
    let pushData = {
        unionID: msg.unionID,
        spreaderID: msg.uid,
        partner: inviteMsgItem.partner,
        joinTime: Date.now()
    };
    let uniqueIDData = await commonDao.findOneAndUpdateEx("uniqueIDModel", {key: 1}, {$inc: {unionInviteID: 7}}, {new: true, upsert: true});
    pushData.inviteID = uniqueIDData.unionInviteID;
    let newUserData = await userDao.updateUserDataByUid(session.uid, {$push: {unionInfo: pushData}, $pull: {inviteMsg: {unionID: msg.unionID}}});
    next(null, {code: code.OK, updateUserData: {inviteMsg: newUserData.inviteMsg, unionInfo: newUserData.unionInfo}});
};

// 更新返利比例
Handler.prototype.updateUnionRebate = async function (msg, session, next) {
    try {
        if (!session.uid) {
            next(null, {code: code.INVALID_UERS});
            return;
        }
        if (!msg.unionID || !msg.memberUid || typeof msg.rebateRate !== 'number' || msg.rebateRate > 1 || msg.rebateRate < 0) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询联盟数据
        let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
        if (!unionData) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询用户数据
        let userData = await userDao.getUserDataByUid(session.uid);
        if (!userData) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 判断是否在联盟中
        let userUnionInfoItem = userData.unionInfo.find(function (element) {
            return element.unionID === msg.unionID;
        });
        if (!userUnionInfoItem || userUnionInfoItem.rebateRate < msg.rebateRate) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询会员数据
        let memberUserData = await userDao.getUserDataByUid(msg.memberUid);
        if (!memberUserData) {
            next(null, {code: code.USER_IN_ROOM_DATA_LOCKED});
            return;
        }
        // 判断是否在联盟中，并且是否是该会员的上级用户
        let memberUnionInfoItem = memberUserData.unionInfo.find(function (element) {
            return element.unionID === msg.unionID;
        });
        if (!memberUnionInfoItem || memberUnionInfoItem.spreaderID !== session.uid || memberUnionInfoItem.rebateRate >= msg.rebateRate) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 更新比例
        let newMemberData = await userDao.updateUserData({
            uid: msg.memberUid,
            "unionInfo.unionID": msg.unionID
        }, {"unionInfo.$.rebateRate": msg.rebateRate});
        if (!!newMemberData.frontendId) userInfoServices.updateUserDataNotify(newMemberData.uid, newMemberData.frontendId, {unionInfo: newMemberData.unionInfo}).catch(e => {
            logger.error(e)
        });

        next(null, {code: code.OK});
    } catch (e){
        logger.error(e.stack);
        next(null, {code: 500});
    }
};

Handler.prototype.updateUnionNotice = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.notice || msg.notice.length > 40){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let newUserData = await userDao.updateUserData({uid: session.uid, "unionInfo.unionID": msg.unionID}, {"unionInfo.$.notice": msg.notice});
    next(null, {code: code.OK, updateUserData: {unionInfo: newUserData.unionInfo}});
};

// 赠送积分
Handler.prototype.giveScore = async function (msg, session, next) {
    try {
        if (!session.uid) {
            next(null, {code: code.INVALID_UERS});
            return;
        }
        if (!msg.unionID || typeof msg.count !== 'number' || msg.count <= 0 || !msg.giveUid || session.uid === msg.giveUid) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询联盟数据
        let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
        if (!unionData) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查看赠送权限
        if (!!unionData.forbidGive && session.uid !== unionData.ownerUid) {
            next(null, {code: code.FORBID_GIVE_SCORE});
            return;
        }
        // 查询用户数据
        let userData = await userDao.getUnlockUserDataAndLock(session.uid);
        if (!userData || !!userData.roomID) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 判断是否在联盟中
        let userUnionInfoItem = userData.unionInfo.find(function (ele) {
            return ele.unionID === msg.unionID;
        });
        // 非盟主时需要判断积分是否足够,盟主时不需要判断分数
        if (!userUnionInfoItem || (userUnionInfoItem.score < msg.count && session.uid !== unionData.ownerUid)) {
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 查询会员数据
        let memberUserData = await userDao.getUserDataByUid(msg.giveUid);
        if (!memberUserData) {
            next(null, {code: code.INVALID_UERS});
            return;
        }
        // 判断是否在联盟中
        let memberUnionInfoItem = memberUserData.unionInfo.find(function (ele) {
            return ele.unionID === msg.unionID;
        });
        if (!memberUnionInfoItem) {
            await userDao.unlockUserData(session.uid);
            next(null, {code: code.NOT_IN_UNION});
            return;
        }
        // 修改分数
        let newUserData = null;
        // 非盟主时，需改对应修改分数数量
        if (session.uid !== unionData.ownerUid) {
            newUserData = await userDao.updateUserDataAndUnlock({
                uid: session.uid,
                "unionInfo.unionID": msg.unionID
            }, {$inc: {"unionInfo.$.score": -msg.count}});
        }
        // 盟主时，不需要修改
        else {
            await userDao.unlockUserData(session.uid);
            newUserData = userData;
        }
        let newMemberData = await userDao.updateUserData({
            uid: msg.giveUid,
            "unionInfo.unionID": msg.unionID
        }, {$inc: {"unionInfo.$.score": msg.count}});
        // 添加修改记录
        let createData = {
            uid: session.uid,
            nickname: newUserData.nickname,
            gainUid: msg.giveUid,
            gainNickname: memberUserData.nickname,
            unionID: msg.unionID,
            count: msg.count,
            createTime: Date.now()
        };
        commonDao.createData('scoreGiveRecordModel', createData).catch(e => {
            logger.error(e.stack)
        });
        if (!!newMemberData.frontendId) userInfoServices.updateUserDataNotify(newMemberData.uid, newMemberData.frontendId, {unionInfo: newMemberData.unionInfo}).catch(e => {
            logger.error(e.stack)
        });

        // 存储分数变化记录
        let newUnionInfo = newUserData.unionInfo.find(function (e) {
            return e.unionID === msg.unionID;
        });
        let scoreChangeRecordArr = [];
        scoreChangeRecordArr.push({
            uid: newUserData.uid,
            nickname: newUserData.nickname,
            unionID: msg.unionID,
            changeCount: -msg.count,
            leftCount: newUnionInfo.score,
            leftSafeBoxCount: newUnionInfo.safeScore,
            changeType: enumeration.scoreChangeType.GIVE,
            describe: "赠送给" + newMemberData.uid + ":" + msg.count,
            createTime: Date.now()
        });
        let newMemberUnionInfo = newMemberData.unionInfo.find(function (e) {
            return e.unionID === msg.unionID;
        });
        scoreChangeRecordArr.push({
            uid: newMemberData.uid,
            nickname: newMemberData.nickname,
            unionID: msg.unionID,
            changeCount: msg.count,
            leftCount: newMemberUnionInfo.score,
            leftSafeBoxCount: newMemberUnionInfo.safeScore,
            changeType: enumeration.scoreChangeType.GIVE,
            describe: newUserData.uid + "赠送" + ":" + msg.count,
            createTime: Date.now()
        });
        await commonDao.createDataArr("userScoreChangeRecordModel", scoreChangeRecordArr);

        next(null, {code: code.OK, updateUserData: {unionInfo: newUserData.unionInfo}});
    }catch (e){
        logger.error(e.stack);
        next(null, {code: code.OK});
    }
};

// 获取成员列表
Handler.prototype.getGiveScoreRecord = async function (msg, session, next) {
    try {
        if (!session.uid) {
            next(null, {code: code.INVALID_UERS});
            return;
        }
        if (!msg.unionID || !msg.matchData) {
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        let res = await commonDao.findDataAndCount('scoreGiveRecordModel', msg.startIndex || 0, msg.count || 20, {createTime: -1}, msg.matchData);
        let totalGiveCount = 0;
        // 获取赠送总额
        if (!!msg.total) {
            let groupData = {_id: null, totalGiveCount: {$sum: "$count"}};
            let execData = [
                {
                    $match: {
                        uid: session.uid,
                        unionID: msg.unionID
                    }
                },
                {$group: groupData}
            ];
            let result = await commonDao.getStatisticsInfo('scoreGiveRecordModel', execData);

            if (result.length > 0) {
                totalGiveCount = result[0].totalGiveCount;
            }
        }
        let totalGainCount = 0;
        // 获取受赠总额
        if (!!msg.total) {
            let groupData = {_id: null, totalGiveCount: {$sum: "$count"}};
            let execData = [
                {
                    $match: {
                        gainUid: session.uid,
                        unionID: msg.unionID
                    }
                },
                {$group: groupData}
            ];
            let result = await commonDao.getStatisticsInfo('scoreGiveRecordModel', execData);

            if (result.length > 0) {
                totalGainCount = result[0].totalGiveCount;
            }
        }

        let data = {
            recordArr: res.recordArr,
            totalCount: res.totalCount,
        };
        if (msg.total) {
            data.totalGiveCount = totalGiveCount;
            data.totalGainCount = totalGainCount
        }
        next(null, {code: code.OK, msg: data});
    }catch (e){
        logger.error(e.stack);
        next(null, {code: 500});
    }
};

// 获取成员列表
Handler.prototype.getUnionRebateRecord = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.matchData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let res = await commonDao.findDataAndCount('userRebateRecordModel', msg.startIndex || 0, msg.count || 20, {createTime: -1}, msg.matchData);
    next(null, {code: code.OK, msg: {recordArr: res.recordArr, totalCount: res.totalCount}});
};

// 获取成员列表
Handler.prototype.getGameRecord = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.matchData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let res = await commonDao.findDataAndCount('userGameRecordModel', msg.startIndex || 0, msg.count || 20, {createTime: -1}, msg.matchData);
    next(null, {code: code.OK, msg: {recordArr: res.recordArr, totalCount: res.totalCount}});
};

// 获取游戏录像
Handler.prototype.getVideoRecord = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.videoRecordID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let res = await commonDao.findOneData('gameVideoRecordModel', {videoRecordID: msg.videoRecordID});
    next(null, {code: code.OK, msg: {gameVideoRecordData: res}});
};

// 更新禁止游戏状态
Handler.prototype.updateForbidGameStatus = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.uid){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let forbid = msg.forbid || false;
    // 查询联盟数据
    let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
    if (!unionData || unionData.ownerUid !== session.uid){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询用户数据
    let userData = await userDao.getUserDataByUid(msg.uid);
    if (!userData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    if (userData.prohibitGame === forbid){
        next(null, {code: code.OK});
        return;
    }
    let newUserData = await userDao.updateUserData({uid: msg.uid, "unionInfo.unionID": msg.unionID}, {"unionInfo.$.prohibitGame": forbid});
    if (!!newUserData.frontendId) userInfoServices.updateUserDataNotify(newUserData.uid, newUserData.frontendId, {unionInfo: newUserData.unionInfo}).catch(e=>{logger.error(e.stack)});
    next(null, {code: code.OK});
};

// 更新禁止游戏状态
Handler.prototype.getRank = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.matchData || !msg.sortData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询联盟数据
    let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
    if (!unionData || (unionData.ownerUid !== session.uid && !unionData.showRank)){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let aggregateData = [
        {'$match': msg.matchData},
        {$unwind: "$unionInfo"},
        {'$match': msg.matchData},
        {'$sort': msg.sortData},
        {'$skip': msg.startIndex || 0},
        {'$limit': msg.count || 10}
    ];
    let res = await commonDao.getStatisticsInfo("userModel", aggregateData);
    let recordArr = [];
    for (let i = 0; i < res.length; ++i){
        let user = res[i];
        let unionInfoItem = user.unionInfo;
        if (!unionInfoItem) continue;
        recordArr.push({
            uid: user.uid,
            nickname: user.nickname,
            avatar: user.avatar,
            todayDraw: unionInfoItem.todayDraw,
            weekDraw: unionInfoItem.weekDraw || 0,
            totalDraw: unionInfoItem.totalDraw || 0
        })
    }
    next(null, {code: code.OK, msg: {recordArr: recordArr}});
};

// 更新单局游戏状态
Handler.prototype.getRankSingleDraw = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.matchData || !msg.sortData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 查询联盟数据
    let unionData = await commonDao.findOneData('unionModel', {unionID: msg.unionID});
    if (!unionData || (unionData.ownerUid !== session.uid && !unionData.showSingleRank)){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    msg.matchData.createTime = {$gte: utils.getTimeTodayStart()};
    let groupData = {
        _id : '$userList.uid',
        nickname: {$first: "$userList.nickname"},
        avatar: {$first: "$userList.avatar"},
    };
    if (msg.sortData.score === 1){
        groupData.score = {$min: "$userList.score"}
    } else{
        groupData.score = {$max: "$userList.score"}
    }
    let aggregateData = [
        {'$match': msg.matchData},
        {$unwind: "$userList"},
        {'$match': msg.matchData},
        {$group: groupData},
        {'$sort': msg.sortData},
        {'$skip': msg.startIndex || 0},
        {'$limit': msg.count || 10}
    ];
    let res = await commonDao.getStatisticsInfo("userGameRecordModel", aggregateData);
    let recordArr = [];
    for (let i = 0; i < res.length; ++i){
        let userList = res[i];
        userList.uid = userList._id;
        recordArr.push(userList);
    }
    next(null, {code: code.OK, msg: {recordArr: recordArr}});
};