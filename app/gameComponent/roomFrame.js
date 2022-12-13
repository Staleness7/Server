let code = require('../constant/code');
let roomProto = require('../API/Protos/RoomProto');
let dao = require('../dao/commonDao');
let pushAPI = require('../API/pushAPI');
//let rpcAPI = require('../API/rpcAPI');
let logger = require('pomelo-logger').getLogger('room');
let utils = require('../util/utils');
let scheduler = require('pomelo-scheduler');
let enumeration = require('../constant/enumeration');
let userDao = require('../dao/userDao');
let userInfoServices = require('../services/userInfoServices');
let pomeloServices = require('../services/pomeloServices');
let rebateServices = require('../services/rebateServices');
let pomelo = require('pomelo');
let gameConfig = require('./gameConfig');
//let OFFLINE_WAIT_TIME = 10 * 1000;

module.exports = function (roomID, creatorInfo, gameRule){
    return new roomFrame(roomID, creatorInfo, gameRule);
};

let roomFrame = function (roomID, creatorInfo, gameRule){
    this.app = pomelo.app;
    this.publicParameter = this.app.get('config');

    // 房间基本信息
    this.roomID = roomID;
    this.gameType = gameRule.gameType;
    this.gameRule = gameRule;
	this.creatorInfo = creatorInfo;
	this.alreadyCostUserUidArr = [];

    // 房间状态
    this.createTime = Date.now();
    this.lastNativeTime = Date.now();
    this.gameStarted = false;
    this.roomDismissed = false;
    this.hasFinishedOneBureau = false;
    this.hasStartedOneBureau = false;

    // 当前局数
    this.maxBureau = gameRule.bureau || 8;
    this.curBureau = 0;

	// 房间用户信息
    this.chairCount = gameRule.maxPlayerCount || gameConfig.getDefaultMaxPlayerCount(this.gameType);
    this.currentUserCount = 0;
    this.userArr = {};
	this.offlineSchedulerIDs = {};
	this.clearUserArr = {};
	this.startSchedulerID = null;
	// 记录玩家从第几局加入游戏的局数
    this.userJoinGameBureau = {};

    this.userGetHongBaoCountArr = [];

    // 创建游戏逻辑
    let gameFrame = require('./' + gameConfig.getGameFrameSink(this.gameType));
    this.gameFrameSink = new gameFrame(this);

	this.kickSchedules = {};

    logger.debug("roomFrame", "create, roomID:" + roomID + ",gameType:" + this.gameType);
};

let pro = roomFrame.prototype;

// 重置游戏
pro.resetRoom = function () {
    this.createTime = Date.now();
    this.lastNativeTime = Date.now();
    this.gameStarted = false;
    this.roomDismissed = false;
    this.hasFinishedOneBureau = false;
    this.hasStartedOneBureau = false;

    this.alreadyCostUserUidArr = [];
    this.userJoinGameBureau = {};

    this.userGetHongBaoCountArr = [];

    // 当前局数
    this.maxBureau = this.gameRule.bureau || 8;
    this.curBureau = 0;

    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            this.userArr[key].winScore = 0;
        }
    }

    this.clearUserArr = {};

    // 取消离线倒计时
    for (let key in this.offlineSchedulerIDs){
        if (this.offlineSchedulerIDs.hasOwnProperty(key)){
            scheduler.cancelJob(this.offlineSchedulerIDs[key]);
            delete this.offlineSchedulerIDs[key];
        }
    }
    this.offlineSchedulerIDs = {};

    if(this.answerExitSchedule) {
        clearInterval(this.answerExitSchedule);
        this.answerExitSchedule = null;
    }
    this.askForExitArr = null;

    if (!!this.startSchedulerID){
        clearInterval(this.startSchedulerID);
        this.startSchedulerID = null;
    }

    let gameFrame = require('./' + gameConfig.getGameFrameSink(this.gameType));
    this.gameFrameSink = new gameFrame(this);

    // 给所有在线玩家设置准备倒计时
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            this.addKickScheduleEvent(key);
        }
    }
};

// ----------------------------------消息接收相关----------------------------------
pro.receiveRoomMessage = function (uid, msg){
    logger.debug("receiveRoomMessage");
    logger.debug("mgs:" + JSON.stringify(msg));
    let type = msg.type || null;
    let data = msg.data || null;
    if(!type || !data || !this.userArr[uid]) return;

    if(type === roomProto.USER_READY_NOTIFY){
        this.userReady(uid, data);
    } 
	else if(type === roomProto.USER_LEAVE_ROOM_NOTIFY){
        this.userLeaveRoomRequest(uid);
    }
	else if (type === roomProto.GET_ROOM_SCENE_INFO_NOTIFY){
        this.getRoomSceneInfo(uid);
    }
	else if(type === roomProto.ASK_FOR_DISMISS_NOTIFY) {
        this.askForDismiss(uid, data.isExit).catch(err=>logger.error(err.stack));
    }
	else if(type === roomProto.USER_CHANGE_SEAT_NOTIFY) {
		this.userChangeSeat(uid, data.fromChairID, data.toChairID);
	}
	else if(type === roomProto.USER_CHAT_NOTIFY) {
		this.userChat(uid, data.toChairID, data.msg);
	}
	else {
        logger.error("roomFrame", "receiveRoomMessage err: type not find");
    }
};

pro.receiveGameMessage = function (uid, msg){
    let user = this.userArr[uid];
    if(!user){
        logger.error("receiveGameMessage", "用户不在此房间中，uid=" + uid);
        return;
    }
    this.gameFrameSink.receivePlayerMessage(user.chairID, msg);
};

// ----------------------------------消息发送相关----------------------------------

pro.sendRoomData = function (msg, uidAndFrontendIdArr){
    if(!uidAndFrontendIdArr){
        uidAndFrontendIdArr = [];
        for (let key in this.userArr){
            if(this.userArr.hasOwnProperty(key)){
                let user = this.userArr[key];
                if((user.userStatus&roomProto.userStatusEnum.OFFLINE) === 0 && !!user.userInfo.frontendId) {
                    uidAndFrontendIdArr.push({uid: key, sid: user.userInfo.frontendId});
                }
            }
        }
    }else{
        let tempArr = [];
        for (let i = 0; i < uidAndFrontendIdArr.length; ++i){
            if (!!uidAndFrontendIdArr[i].sid){
                tempArr.push(uidAndFrontendIdArr[i]);
            }
        }
        uidAndFrontendIdArr = tempArr;
    }
    if(uidAndFrontendIdArr.length === 0) return;
    logger.debug ("roomFrame", 'send room Data:' + JSON.stringify(msg));
    pushAPI.roomMessagePush(msg, uidAndFrontendIdArr);
};

pro.sendRoomDataToAll = function (msg){
    this.sendRoomData(msg, null);
};

pro.sendPopDialogContent = function (code, content, chairIDArr){
    if(!chairIDArr){
        chairIDArr = [];
        for(let i = 0; i < this.chairCount; ++i){
            chairIDArr.push(i);
        }
    }
    let uidAndFrontendIdArr = [];
    for(let  i = 0; i < chairIDArr.length; ++i){
        let user = this.getUserByChairID( chairIDArr[i]);
        if(!!user && (user.userStatus&roomProto.userStatusEnum.OFFLINE) === 0){
            uidAndFrontendIdArr.push({uid: user.userInfo.uid, sid: user.userInfo.frontendId});
        }
    }
    if(uidAndFrontendIdArr.length === 0) return;
    logger.info ('sendPopDialogContent sendData:');
    logger.info (code);
    pushAPI.popDialogContentPush({code: code, content: content}, uidAndFrontendIdArr);
};

pro.sendPopDialogContentToAll = function (code, content){
    this.sendPopDialogContent(code, content, null);
};

pro.sendRoomDataExceptUid = function (msg, uidArr){
    let uidAndFrontendIdArr = [];
	let key;
	for(key in this.userArr) {
        if(this.userArr.hasOwnProperty(key)) {
            let user = this.userArr[key];
            if ((user.userStatus&roomProto.userStatusEnum.OFFLINE) === 0 && uidArr.indexOf(key) === -1)
            uidAndFrontendIdArr.push({uid:key, sid: user.userInfo.frontendId});
		}
	}
    this.sendRoomData(msg, uidAndFrontendIdArr);
};

pro.updateRoomUserInfo = function (newUserInfo, notify){
    let user = this.userArr[newUserInfo.uid];
    if (!user) return;
    // 更新用户信息
    for (let key in newUserInfo){
        if(newUserInfo.hasOwnProperty(key) && user.userInfo.hasOwnProperty(key) && key !== 'uid'){
            user.userInfo[key] = newUserInfo[key];
        }
    }
    if (!!notify) this.sendRoomDataToAll(roomProto.userInfoChangePush(user.userInfo));
};

// ---------------------------------游戏开始相关----------------------------------
pro.userReady = function (uid){
    logger.debug("roomFrame", "startGame uid:" + uid);
    if(this.gameStarted) return;
    let user = this.userArr[uid];
    if (!user) return;
    // 首局判断玩家积分，如果积分不够则直接踢出游戏
    if (!this.hasStartedOneBureau && user.userInfo.score < (this.gameRule.scoreLowLimit || 0)){
        this.sendPopDialogContent(code.LEAVE_ROOM_GOLD_NOT_ENOUGH_LIMIT, null, [user.chairID]);
        this.kickUser(uid).catch(e=>{logger.error(e.stack)});
        return;
    }
	if(!!user && (user.userStatus&roomProto.userStatusEnum.READY) == 0) {
		user.userStatus |= roomProto.userStatusEnum.READY;
		user.userStatus |= roomProto.userStatusEnum.DISMISS;
	}
	else {
		logger.debug("roomFrame ready twice, uid:" + uid);
		return;
	} 
    this.sendRoomData(roomProto.userReadyPush(user.chairID));
    // 判断游戏是否需要开始
    if(this.efficacyStartGame()) this.startGame().catch((err)=>{logger.error(err.stack);});
    else{
        if (this.hasStartedOneBureau) return;
        if (this.gameStarted) return;
        if (!!this.startSchedulerID) return;
        if(this.isShouldSchedulerStart()){
            let tick = 10;
            this.startSchedulerID = setInterval(function(){
                if (this.isDismissing()) { return; }
                tick--;
                if (tick >= 0) return;
                if(!this.isShouldSchedulerStart()) return;
                // 开始游戏
                clearInterval(this.startSchedulerID);
                this.startSchedulerID = null;
                if (this.gameStarted) return;
                // 没准备的玩家转成旁观
                for(let key in this.userArr) {
                    if(this.userArr.hasOwnProperty(key)) {
                        let user = this.userArr[key];
                        if (user.chairID >= this.chairCount) continue;
                        if ((user.userStatus & roomProto.userStatusEnum.READY) === 0){
                            this.userChangeSeat(key, user.chairID, this.getEmptyChairId(null, true));
                        }
                    }
                }
                this.startGame().catch((err)=>{logger.error(err.stack);});
            }.bind(this), 1000);
        }
    }
};

pro.isShouldSchedulerStart = function(){
    if (this.gameStarted) return false;
    if (this.hasStartedOneBureau) return false;
    if (this.roomDismissed) return false;
    let readyCount = 0;
    for(let key in this.userArr) {
        if(this.userArr.hasOwnProperty(key)) {
            let user = this.userArr[key];
            if (user.chairID < this.chairCount) { // 大于10的玩家未入座
                if((this.userArr[key].userStatus & roomProto.userStatusEnum.READY) > 0) ++ readyCount;
            }
        }
    }
    return (readyCount >= 4 && readyCount >= this.gameRule.minPlayerCount);
};

pro.startGame = async function (){
    logger.debug("roomFrame", "startGame roomID:" + this.roomID);
    if(this.gameStarted) return;
    if (!!this.startSchedulerID){
        clearInterval(this.startSchedulerID);
        this.startSchedulerID = null;
    }
	for (let key in this.kickSchedules) {
		clearTimeout(this.kickSchedules[key]);
		delete this.kickSchedules[key];
	}
    // 第一局游戏开局时收取房费
    if (this.maxBureau > 0){
        // 判断联盟是否已经解散
        if (this.curBureau === 0 && this.creatorInfo.creatorType === enumeration.roomCreatorType.UNION_CREATE){
            let union = await pomelo.app.unionManager.getUnion(this.creatorInfo.unionID);
            if (!union.isOpening()){
                this.sendPopDialogContentToAll(null, "联盟已打烊，无法开始新的牌局");
                await this.dismissRoom(enumeration.gameRoomDismissReason.UNION_OWNER_DISMISS);
                return;
            }
        }
        try {
            await this.collectionRoomRentWhenStart();
        } catch (e){
            logger.error(e.stack);
            // 收取房费失败，解散房间
            this.sendPopDialogContentToAll(null, "扣取房费失败，房间已解散");
            await this.dismissRoom(enumeration.gameRoomDismissReason.UNION_OWNER_DISMISS);
            return;
        }
        /*// 收取固定抽分
        if(this.curBureau > 0){
            try {
                await this.calculateRebateWhenStart();
            } catch (e){
                logger.error(e.stack);
            }
            for (let key in this.userArr){
                if (this.userArr.hasOwnProperty(key)){
                    if (this.userArr[key].chairID >= this.chairCount) continue;
                    if (this.alreadyCostUserUidArr.indexOf(this.userArr[key].userInfo.uid) !== -1) continue;
                    this.alreadyCostUserUidArr.push(this.userArr[key].userInfo.uid);

                }
            }
        }*/
		for (let key in this.userArr) {
			if (this.userArr.hasOwnProperty(key)){
                if (this.userArr[key].chairID >= this.chairCount) continue;
				this.userJoinGameBureau[key] = (this.userJoinGameBureau[key] || 0) + 1 // 记录加入游戏的局数
			}
		}
	}

    this.gameStarted = true;
    this.hasStartedOneBureau = true;
    this.lastNativeTime = Date.now();
	// 更新参数
    this.publicParameter = this.app.get('config');
    // 修改房间中玩家状态
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            let user = this.userArr[key];
			if (user.chairID < this.chairCount) {
				user.userStatus &= ~roomProto.userStatusEnum.READY;
				user.userStatus |= roomProto.userStatusEnum.PLAYING;
			}
        }
    }
    this.gameFrameSink.onEventGameStart();
};

// 判定游戏是否可以开始
pro.efficacyStartGame = function (){
    if(this.roomDismissed || this.gameStarted) return false;
    let readyCount = 0;
    let userCount = 0;
    for(let key in this.userArr) {
        if(this.userArr.hasOwnProperty(key)) {
			let user = this.userArr[key];
			if (user.chairID < this.chairCount) { // 大于10的玩家未入座 
				++ userCount;
				if((this.userArr[key].userStatus & roomProto.userStatusEnum.READY) > 0) ++ readyCount;
			}
        }
    }
	/* return (userCount === readyCount && userCount === this.chairCount);  */
	return (userCount === readyCount && userCount >= this.gameRule.minPlayerCount) || readyCount === this.gameRule.maxPlayerCount;
};

 pro.collectionRoomRentWhenStart = async function () {
    if (this.creatorInfo.creatorType === enumeration.roomCreatorType.USER_CREATE){
        if (this.gameRule.payType === enumeration.roomPayType.AAZHIFU){
            let saveDataArr = [];
            for (let key in this.userArr){
                if (this.userArr.hasOwnProperty(key)){
                    let user = this.userArr[key];
                    saveDataArr.push({
                        matchData: {uid: user.userInfo.uid},
                        saveData: {$inc: {gold: -this.gameRule.payDiamond}}
                    })
                }
            }
            let newUserDataArr = await userDao.updateUserDataArr(saveDataArr);
            for (let i = 0; i < newUserDataArr.length; ++i){
                let updateUserData = newUserDataArr[i];
                if (!updateUserData) continue;
                if (!!updateUserData.frontendId){
                    userInfoServices.updateUserDataNotify(updateUserData.uid, updateUserData.frontendId, {gold: updateUserData.gold}).catch((err)=>{logger.error(err.stack)});
                }
            }
        }else if (this.gameRule.payType === enumeration.roomPayType.WOZHIFU){
            let newUserData = await userDao.updateUserDataByUid(this.creatorInfo.uid, {$inc: {gold: -this.gameRule.payDiamond}});
            if (!!newUserData.frontendId){
                userInfoServices.updateUserDataNotify(newUserData.uid, newUserData.frontendId, {gold: newUserData.gold}).catch((err)=>{logger.error(err.stack)});
            }
        }
    }else{
        let costUserCount = 0;
        for(let key in this.userArr){
            if (this.userArr.hasOwnProperty(key)){
                let user = this.userArr[key];
                if (user.chairID >= this.chairCount) continue;
                if (this.alreadyCostUserUidArr.indexOf(user.userInfo.uid) !== -1) continue;
                costUserCount++;
            }
        }
        if (costUserCount === 0) return;
        let payDiamondCount = gameConfig.oneUserDiamondCount(this.gameRule.bureau, this.gameType) * costUserCount;
        let union = await pomelo.app.unionManager.getUnion(this.creatorInfo.unionID);
        let unionOwnerUid = union.getOwnerUid();
        let matchData = {
            uid: unionOwnerUid
        };
        // 首局开局时检测金币是否足够，不够则解散房间
        if (this.curBureau === 0){
            matchData.gold = {$gte: payDiamondCount}
        }
        let userData = await userDao.updateUserData(matchData, {$inc: {gold: -payDiamondCount}});
        if (!userData){
            throw new Error(code.NOT_ENOUGH_GOLD);
        }else{
            if (!!userData.frontendId){
                userInfoServices.updateUserDataNotify(userData.uid, userData.frontendId, {gold: userData.gold}).catch((err)=>{logger.error(err.stack)});
            }
        }
    }
};

pro.collectionRoomRentWhenEnd = async function (binWinUidArr) {
    if (this.creatorInfo.creatorType === enumeration.roomCreatorType.USER_CREATE){
        if (this.gameRule.payType === enumeration.roomPayType.DACHIXIAOZHUANG){
            let count = Math.floor(this.gameRule.payDiamond/binWinUidArr.length);
            let saveDataArr = [];
            for (let i = 0; i < binWinUidArr.length; ++i){
                saveDataArr.push({
                    matchData: {uid: binWinUidArr[i]},
                    saveData: {$inc: -count}
                })
            }
            await userDao.updateUserDataArr(saveDataArr);
        }
    }
};

// ---------------------------------游戏结束相关----------------------------------
pro.concludeGame = async function (data){
    logger.debug("roomFrame", "concludeGame roomID:" + this.roomID);
    if(!this.gameStarted) return;
    this.gameStarted = false;
    this.hasFinishedOneBureau = true;
    // 修改玩家状态
    for(let key in this.userArr) {
        if(this.userArr.hasOwnProperty(key)) {
            let user = this.userArr[key];
            user.userStatus &= ~roomProto.userStatusEnum.PLAYING;
            user.userStatus &= ~roomProto.userStatusEnum.READY;
        }
    }
    // 记录游戏结果
    await this.recordGameResult(data).catch((err)=>{logger.error(err.stack);});
    // 收取固定抽分
    try {
        await this.calculateRebateWhenStart();
    } catch (e){
        logger.error(e.stack);
    }
    // 记录已经付房费的玩家，防止重复
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            if (this.userArr[key].chairID >= this.chairCount) continue;
            if (this.alreadyCostUserUidArr.indexOf(this.userArr[key].userInfo.uid) !== -1) continue;
            this.alreadyCostUserUidArr.push(this.userArr[key].userInfo.uid);

        }
    }
    // 收取每小局分数
    await this.recordOneDrawResult(data).catch((err)=>{logger.error(err.stack);});
    // 判断房间是否应该解散
    if (this.maxBureau > 0 && this.curBureau >= this.maxBureau){
		if (this.gameType !== enumeration.gameType.DGN) {
			await this.dismissRoom(enumeration.gameRoomDismissReason.BUREAU_FINISHED);
		}
    } else{
        // 移除不满足条件的玩家
        await this.clearNonSatisfiedConditionsUser();

        // 通知更新所有玩家信息
        this.notifyUpdateAllUserInfo();
    }

};

pro.notifyUpdateAllUserInfo = function () {
    // 更新所有玩家正在玩的玩家的分数变化
    for (let key in this.userArr){
        let user = this.userArr[key];
        if (!user) continue;
        if (user.chairID >= this.chairCount) continue;
        this.sendRoomDataToAll(roomProto.userInfoChangePush(user.userInfo));
    }
};

pro.recordGameResult = async function (dataArr) {
    if (!dataArr || dataArr.length === 0) return;
    // 计算最终获得金币数量
    let saveDataArr = [];
    for(let i = 0; i < dataArr.length; ++i){
        let data = dataArr[i];
        let user = this.userArr[data.uid];
        if (this.creatorInfo.creatorType === enumeration.roomCreatorType.UNION_CREATE){
            saveDataArr.push({
                matchData: {
                    uid: data.uid,
                    "unionInfo.unionID": this.creatorInfo.unionID
                },
                saveData: {
                    $inc: {"unionInfo.$.score": data.score}
                }
            });
        }else{
            this.updateRoomUserInfo({uid: data.uid, score: user.userInfo.score + data.score});
        }
        user.winScore = (user.winScore || 0) + data.score;
    }
    // 更新用户信息
    if (saveDataArr.length > 0){
        let scoreChangeRecordArr = [];
        let newTime = Date.now();
        let updateUserDataArr = await userDao.updateUserDataArr(saveDataArr);
        for (let i = 0; i < updateUserDataArr.length; ++i){
            let updateUserData = updateUserDataArr[i];
            if (!updateUserData) continue;
            if(!!this.userArr[updateUserData.uid])this.updateRoomUserInfo(userInfoServices.buildGameRoomUserInfoWithUnion(updateUserData, this.creatorInfo.unionID));
            if (!!updateUserData.frontendId){
                userInfoServices.updateUserDataNotify(updateUserData.uid, updateUserData.frontendId, {unionInfo: updateUserData.unionInfo}).catch((err)=>{logger.error(err.stack)});
            }
            if (this.creatorInfo.creatorType !== enumeration.roomCreatorType.UNION_CREATE) continue;
            let data = dataArr.find(function (e) {
                return e.uid === updateUserData.uid;
            });
            let newUnionInfo = updateUserData.unionInfo.find(function (e) {
                return e.unionID === this.creatorInfo.unionID;
            }.bind(this));
            scoreChangeRecordArr.push({
                uid: updateUserData.uid,
                nickname: updateUserData.nickname,
                unionID: this.creatorInfo.unionID,
                changeCount: data.score,
                leftCount: newUnionInfo.score,
                leftSafeBoxCount: newUnionInfo.safeScore,
                changeType: enumeration.scoreChangeType.GAME_WIN,
                describe: data.score > 0 ? ("赢分" + data.score):("输分" + -data.score),
                createTime: newTime
            });
        }
        if (scoreChangeRecordArr.length > 0) dao.createDataArr("userScoreChangeRecordModel", scoreChangeRecordArr).catch(e=>{logger.error(e.stack)});
    }
};

pro.writeUserGameResult = async function (dataArr) {
    this.recordGameResult(dataArr).catch(err=>{logger.error(err.stack);});
};

// 记录总局结果
pro.recordAllDrawResult = async function () {
    if (!this.hasFinishedOneBureau) return;
    // 俱乐部模式下记录游戏数据
    if (this.creatorInfo.creatorType === enumeration.roomCreatorType.UNION_CREATE){
        let rebateList = {};
        let avgRebateCount = 0;
        // 计算所有参与过该游戏的玩家
        let allPlayedUserArr = {};
        let invaildRebateUserArr = [];
        for(let key in this.userArr){
            if (this.userArr.hasOwnProperty(key) && !allPlayedUserArr[key]){
                if (this.alreadyCostUserUidArr.indexOf(key) === -1) continue;
                allPlayedUserArr[key] = this.userArr[key];
            }
        }
        for(let key in this.clearUserArr){
            if (this.clearUserArr.hasOwnProperty(key) && !allPlayedUserArr[key]){
                if (this.alreadyCostUserUidArr.indexOf(key) === -1) continue;
                let clearUser = this.clearUserArr[key];
                allPlayedUserArr[key] = {
                    userInfo: {
                        uid: key,
                        nickname: clearUser.nickname,
                        spreaderID: clearUser.spreaderID,
                        avatar: clearUser.avatar,
                    },
                    winScore: clearUser.score
                }
            }
        }
        if (this.gameRule.roomPayRule.rebateType !== 'one'){
            rebateList = this.calculateRebate(this.userArr);

            if (this.gameRule.roomPayRule.isAvg !== false){
                let totalRebateCount = 0;
                for (let key in rebateList){
                    if (rebateList.hasOwnProperty(key)){
                        totalRebateCount += (rebateList[key] || 0);
                    }
                }
                // 计算参与游戏的有效玩家数量
                let vaildUserCount = 0;
                for (let key in allPlayedUserArr){
                    if (allPlayedUserArr.hasOwnProperty(key)){
                        if (this.userJoinGameBureau[key] > 0 && this.userJoinGameBureau[key] >= this.gameRule.bureau - 3){
                            vaildUserCount++;
                        }else{
                            invaildRebateUserArr.push(key);
                        }
                    }
                }
                // 如果没有玩家分水，则不抽水
                if (vaildUserCount === 0){
                    avgRebateCount = 0;
                } else{
                    avgRebateCount = totalRebateCount/vaildUserCount;
                    avgRebateCount = Math.floor(avgRebateCount * 100)/100;
                }
            }
        }

        let bigWinUidArr = this.getBinWinUidArr(this.userArr);
        let scoreChangeRecordArr = [];
        let newTime = Date.now();
        for (let key in allPlayedUserArr){
            if (allPlayedUserArr.hasOwnProperty(key)){
                try {
                    let user = allPlayedUserArr[key];
                    if (!user) continue;
                    let saveData = {
                        $inc: {
                            "unionInfo.$.todayDraw": 1,
                            "unionInfo.$.totalDraw": 1,
                            "unionInfo.$.weekDraw": 1,
                            "unionInfo.$.todayWin": user.winScore || 0,
                        }
                    };
                    if (bigWinUidArr.indexOf(key) !== -1){
                        saveData.$inc["unionInfo.$.todayBigWinDraw"] = 1;
                    }
                    let rebateCount = this.gameRule.roomPayRule.isAvg !== false? avgRebateCount:(rebateList[key] ||0);
                    // 在avg模式下，过滤无效用户的返利
                    if (this.gameRule.roomPayRule.isAvg !== false && invaildRebateUserArr.indexOf(key) !== -1){
                        rebateCount = 0;
                    }
                    if (!!rebateList[key] && rebateList[key] > 0){
                        let count = Math.floor(rebateList[key] * 100)/100;
                        saveData.$inc["unionInfo.$.score"] = -count;
                    }
                    // 记录红包数量
                    let hongBaoCount = this.userGetHongBaoCountArr[user.chairID] || 0;
                    if (hongBaoCount > 0){
                        saveData.$inc["unionInfo.$.score"] = (saveData.$inc["unionInfo.$.score"] || 0) + hongBaoCount;
                    }
                    let newUserData = await userDao.updateUserData({uid: key, "unionInfo.unionID": this.creatorInfo.unionID}, saveData);
                    if (newUserData.frontendId){
                        userInfoServices.updateUserDataNotify(newUserData.uid, newUserData.frontendId, {unionInfo: newUserData.unionInfo}).catch(err=>{});
                    }

                    let newUnionInfo = newUserData.unionInfo.find(function (e) {
                        return e.unionID === this.creatorInfo.unionID;
                    }.bind(this));
                    if (rebateCount > 0){
                        scoreChangeRecordArr.push({
                            uid: newUserData.uid,
                            nickname: newUserData.nickname,
                            unionID: this.creatorInfo.unionID,
                            changeCount: -rebateCount,
                            leftCount: newUnionInfo.score,
                            leftSafeBoxCount: newUnionInfo.safeScore,
                            changeType: enumeration.scoreChangeType.GAME_WIN_CHOU,
                            describe: "赢家抽分" + rebateCount,
                            createTime: newTime
                        });
                    }
                    if(hongBaoCount > 0){
                        scoreChangeRecordArr.push({
                            uid: newUserData.uid,
                            nickname: newUserData.nickname,
                            unionID: this.creatorInfo.unionID,
                            changeCount: -rebateCount,
                            leftCount: newUnionInfo.score,
                            leftSafeBoxCount: newUnionInfo.safeScore,
                            changeType: enumeration.scoreChangeType.NONE,
                            describe: "红包抽奖" + hongBaoCount,
                            createTime: newTime
                        });
                    }

                    this.updateRoomUserInfo(userInfoServices.buildGameRoomUserInfoWithUnion(newUserData, this.creatorInfo.unionID));
                    await rebateServices.execRebate(this.creatorInfo.unionID, this.roomID, this.gameType, user.userInfo, null, null, key, rebateCount, bigWinUidArr.indexOf(key) !== -1);
                }catch (e){
                    logger.error(e.stack);
                }
            }
        }
        if (scoreChangeRecordArr.length > 0) dao.createDataArr("userScoreChangeRecordModel", scoreChangeRecordArr).catch(e=>{logger.error(e.stack)});
    }
    // 记录录像
    let gameVideoRecord = null;
    let gameVideoData = this.gameFrameSink.getGameVideoData();
    if (!!gameVideoData){
        let saveData = {
            roomID: this.roomID,
            gameType: this.gameType,
            detail: JSON.stringify(gameVideoData),
            createTime: Date.now()
        };
        gameVideoRecord = await dao.createData("gameVideoRecordModel", saveData);
    }
    // 记录游戏数据
    let userList = [];
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            let user = this.userArr[key];
            if (this.alreadyCostUserUidArr.indexOf(key) === -1) continue;
            userList.push({
                uid: key,
                nickname: user.userInfo.nickname,
                avatar: user.userInfo.avatar,
                score: user.winScore,
                spreaderID: user.userInfo.spreaderID
            })
        }
    }
    for (let key in this.clearUserArr){
        if (this.clearUserArr.hasOwnProperty(key)){
            let temp = userList.find(function (ele) {
                return ele.uid === key;
            });
            if (!!temp){
                temp.score = this.clearUserArr[key].score;
            }else{
                userList.push(this.clearUserArr[key]);
            }
        }
    }
    let detail = JSON.stringify(this.gameFrameSink.getGameBureauData() || []);
    let saveData = {
        roomID: this.roomID,
        gameType: this.gameType,
        userList: userList,
        detail: detail,
        createTime: Date.now()
    };
    if (!!gameVideoRecord){
        saveData.videoRecordID = gameVideoRecord.videoRecordID;
    }
    if (this.creatorInfo.creatorType === enumeration.roomCreatorType.UNION_CREATE){
        saveData.unionID = this.creatorInfo.unionID;
    }else{
        saveData.creatorUid = this.creatorInfo.uid
    }
    dao.createData("userGameRecordModel", saveData).catch(e=>{logger.error(e.stack)});
};

pro.recordOneDrawResult = async function (dataArr) {
    if (this.creatorInfo.creatorType !== enumeration.roomCreatorType.UNION_CREATE) return;
    if (this.gameRule.roomPayRule.rebateType !== 'one') return;
    let dataList = {};
    for (let i = 0; i < dataArr.length; ++i){
        let data = dataArr[i];
        dataList[data.uid] = {
            uid: data.uid,
            winScore: data.score
        }
    }
    let rebateList = this.calculateRebate(dataList);
    let avgRebateCount = 0;
    if (this.gameRule.roomPayRule.isAvg !== false){
        let totalRebateCount = 0;
        for (let key in rebateList){
            if (rebateList.hasOwnProperty(key)){
                totalRebateCount += (rebateList[key] || 0);
            }
        }
        // 计算参与游戏的有效玩家数量
        let vaildUserCount = dataArr.length;
        // 如果没有玩家分水，则不抽水
        if (vaildUserCount === 0){
            avgRebateCount = 0;
        } else{
            avgRebateCount = totalRebateCount/vaildUserCount;
            avgRebateCount = Math.floor(avgRebateCount * 100)/100;
        }
    }
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            try {
                let user = this.userArr[key];
                if (!user) continue;
                if (!dataList[key]) continue;
                if (user.chairID >= this.chairCount) continue;
                let rebateCount = this.gameRule.roomPayRule.isAvg !== false? avgRebateCount:(rebateList[key] ||0);
                if (rebateCount <= 0) continue;
                //let count = Math.floor(rebateCount * 100)/100;//parseFloat(rebateList[key].toFixed(2));
                let saveData = {};
                if (!!rebateList[key] && rebateList[key] > 0){
                    let count = Math.floor(rebateList[key] * 100)/100;
                    saveData = {
                        $inc:{
                            "unionInfo.$.score": -count
                        }
                    }
                }
                let newUserData = await userDao.updateUserData({uid: key, "unionInfo.unionID": this.creatorInfo.unionID}, saveData);
                if (newUserData.frontendId){
                    userInfoServices.updateUserDataNotify(newUserData.uid, newUserData.frontendId, {unionInfo: newUserData.unionInfo}).catch(err=>{});
                }
                this.updateRoomUserInfo(userInfoServices.buildGameRoomUserInfoWithUnion(newUserData, this.creatorInfo.unionID));
                await rebateServices.execRebate(this.creatorInfo.unionID, this.roomID, this.gameType, user.userInfo, null, null, key, rebateCount, false, true);
            }catch (e){
                logger.error(e.stack);
            }
        }
    }
};

pro.getBinWinUidArr = function (dataList) {
    let userWinScoreArr = [];
    for (let key in dataList){
        if (dataList.hasOwnProperty(key)){
            if (this.alreadyCostUserUidArr.indexOf(key) === -1) continue;
            let user = dataList[key];
            if(!user.winScore || user.winScore <= 0) continue;
            userWinScoreArr.push({
                uid: key,
                winScore: user.winScore
            })
        }
    }
    userWinScoreArr.sort(function (a, b) {
        return b.winScore - a.winScore;
    });
    let roomPayRule = this.gameRule.roomPayRule;
    let bigWinCount = 100;
    if (roomPayRule.bigWinCount === -1){
        bigWinCount = 100;
    } else{
        bigWinCount = roomPayRule.bigWinCount || 100;
    }
    let bigWinUidArr = [];
    let bigWinScore = userWinScoreArr[0];
    for (let i = 0; i < userWinScoreArr.length; ++i){
        let temp = userWinScoreArr[i];
        if (temp.winScore <= 0) continue;
        if (bigWinCount <= 0 && temp.winScore !== bigWinScore) break;
        bigWinUidArr.push(temp.uid);
        bigWinCount--;
    }
    return bigWinUidArr;
};

// 计算返利数量
pro.calculateRebate = function (dataList) {
    let roomPayRule = this.gameRule.roomPayRule;
    // 大赢家支付
    let bigWinUidArr = this.getBinWinUidArr(dataList);
    let rebateList = {};
    for (let i = 0; i < bigWinUidArr.length; ++i){
        let uid = bigWinUidArr[i];
        let user = dataList[uid];
        let winScore = user.winScore;
        if (roomPayRule.fixedScore !== null){
            if (roomPayRule.fixedMinWinScore === null || winScore >= roomPayRule.fixedMinWinScore){
                let count = roomPayRule.fixedScore;
                rebateList[uid] = (rebateList[uid] || 0) + count;
                winScore -= count;
            }
        }
        if (roomPayRule.percentScore !== null){
            if (roomPayRule.percentMinWinScore === null || winScore >= roomPayRule.percentMinWinScore){
                let count = roomPayRule.percentScore/100 * winScore;
                rebateList[uid] = (rebateList[uid] || 0) + count;
            }
        }
    }
    return rebateList;
};

// 计算返利数量
pro.calculateRebateWhenStart = async function () {
    if (this.creatorInfo.creatorType !== enumeration.roomCreatorType.UNION_CREATE) return;
    let roomPayRule = this.gameRule.roomPayRule;
    if (roomPayRule.everyFixedScore === null || roomPayRule.everyFixedScore <= 0) return;
    let rebateList = {};
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            let user = this.userArr[key];
            if (user.chairID >= this.chairCount) continue;
            if (this.alreadyCostUserUidArr.indexOf(user.userInfo.uid) !== -1) continue;
            rebateList[key] = (roomPayRule.everyFixedScore || 0);
            rebateList[key] += (roomPayRule.everyAgentFixedScore || 0);
        }
    }
    let totalRebateCount = 0;
    let scoreChangeRecordArr = [];
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            try {
                let user = this.userArr[key];
                if (!user) continue;
                if (!rebateList[key]) continue;
                let count = Math.floor(rebateList[key] * 100)/100;//parseFloat(rebateList[key].toFixed(2));
                if (!count || count <= 0) continue;
                let saveData = {
                    $inc: {
                        "unionInfo.$.score": -count
                    }
                };
                let newUserData = await userDao.updateUserData({uid: key, "unionInfo.unionID": this.creatorInfo.unionID}, saveData);
                this.updateRoomUserInfo(userInfoServices.buildGameRoomUserInfoWithUnion(newUserData, this.creatorInfo.unionID));
                if (newUserData.frontendId){
                    userInfoServices.updateUserDataNotify(newUserData.uid, newUserData.frontendId, {unionInfo: newUserData.unionInfo}).catch(err=>{});
                }

                // 存储分数变化记录
                let newUnionInfo = newUserData.unionInfo.find(function (e) {
                    return e.unionID === this.creatorInfo.unionID;
                }.bind(this));
                scoreChangeRecordArr.push({
                    uid: newUserData.uid,
                    nickname: newUserData.nickname,
                    unionID: this.creatorInfo.unionID,
                    changeCount: -count,
                    leftCount: newUnionInfo.score,
                    leftSafeBoxCount: newUnionInfo.safeScore,
                    changeType: enumeration.scoreChangeType.GAME_START_UNION_CHOU,
                    describe: "抽取房费" + count,
                    createTime: Date.now()
                });

                totalRebateCount += (count - roomPayRule.everyAgentFixedScore);
                // 计算代理固定返利
                if (!!roomPayRule.everyAgentFixedScore && roomPayRule.everyAgentFixedScore > 0){
                    try {
                        await rebateServices.execRebate(this.creatorInfo.unionID, this.roomID, this.gameType, user.userInfo, null, null, key, roomPayRule.everyAgentFixedScore, false, true);
                    }catch (e1){
                        logger.error(e1.stack);
                    }
                }
            }catch (e){
                logger.error(e.stack);
            }
        }
    }
    if (scoreChangeRecordArr.length > 0) dao.createDataArr("userScoreChangeRecordModel", scoreChangeRecordArr).catch(e=>{logger.error(e.stack)});

    totalRebateCount = Math.floor(totalRebateCount * 100)/100;//parseFloat(totalRebateCount.toFixed(2));
    if(totalRebateCount > 0){
        let union = await pomelo.app.unionManager.getUnion(this.creatorInfo.unionID);
        let unionOwnerUid = union.getOwnerUid();
        let saveData = {
            $inc: {
                "unionInfo.$.safeScore": totalRebateCount,
                "unionInfo.$.todayRebate": totalRebateCount,
                "unionInfo.$.totalRebate": totalRebateCount,
            }
        };
        let newUserData = await userDao.updateUserData({uid: unionOwnerUid, "unionInfo.unionID": this.creatorInfo.unionID}, saveData);
        if (newUserData.frontendId){
            userInfoServices.updateUserDataNotify(newUserData.uid, newUserData.frontendId, {unionInfo: newUserData.unionInfo}).catch(err=>{});
        }
        // 添加记录
        let createData = {
            uid: unionOwnerUid,
            roomID: this.roomID,
            gameType: this.gameType,
            unionID: this.creatorInfo.unionID,
            playerUid: "",
            totalCount: totalRebateCount,
            gainCount: totalRebateCount,
            start: true,
            createTime: Date.now()
        };
        dao.createData("userRebateRecordModel", createData).catch(e=>{logger.error(e.stack)});
    }
};

pro.clearOfflineUser = async function () {
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            let user = this.userArr[key];
            if ((user.userStatus & roomProto.userStatusEnum.OFFLINE) !== 0){
                await this.kickUser(user.userInfo.uid);
            }
        }
    }
};

pro.clearNonSatisfiedConditionsUser = async function () {
    if (this.creatorInfo.creatorType !== enumeration.roomCreatorType.UNION_CREATE) return;
    let kickUidArr = [];
    let kickChairIDArr = [];
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            let user = this.userArr[key];
            if (user.chairID >= this.chairCount) continue;
            if (user.userInfo.score < this.gameRule.scoreDismissLimit){
                if (this.gameType === enumeration.gameType.PDK || this.gameType === enumeration.gameType.ZNMJ){
                    await this.dismissRoom(enumeration.gameRoomDismissReason.USER_DISMISS);
                }
                else{
                    if (!!this.gameRule.canEnter && !!this.gameRule.canWatch){
                        this.userChangeSeat(user.userInfo.uid, user.chairID, this.getEmptyChairId(null, true));
                    } else{
                        kickUidArr.push(user.userInfo.uid);
                        kickChairIDArr.push(user.chairID);
                    }
                    if (!!this.clearUserArr[user.userInfo.uid]){
                        this.clearUserArr[user.userInfo.uid].winScore += user.winScore;
                    }else{
                        this.clearUserArr[user.userInfo.uid] = {
                            uid: user.userInfo.uid,
                            nickname: user.userInfo.nickname,
                            avatar: user.userInfo.avatar,
                            score: user.winScore,
                            spreaderID: user.userInfo.spreaderID
                        }
                    }
                }
            }
        }
    }
    if (kickUidArr.length > 0){
        this.sendPopDialogContent(code.LEAVE_ROOM_GOLD_NOT_ENOUGH_LIMIT, null, kickChairIDArr);
        for (let i = 0; i < kickUidArr.length; ++i){
            await this.kickUser(kickUidArr[i]);
        }

    }
};

// ---------------------------------进入房间相关----------------------------------
pro.userEntryRoom = async function (userInfo) {
    logger.debug("roomFrame", "userEntryRoom, userInfo:" + JSON.stringify(userInfo));
    if (this.roomDismissed) {
        logger.debug("userEntryRoom", "room already dismiss");
        return code.NOT_IN_ROOM;
    }
    let user = this.userArr[userInfo.uid];
	if (!user && !this.canEnter()) {
        logger.debug("userEntryRoom", "room not allow enter while gameing");
        return code.ROOM_PLAYER_COUNT_FULL;
	}
	let chairID = this.getEmptyChairId(userInfo.uid, userInfo.score < this.gameRule.scoreLowLimit);
	if(chairID < 0){
	    logger.debug("userEntryRoom", "not empty chair");
        return code.ROOM_PLAYER_COUNT_FULL;
    }
    // 将用户信息转化为对应俱乐部的信息
    if(this.creatorInfo.creatorType === enumeration.roomCreatorType.UNION_CREATE){
        userInfo = userInfoServices.buildGameRoomUserInfoWithUnion(userInfo, this.creatorInfo.unionID);
    } else {
        userInfo = userInfoServices.buildGameRoomUserInfoWithUnion(userInfo, 1);
    }
    if(!user) {
        // 非断线重连用户需检查是否有满足进入房间的条件
        let errCode = this.checkEntryRoom(userInfo);
        if (!!errCode){
            return errCode;
        }
        // 构建用户信息
        user = {};
        user.userInfo = userInfo;
        user.chairID = chairID;
        user.userStatus = roomProto.userStatusEnum.NONE;
        this.userArr[userInfo.uid] = user;
        this.currentUserCount++;

        // 更新用户信息
        let newUserData = await userDao.updateUserDataByUid(userInfo.uid, {roomID: this.roomID});
        userInfoServices.updateUserDataNotify(newUserData.uid, newUserData.frontendId, {roomID: newUserData.roomID}).catch(err=>{});

    }else{
	    // 更新用户信息
        user.userInfo = userInfo;
		if((user.userStatus & roomProto.userStatusEnum.OFFLINE) > 0) {
			user.userStatus &= ~roomProto.userStatusEnum.OFFLINE;
		}
		// 取消离线倒计时
        if (!!this.offlineSchedulerIDs[userInfo.uid]){
		    scheduler.cancelJob(this.offlineSchedulerIDs[userInfo.uid]);
		    delete this.offlineSchedulerIDs[userInfo.uid];
        }
    }
    // 修改房间用户session信息
    let session = await pomeloServices.getSession(userInfo.frontendId, userInfo.uid);
	if (!!session){
	    await pomeloServices.pushSessionData(session, 'roomID', this.roomID);
    } else{
	    logger.error("userEntryRoom", "获取session错误");
        return code.FAIL;
    }
    // 向其他玩家推送进入房间的消息
    let roomUserInfo = {
        userInfo: user.userInfo,
        userStatus: user.userStatus,
        chairID: user.chairID
    };
    let otherUserEntryRoomPush = roomProto.otherUserEntryRoomPush(roomUserInfo);
    this.sendRoomDataExceptUid(otherUserEntryRoomPush, [user.userInfo.uid]);
    // 推送玩家自己进入房间的消息
    pushAPI.selfEntryRoomPush(roomProto.selfEntryRoomPush(this.gameType), [{uid: user.userInfo.uid, sid: user.userInfo.frontendId}]);

    this.gameFrameSink.onEventUserEntry(user.chairID);
	this.addKickScheduleEvent(user.userInfo.uid);

	return code.OK;
};

/*
 * 能否进入游戏
 */
pro.canEnter = function () {
    let hasEmpty = this.hasEmptyChair();
    let canWatch = !!this.gameRule.canWatch;
    let canEnter = !!this.gameRule.canEnter && (this.gameType !== enumeration.gameType.PDK);
    if (this.hasStartedOneBureau){
        return (canEnter && (hasEmpty || (canWatch && this.currentUserCount < 20)));
    } else{
        return hasEmpty || (canWatch && this.currentUserCount < 20);
    }
/*	let canEnter = true;
	if (!this.gameRule.canWatch && (this.curBureau !== 0 || this.gameStarted) && !this.gameRule.canEnter) {
		canEnter = false;
	}
	if (this.gameRule.canEnter && !this.gameRule.canWatch) {
		let playCount = 0;
		for (let key in this.userArr) {
			if (this.userArr.hasOwnProperty(key)) {
				let user = this.userArr[key];
				if (user.chairID < this.chairCount) {
					++ playCount;
				}
			}
		}
		if (playCount >= this.chairCount) {
			canEnter = false;
		}
	}
	return canEnter;*/
};

pro.checkEntryRoom = function (userInfo) {
    // 普通房间
    if (this.creatorInfo.creatorType === enumeration.roomCreatorType.USER_CREATE){
        // 检查钻石是否足够
        if(this.gameRule.payType === enumeration.roomPayType.WOZHIFU){
            if (userInfo.uid === this.creatorInfo.uid){
                if (userInfo.gold < this.gameRule.payDiamond){
                    return code.NOT_ENOUGH_GOLD;
                }
            }
        }else{
            if (userInfo.gold < this.gameRule.payDiamond){
                return code.NOT_ENOUGH_GOLD;
            }
        }
    }
    // 俱乐部房间
    else{
        // 校验最低分数
        if (!this.gameRule.canWatch && userInfo.score < this.gameRule.scoreLowLimit){
            return code.NOT_ENOUGH_SCORE;
        }
        // 检测是否被禁止加入游戏
        if (!!userInfo.prohibitGame){
            return code.REQUEST_DATA_ERROR;
        }
    }
    // 防作弊模式，计算玩家距离，任意玩家距离差不能低于100米
    if(!!this.gameRule.fangzuobi){
        if (!userInfo.address || userInfo.address.length === 0){
            return code.CAN_NOT_ENTER_NOT_LOCATION;
        }
        let location = JSON.parse(userInfo.address);
        for(let key in this.userArr){
            if (this.userArr.hasOwnProperty(key)){
                if (utils.getDistanceByLocation(location, JSON.parse(this.userArr[key].userInfo.address)) < 0.1){
                    return code.CAN_NOT_ENTER_TOO_NEAR;
                }
            }
        }
    }
    return code.OK;
};


pro.getEmptyChairId = function (uid, isWatch) {
	if (this.userArr[uid]) {
		return this.userArr[uid].chairID;
	}
    isWatch = !!isWatch || this.hasStartedOneBureau;
	let usedArr = [];
	for (let key in this.userArr) {
		if(this.userArr.hasOwnProperty(key)) {
			usedArr.push(this.userArr[key].chairID);
		}
	}
    let chairID = !!isWatch?this.chairCount:0;
    while (usedArr.indexOf(chairID) !== -1) {
        ++ chairID;
    }
    return chairID;
	/*if (this.gameType == enumeration.gameType.PDK || (this.gameRule.canEnter && !this.gameRule.canWatch) || (this.curBureau == 0 && !this.gameStarted)) {
		let chairID = 0;
		while (usedArr.indexOf(chairID) != -1) {
			++ chairID;
		}
		return chairID;
	}
	else {
		let chairID = this.chairCount;
		while (usedArr.indexOf(chairID) != -1) {
			++ chairID;
		}
		return chairID;
	}*/
};

pro.hasEmptyChair = function () {
    let seatCount = 0;
    for (let key in this.userArr) {
        if(this.userArr.hasOwnProperty(key)) {
            if (this.userArr[key].chairID === -1) continue;
            seatCount ++;
        }
    }
    return seatCount < this.chairCount;
};

pro.getRoomSceneInfo = function (uid) {
    let user = this.userArr[uid];
    let userInfoArr = [];
    for(let key in this.userArr){
        if(this.userArr.hasOwnProperty(key)){
            let user1 = this.userArr[key];
            userInfoArr.push({
                userInfo: user1.userInfo,
                chairID: user1.chairID,
                userStatus: user1.userStatus
            });
        }
    }
    let gameData = this.gameFrameSink.getEnterGameData(user.chairID);
    this.sendRoomData(roomProto.getRoomSceneInfoPush(this.roomID, this.creatorInfo, this.gameRule, userInfoArr, gameData), [{uid:uid, sid:user.userInfo.frontendId}]);
	if (this.askForExitArr) {
		this.askForDismiss(uid, null).catch(err=>{logger.error(err.stack)});
	}
};

// ---------------------------------解散房间相关----------------------------------
/*
 * 玩家请求解散房间
 */
pro.askForDismiss = async function (uid, isExit) {
	if ([true, false, null].indexOf(isExit) === -1) { return; }
	let askUser = this.userArr[uid];
	if ((askUser.userStatus&roomProto.userStatusEnum.DISMISS) === 0 || askUser.chairID >= this.chairCount) {
        this.userLeaveRoomRequest(uid);
		return;
	}
	if (!this.askForExitArr && isExit === true) {
		this.askForExitArr = [];
		for (let i = 0; i < this.chairCount; ++i) {
			this.askForExitArr[i] = null;
		}

		this.dismissTick = roomProto.EXIT_WAIT_SECOND;
		this.answerExitSchedule = setInterval(() => {
			-- this.dismissTick;
			if (this.dismissTick === 0) {
				if (this.answerExitSchedule) {
					clearInterval(this.answerExitSchedule);
					this.answerExitSchedule = null;
				}
				for (let key in this.userArr) {
					if (this.userArr.hasOwnProperty(key)) {
						let user = this.userArr[key];
						if ((user.userStatus&roomProto.userStatusEnum.DISMISS) > 0 && user.chairID < this.chairCount) {
							this.askForDismiss(user.userInfo.uid, true).catch(e=>{logger.error(e.stack)});
						}
					}
				}
			}

		}, 1000);
	}

	if (!this.askForExitArr) { return; }
	if (this.askForExitArr[askUser.chairID] != null && isExit != null) { return; }
	if (isExit == true || isExit == false) {
		this.askForExitArr[askUser.chairID] = isExit;
	}

	let nameArr = [];
	let onlineArr = [];
	let avatarArr = [];
	for (let i = 0; i < this.chairCount; ++i) {
		nameArr[i] = null;
		onlineArr[i] = null;
		avatarArr[i] = null;
	}
	for (let key in this.userArr) {
		if (this.userArr.hasOwnProperty(key)) {
			let user = this.userArr[key];
			if ((user.userStatus&roomProto.userStatusEnum.DISMISS) > 0 && user.chairID < this.chairCount) {
				nameArr[user.chairID] = user.userInfo.nickname;
				onlineArr[user.chairID] = ((user.userStatus&roomProto.userStatusEnum.OFFLINE) == 0);
				avatarArr[user.chairID] = user.userInfo.avatar;
			}
		}
	}
	for (let key in this.userArr) {
		if (this.userArr.hasOwnProperty(key)) {
			let user = this.userArr[key];
			if ((user.userStatus&roomProto.userStatusEnum.DISMISS) > 0 && user.chairID < this.chairCount) {
				let senddata =roomProto.getAskForDismissPushData(this.askForExitArr, nameArr, null, this.dismissTick, askUser.chairID, onlineArr, avatarArr);
				this.sendRoomData(senddata, [{
					uid: user.userInfo.uid,
					sid: user.userInfo.frontendId,
				}]);
			}
		}
	}

	if (isExit == false) { /* 不同意直接取消解散申请 */ 
		if(this.answerExitSchedule) {
			clearInterval(this.answerExitSchedule);
			this.answerExitSchedule = null;
		}
		this.askForExitArr = null;
	}
	else if(isExit == true) {
		let playUserCount = 0;
		let agreeDismissCount = 0;
		for (let key in this.userArr) {
			if (this.userArr.hasOwnProperty(key)) {
				let user = this.userArr[key];
				if ((user.userStatus&roomProto.userStatusEnum.DISMISS) > 0 && user.chairID < this.chairCount) {
					++ playUserCount;
					if (this.askForExitArr[user.chairID]) {
						++ agreeDismissCount;
					}
				}
			}
		}
		if (playUserCount == agreeDismissCount) {
			if(this.answerExitSchedule) {
				clearInterval(this.answerExitSchedule);
				this.answerExitSchedule = null;
			}
			await this.dismissRoom(enumeration.gameRoomDismissReason.USER_DISMISS);
		}
	}
};

/*
 * 玩家换座位
 */
pro.userChangeSeat = function (uid, fromChairID, toChairID) {
    if (typeof fromChairID !== 'number' || typeof toChairID !== 'number') return;
    if (fromChairID < 0 || toChairID < 0) return;
    if (fromChairID === toChairID) return;

	let user = this.userArr[uid];
    if (!user || user.chairID !== fromChairID) {
        return;
    }
	if (!this.gameStarted && (user.userStatus&roomProto.userStatusEnum.READY) != 0) {
		user.userStatus &= ~roomProto.userStatusEnum.READY;
	}
    // 正在游戏时的玩家不能换座位
	if ((user.userStatus & roomProto.userStatusEnum.PLAYING) !== 0) {
        logger.warn("userChangeSeat user playing");
	    return;
    }
    // 目标位置如果有人，也不能换座位
    let toUser = this.getUserByChairID(toChairID);
    if (!!toUser){
        logger.warn("chair not empty");
        return;
    }
    // 如果是入座，需要判断玩家是否有足够金币
    if (toChairID < this.chairCount && user.userInfo.score < this.gameRule.scoreLowLimit){
        return;
    }
	user.chairID = toChairID;
	this.sendRoomData(roomProto.getUserChangeSeatPush(fromChairID, toChairID, uid));
};

/*
 * 玩家聊天
 */
pro.userChat = function(uid, toChairID, msg) {
	let user = this.userArr[uid];
	if (!user) { return; }
	let fromChairID = user.chairID;
	this.sendRoomData(roomProto.userChatPush(fromChairID, toChairID, msg));
};

// ---------------------------------离开房间相关----------------------------------
pro.userLeaveRoomRequest = function (uid) {
    logger.debug("roomFrame", "userLeaveRoomRequest uid:" + uid);
    let user = this.userArr[uid] || null;
    if (this.gameStarted && (user.userStatus & roomProto.userStatusEnum.PLAYING) !== 0 && this.gameFrameSink && !this.gameFrameSink.isUserEnableLeave(user.chairID)){
        this.sendPopDialogContent(code.CAN_NOT_LEAVE_ROOM, [user.chairID]);
        let response = roomProto.userLeaveRoomResponse(user.chairID);
        this.sendRoomDataToAll(response);
    }else{
        this.userLeaveRoom(uid).catch((err)=>{logger.error(new Error(err.stack));});
    }
};

pro.userLeaveRoom = async function (uid){
    logger.debug("roomFrame", "userLeaveRoom uid:" + uid);
    let user = this.userArr[uid] || null;
    if (!user) {
        logger.warn("roomFrame", "userLeaveRoom user not exist uid:" + uid);
        return;
    }
    this.sendRoomDataToAll(roomProto.userLeaveRoomResponse(user.chairID));

    if (this.gameStarted && (user.userStatus & roomProto.userStatusEnum.PLAYING) !== 0){
        if (this.gameFrameSink.isUserEnableLeave(user.chairID)){
            await this.kickUser(uid);
        }else{
            user.userStatus |= roomProto.userStatusEnum.OFFLINE;
            if (this.roomType !== enumeration.roomType.HUNDRED){
                this.sendRoomDataToAll(roomProto.userOffLinePush(user.chairID));
            }
            this.gameFrameSink.onEventUserOffLine(user.chairID);
        }
    }else{
        await this.kickUser(uid);
    }
	if(this.efficacyStartGame()) {
		this.startGame().catch(e=>{logger.error(e.stack)});
	}
    // 判断房间是否解散
    if(this.efficacyDismissRoom()) {
		await this.dismissRoom(enumeration.gameRoomDismissReason.NONE);
    }
};

pro.userLeaveRoomNotify = async function (uidAndSidArr) {
    for (let i = 0; i < uidAndSidArr.length; ++i) {
        let uidAndSid = uidAndSidArr[i];
        let updateUserData = {
            roomID: ""
        };
        await userDao.updateUserDataByUid(uidAndSid.uid, updateUserData);
        if (!uidAndSid.sid) continue;
        let session = await pomeloServices.getSession(uidAndSid.sid, uidAndSid.uid);
        if (!session) return;
        await pomeloServices.pushSessionData(session, "roomID", null);
        userInfoServices.updateUserDataNotify(uidAndSid.uid, uidAndSid.sid, {roomID:""}).catch((err)=>{logger.error(err.stack)});
    }
};

pro.kickUser = async function(uid) {
    logger.debug("roomFrame", "kickUser uid:" + uid);
    let user = this.userArr[uid] || null;
    if(!!user) {
        // 通知游戏，用户离开
        if(this.gameStarted) this.gameFrameSink.onEventUserLeave(user.chairID);
        // 玩家离开房间，修改玩家信息
        await this.userLeaveRoomNotify([{uid: uid, sid: user.userInfo.frontendId}]).catch(err=>{logger.error(err.stack)});

		let userRoomInfo = {
			userInfo: user.userInfo,
			chairID: user.chairID
		};
        let otherUserLeavePush = roomProto.userLeaveRoomPush(userRoomInfo);
        this.sendRoomDataToAll(otherUserLeavePush);
		delete this.userArr[uid];
		-- this.currentUserCount;
		// 停止定时器
        if (!!this.offlineSchedulerIDs[uid] || this.offlineSchedulerIDs[uid] === 0){
            scheduler.cancelJob(this.offlineSchedulerIDs[uid]);
            delete this.offlineSchedulerIDs[uid];
        }
        // 判断启动定时器
        if (!!this.startSchedulerID && !this.isShouldSchedulerStart()){
            clearInterval(this.startSchedulerID);
            this.startSchedulerID = null;
        }
	}
};

pro.userOffLine = async function (uid){
    logger.debug("roomFrame", "userOffLine uid:" + uid);
	let user = this.userArr[uid];
	if (!user) {
        logger.warn('roomFrame', "userOffLine user not exist uid:" + uid);
        return;
    }
	if ((!this.gameStarted && this.curBureau === 0) || (user.userStatus&roomProto.userStatusEnum.DISMISS) == 0) { /* 没有参加游戏 */
        await this.userLeaveRoom(uid);
    }
	else {
		user.userStatus |= roomProto.userStatusEnum.OFFLINE;
		this.sendRoomDataToAll(roomProto.userOffLinePush(user.chairID));
	}
};

// ---------------------------------解散房间相关----------------------------------
pro.efficacyDismissRoom = function () {
    if (this.roomDismissed) return false;
    return this.currentUserCount === 0;
};

pro.dismissRoom = async function(reason) {
    if (this.roomDismissed) return;         // 防止重复解散
    logger.debug("roomFrame", "dismissRoom roomID:" + this.roomID);
    this.roomDismissed = true;

    if (!!this.startSchedulerID){
        clearInterval(this.startSchedulerID);
        this.startSchedulerID = null;
    }

    for (let key in this.kickSchedules) {
        clearTimeout(this.kickSchedules[key]);
        delete this.kickSchedules[key];
    }

    try {
        this.createHongBaoList();
        // 获取并存储游戏数据
        await this.recordAllDrawResult();
    } catch (e){
        logger.error(e.stack);
    }

    if (this.currentUserCount === 0 ||
        reason === enumeration.gameRoomDismissReason.UNION_OWNER_DISMISS ||
        this.creatorInfo.creatorType === enumeration.roomCreatorType.USER_CREATE ||
        (reason === enumeration.gameRoomDismissReason.USER_DISMISS && !this.hasFinishedOneBureau)
    ){
        let uidAndSidArr = [];
        for(let key in this.userArr){
            if(this.userArr.hasOwnProperty(key)){
                let user = this.userArr[key];
                uidAndSidArr.push({uid:user.userInfo.uid, sid: user.userInfo.frontendId});
            }
        }
        this.userLeaveRoomNotify(uidAndSidArr).catch((err)=>{logger.error(err.stack);});
        pomelo.app.unionManager.dismissRoom(this.roomID);
        this.destroyRoom(reason);
        this.sendRoomDataToAll(roomProto.roomDismissPush(reason));
    } 
	else {
        // 清除掉线玩家
		await this.clearOfflineUser();

		if (this.currentUserCount === 0){
            pomelo.app.unionManager.dismissRoom(this.roomID);
            this.destroyRoom(reason);
            return;
        }

        // 通知更新用户信息
        this.notifyUpdateAllUserInfo();

        this.destroyRoom(reason);

        this.sendRoomDataToAll(roomProto.roomDismissPush(reason));
		this.resetRoom(reason);
    }
    /*return;

	// 更新用户信息
    let uidAndSidArr = [];
    for(let key in this.userArr){
	    if(this.userArr.hasOwnProperty(key)){
	        let user = this.userArr[key];
            uidAndSidArr.push({uid:user.userInfo.uid, sid: user.userInfo.frontendId});
        }
    }
    this.userLeaveRoomNotify(uidAndSidArr).catch((err)=>{console.error(new Error(err));});
    // 解散房间
    pomelo.app.unionManager.dismissRoom(this.roomID);*/

};

pro.destroyRoom = function(reason) {
    if(this.answerExitSchedule) {
        scheduler.cancelJob(this.answerExitSchedule);
    }

    logger.debug("roomFrame", "destroyRoom roomID:" + this.roomID);
    this.gameFrameSink.onEventRoomDismiss(reason);
    this.gameFrameSink = null;
};

pro.ownUser = function(uid) {
    let userArr = this.userArr;
	for (let key in  userArr){
		if(userArr.hasOwnProperty(key) && (userArr[key].userInfo.uid === uid)){
			return true;
		}
	}
	return false;
};

// ---------------------------------房间接口相关----------------------------------
pro.getUserByChairID = function(chairID){
    let userArr = this.userArr;
    for (let key in  userArr){
          if(userArr.hasOwnProperty(key) && (userArr[key].chairID === chairID)){
            return userArr[key];
        }
    }
    return null;
};

pro.getCurrentUserCount = function() {
	return this.currentUserCount;
};

pro.isShouldDelete = function(time){
    return (Date.now() - this.lastNativeTime >= time);
};

pro.getRoomInfo = function () {
    if (this.roomDismissed) return null;
    let roomUserInfoArr = [];
    for (let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            let user = this.userArr[key];
            if (user.chairID >= this.chairCount) continue;
            roomUserInfoArr.push({
                avatar: user.userInfo.avatar,
                nickname: user.userInfo.nickname,
                winScore: user.winScore || 0
            });
        }
    }
    return {
        roomID: this.roomID,
        gameRule: this.gameRule,
        gameStarted: this.hasStartedOneBureau,
        curBureau: this.curBureau,
        roomUserInfoArr: roomUserInfoArr
    }
};

pro.isUserInRoom = function (uid) {
    if (this.roomDismissed) return false;
    return !!this.userArr[uid];
};

/* 正在解散中 */
pro.isDismissing = function () {
	return !!this.askForExitArr;
};

pro.addKickScheduleEvent = function (uid) {
	if (this.hasStartedOneBureau) return;
	if (this.kickSchedules[uid]) {
		clearTimeout(this.kickSchedules[uid]);
		delete this.kickSchedules[uid];
	}
	this.kickSchedules[uid] = setTimeout(async () => {
		if (this.kickSchedules[uid]) {
			delete this.kickSchedules[uid];
		}
		let user = this.userArr[uid];
		if (!this.hasStartedOneBureau && user && ((user.userStatus&roomProto.userStatusEnum.READY) === 0)) {
			await this.kickUser(uid).catch(e=>{logger.error(e.stack)});

            if(this.efficacyStartGame()) {
                this.startGame().catch(e=>{logger.error(e.stack)});
            }
            // 判断房间是否解散
            if(this.efficacyDismissRoom()) {
                await this.dismissRoom(enumeration.gameRoomDismissReason.NONE);
            }
		}
	}, 30*1000);
};

pro.createHongBaoList = function () {
    let status = !!this.resultLotteryInfo && !!this.resultLotteryInfo.status;
    let arr = [];
    let countArr = (!!this.resultLotteryInfo.countArr && this.resultLotteryInfo.countArr.length === 6) ? this.resultLotteryInfo.countArr:[1,2 ,8,18, 88,888];
    let rateArr = (!!this.resultLotteryInfo.rateArr && this.resultLotteryInfo.rateArr.length === 6) ? this.resultLotteryInfo.rateArr:[0.34, 0.60, 0.05, 0.009, 0.001, 0];

    for (let i = 0; i < 10; ++i){
        if (!status) {
            arr.push(-1);
            continue;
        }
        let user = this.getUserByChairID(i);
        if (!user){
            arr.push(-1);
            continue;
        }
        let uid = user.userInfo.uid;
        if (this.userJoinGameBureau[uid] > 0 && this.userJoinGameBureau[uid] >= this.gameRule.bureau - 3){
            let count = countArr[0];
            let rand = Math.random();
            for (let j = 0; j < rateArr.length; ++j){
                if (rand < rateArr[j]){
                    count = countArr[j];
                    break;
                } else{
                    rand -= rateArr[j];
                }
            }
            arr.push(count);
        }else{
            arr.push(-1);
        }
    }
    this.userGetHongBaoCountArr = arr;
};

pro.getHongBaoList = function () {
    return this.userGetHongBaoCountArr;
};

pro.updateLotteryInfo = function(resultLotteryInfo) {
    this.resultLotteryInfo = resultLotteryInfo;
};
