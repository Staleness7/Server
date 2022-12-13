let code = require('../../../constant/code');
let scheduler = require('pomelo-scheduler');
let RoomFrame = require('../../../gameComponent/roomFrame');
let utils = require('../../../util/utils');
let enumeration = require('../../../constant/enumeration');
let commonDao = require('../../../dao/commonDao');
let userDao = require('../../../dao/userDao');
let unionManager = require('./unionManager');
let logger = require('pomelo-logger').getLogger("logic");

class union {
    constructor(unionID){
        this.unionID = unionID;
        this.roomList = {};
        this.activeTime = Date.now();

        this.unionData = null;
    }

    // 初始化
    async init(){
        // 特殊unionID 1，表示普通创建房间，并入到特殊联盟中进行统一管理
        if (this.unionID !== 1){
            // 缓存数据
            this.unionData = await commonDao.findOneData("unionModel", {unionID: this.unionID});
        }
    }

    async onDestroy(){
        for (let roomID in this.roomList){
            let room = this.roomList[roomID];
            if (!room) return;
            await room.dismissRoom(enumeration.gameRoomDismissReason.UNION_OWNER_DISMISS).catch(e=>{logger.error(e.stack)});
        }
    }

    /****************************** 俱乐部信息 ***************************/
    // 获取俱乐部信息
    getUnionInfo(uid){
        this.activeTime = Date.now();
        let unionData = utils.clone(this.unionData);
        if (uid !== this.unionData.ownerUid){
            delete unionData['joinRequestList'];
        }
        return unionData;
    }

    // 获取房间列表
    getUnionRoomList(){
        this.activeTime = Date.now();
        let list = [];
        for (let key in this.roomList){
            if (this.roomList.hasOwnProperty(key)){
                let roomInfo = this.roomList[key].getRoomInfo();
                if (!!roomInfo){
                    list.push(this.roomList[key].getRoomInfo());
                }
            }
        }
        return list;
    }

    // 获取创建者
    getOwnerUid(){
        if (!this.unionData) return 0;
        else return this.unionData.ownerUid;
    }

    // 更新通知
    async updateUnionNotice(notice){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        if (this.unionData.notice === notice) return;
        await commonDao.updateData('unionModel', {unionID: this.unionID}, {notice: notice});
        this.unionData.notice = notice;
    }

    // 转移联盟
    async transferUnion(transferUid){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        await commonDao.updateData('unionModel', {unionID: this.unionID}, {ownerUid: transferUid});
        this.unionData.ownerUid = transferUid;
    }

    // 修改联盟名字
    async updateUnionName(unionName){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        if (this.unionData.unionName === unionName) return;
        await commonDao.updateData('unionModel', {unionID: this.unionID}, {unionName: unionName});
        this.unionData.unionName = unionName;
    }

    // 修改公告开关
    async updatePartnerNoticeSwitch(isOpen){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        if (this.unionData.noticeSwitch === isOpen) return;
        await commonDao.updateData('unionModel', {unionID: this.unionID}, {noticeSwitch: isOpen});
        this.unionData.unionName = unionName;
    }

    async updateHongBaoSetting(status, startTime, endTime, count, totalScore){
        if (!this.unionData){
            return code.FAIL;
        }
        let hongBaoInfo = {
            status: status,
            startTime: startTime,
            endTime: endTime,
            count: count,
            totalScore: totalScore
        };
        let updateInfo = {
            hongBaoInfo: hongBaoInfo
        };
        // 关闭红包时，清除所有红包
        if (!status){
            this.unionData.hongBaoScoreList = [];
            this.unionData.hongBaoUidList = [];
            updateInfo.hongBaoScoreList = [];
            updateInfo.hongBaoUidList = [];
        } else{
            // 红包数为零时重新分派红包
            if (this.unionData.hongBaoScoreList.length === 0){
                // 设置红包分数
                this.unionData.hongBaoScoreList = utils.randomRedPacket(hongBaoInfo.totalScore, hongBaoInfo.count);
                this.unionData.hongBaoUidList = [];
                updateInfo.hongBaoUidList = this.unionData.hongBaoScoreList;
                updateInfo.hongBaoUidList = [];
            } else{
                return code.CAN_NOT_CREATE_NEW_HONG_BAO;
            }
        }
        await commonDao.updateData('unionModel', {unionID: this.unionID}, updateInfo);
        this.unionData.hongBaoInfo = hongBaoInfo;
        return code.OK;
    }

    async getHongBao(uid){
        // 检查当前是否可以领取
        if (!this.unionData){
            logger.error("getHongBao", "unionData not exist");
            return -1;
        }
        let hongBaoInfo = this.unionData.hongBaoInfo;
        if (!hongBaoInfo || !hongBaoInfo.status) return -1;
        let date = new Date();
        let time = date.getHours();
        if (time < hongBaoInfo.startTime || time >= hongBaoInfo.endTime) return -1;
        if (hongBaoInfo.totalScore <= 0 || hongBaoInfo.count <= 0) return -1;
        // 用户领取
        if (this.unionData.hongBaoScoreList.length === 0) return 0;
        if (this.unionData.hongBaoUidList.indexOf(uid) !== -1) return 0;
        let score = this.unionData.hongBaoScoreList.shift();
        this.unionData.hongBaoUidList.push(uid);
        // 记录用户分数变化
        // 更新用户
        let saveData = {
            $inc:{
                "unionInfo.$.score": score
            }
        };
        let newUserData = await userDao.updateUserData({uid: uid, "unionInfo.unionID": this.unionID}, saveData);

        // 存储分数变化记录
        let newUnionInfo = newUserData.unionInfo.find(function (e) {
            return e.unionID === this.unionID;
        }.bind(this));
        if (!newUnionInfo) return -1;
        let scoreChangeRecord = {
            uid: uid,
            nickname: newUserData.nickname,
            unionID: this.unionID,
            changeCount: score,
            leftCount: newUnionInfo.score,
            leftSafeBoxCount: newUnionInfo.safeScore,
            changeType: enumeration.scoreChangeType.NONE,
            describe: "领取红包:" + score,
            createTime: Date.now()
        };
        commonDao.createData("userScoreChangeRecordModel", scoreChangeRecord).catch(e=>{logger.error(e.stack)});

        commonDao.updateData('unionModel', {unionID: this.unionID}, {hongBaoScoreList: this.unionData.hongBaoScoreList, $push: {hongBaoUidList: uid}}).catch(e=>{logger.error(e.stack)});

        return {score: score, updateUserData: {unionInfo: newUserData.unionInfo}};
    }

    // 修改营业状态
    async updateOpeningStatus(isOpen){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        if (this.unionData.opening === isOpen) return;
        await commonDao.updateData('unionModel', {unionID: this.unionID}, {opening: isOpen});
        this.unionData.opening = isOpen;
    }

    async updateLotteryStatus(isOpen){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        if (!this.unionData.resultLotteryInfo) this.unionData.resultLotteryInfo = {};
        if (this.unionData.resultLotteryInfo.status === isOpen) return;
        this.unionData.resultLotteryInfo.status = isOpen;
        await commonDao.updateData('unionModel', {unionID: this.unionID}, {resultLotteryInfo: this.unionData.resultLotteryInfo});

        // 更新所有房间状态
        for (let key in this.roomList){
            if (this.roomList.hasOwnProperty(key)){
                let room = this.roomList[key];
                room.updateLotteryInfo(this.unionData.resultLotteryInfo);
            }
        }
    }

    getLotteryStatus() {
        if (!this.unionData) return {};
        return this.unionData.resultLotteryInfo || {};
    }

    // 更新联盟状态
    async updateStatus(){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        let unionData = await commonDao.findOneData('unionModel', {unionID: this.unionID});
        if (!unionData){
            throw new Error(code.FAIL);
        }
        this.unionData.showRank = !!unionData.showRank;
        this.unionData.showUnionActive = !!unionData.showUnionActive;
        this.unionData.showSingleRank = !!unionData.showSingleRank;
        this.unionData.forbidInvite = !!unionData.forbidInvite;
        this.unionData.forbidGive = !!unionData.forbidGive;
    }

    // 添加房间规则
    async addRoomRuleList(roomRule, ruleName, gameType){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        let info = {
            gameRule: JSON.stringify(roomRule),
            ruleName: ruleName,
            gameType: gameType
        };
        let data = await commonDao.findOneAndUpdate('unionModel', {unionID: this.unionID}, {$push: {roomRuleList: info}});
        let roomRuleList = [];
        for (let i = 0; i < data.roomRuleList.length; ++i){
            roomRuleList.push(data.roomRuleList[i]._doc);
        }
        this.unionData.roomRuleList = roomRuleList;
    }

    // 添加房间规则
    async updateRoomRuleList(_id, roomRule, ruleName, gameType){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        let info = {
            "roomRuleList.$.gameRule": JSON.stringify(roomRule),
            "roomRuleList.$.ruleName": ruleName,
            "roomRuleList.$.gameType": gameType
        };
        let data = await commonDao.findOneAndUpdate('unionModel', {unionID: this.unionID, "roomRuleList._id": _id}, info);
        let roomRuleList = [];
        for (let i = 0; i < data.roomRuleList.length; ++i){
            roomRuleList.push(data.roomRuleList[i]._doc);
        }
        this.unionData.roomRuleList = roomRuleList;
    }

    // 删除房间规则
    async removeRoomRuleList(ruleID){
        if (!this.unionData){
            throw new Error(code.FAIL);
        }
        let data = await commonDao.findOneAndUpdate('unionModel', {unionID: this.unionID}, {$pull: {roomRuleList: {_id: ruleID}}});
        let roomRuleList = [];
        for (let i = 0; i < data.roomRuleList.length; ++i){
            roomRuleList.push(data.roomRuleList[i]._doc);
        }
        this.unionData.roomRuleList = roomRuleList;
    }

    async dismissRoom(roomID) {
        let room = this.roomList[roomID];
        if (!room) return;
        await room.dismissRoom(enumeration.gameRoomDismissReason.UNION_OWNER_DISMISS).catch(e=>{logger.error(e.stack)});
    }


    /************************* 房间相关接口 **************************/
    // 创建房间
    async createRoom(ruleID, gameRule, userInfo){
        // 俱乐部房间，则判断该玩家是否在该俱乐部
        if (this.unionID !== 1){
            if (!this.unionData.opening){
                return code.REQUEST_DATA_ERROR;
            }
            let item = userInfo.unionInfo.find(function (ele) {
                return ele.unionID === this.unionID;
            }.bind(this));
            if (!item) return code.REQUEST_DATA_ERROR;
        }
        this.activeTime = Date.now();
        if (!!ruleID){
            let roomRuleItem = null;
            for (let i = 0; i < this.unionData.roomRuleList.length; ++i){
                if (this.unionData.roomRuleList[i]._id.toString() === ruleID){
                    roomRuleItem = this.unionData.roomRuleList[i];
                    break;
                }
            }
            if (!roomRuleItem){
                return code.ROOM_NOT_EXIST;
            }
            gameRule = JSON.parse(roomRuleItem.gameRule);
            gameRule.gameType = roomRuleItem.gameType;
            gameRule.ruleName = roomRuleItem.ruleName;
            gameRule._id = roomRuleItem._id.toString();
            // 查询是否有10秒中之内刚创建的同类房间,有则直接加入
            for (let key in this.roomList){
                if (this.roomList.hasOwnProperty(key)){
                    let room = this.roomList[key];
                    if (room.gameRule._id === ruleID && this.activeTime - room.createTime < 10000 && room.hasEmptyChair()){
                        return await this.joinRoom(room.roomID, userInfo);
                    }
                }
            }
        }

        // 创建房间
        let roomID = unionManager.createNewRoomID();
        let creatorInfo = null;
        if (this.unionID === 1){
            creatorInfo = {
                creatorType: enumeration.roomCreatorType.USER_CREATE,
                uid: userInfo.uid
            }
        } else{
            creatorInfo = {
                creatorType: enumeration.roomCreatorType.UNION_CREATE,
                unionID: this.unionID
            };
        }
        let roomFrame = new RoomFrame(roomID, creatorInfo, gameRule);
        this.roomList[roomID] = roomFrame;
        roomFrame.updateLotteryInfo(this.getLotteryStatus());
        return await roomFrame.userEntryRoom(userInfo);
    }

    // 加入房间
    async joinRoom(roomID, userInfo){
        // 俱乐部房间，则判断该玩家是否在该俱乐部
        if (this.unionID !== 1){
            let item = userInfo.unionInfo.find(function (ele) {
                return ele.unionID === this.unionID;
            }.bind(this));
            if (!item) return code.NOT_IN_UNION;
        }

        this.activeTime = Date.now();

        let roomFrame = this.roomList[roomID];
        if (!roomFrame) return code.ROOM_NOT_EXIST;
        return await roomFrame.userEntryRoom(userInfo);
    }

    async quickJoin(ruleID, userInfo){
        this.activeTime = Date.now();
        let roomRuleItem = null;
        for (let i = 0; i < this.unionData.roomRuleList.length; ++i){
            if (this.unionData.roomRuleList[i]._id.toString() === ruleID){
                roomRuleItem = this.unionData.roomRuleList[i];
                break;
            }
        }
        if (!roomRuleItem){
            return code.ROOM_NOT_EXIST;
        }
        // 如果有现有房间则直接
        for (let key in this.roomList){
            if (this.roomList.hasOwnProperty(key)){
                let room = this.roomList[key];
                if (room.gameRule._id === ruleID && room.canEnter() && room.hasEmptyChair()){
                    return await this.joinRoom(room.roomID, userInfo);
                }
            }
        }

        // 创建房间
        let roomID = unionManager.createNewRoomID();
        let creatorInfo = null;
        if (this.unionID === 1){
            creatorInfo = {
                creatorType: enumeration.roomCreatorType.USER_CREATE,
                uid: userInfo.uid
            }
        } else{
            creatorInfo = {
                creatorType: enumeration.roomCreatorType.UNION_CREATE,
                unionID: this.unionID
            };
        }
        let gameRule = JSON.parse(roomRuleItem.gameRule);
        gameRule.gameType = roomRuleItem.gameType;
        gameRule.ruleName = roomRuleItem.ruleName;
        gameRule._id = roomRuleItem._id.toString();
        let roomFrame = new RoomFrame(roomID, creatorInfo, gameRule);
        this.roomList[roomID] = roomFrame;
        roomFrame.updateLotteryInfo(this.getLotteryStatus());
        return await roomFrame.userEntryRoom(userInfo);
    }

    // 销毁房间
    destroyRoom(roomID){
        delete this.roomList[roomID];
    }

    // 获取房间
    getRoomByID(roomID){
        return this.roomList[roomID];
    }

    isOpening(){
        return !!this.unionData && this.unionData.opening;
    }

    // 获取上次活跃时间
    getLastActiveTime(){
        return this.activeTime;
    }

    isShouldDelete(time){
        return (utils.getLength(this.roomList) === 0 && this.activeTime - Date.now() > time)
    }

    dailyClear(){
        if (!this.unionData) return;
        if (!!this.unionData.hongBaoInfo){
            if (this.unionData.hongBaoInfo.hongBaoScoreList.length !== 0 || this.unionData.hongBaoInfo.hongBaoUidList.length !== 0){
                this.unionData.hongBaoInfo.hongBaoScoreList = [];
                this.unionData.hongBaoInfo.hongBaoUidList = [];

            }
            commonDao.updateData('unionModel', {unionID: this.unionID}, {hongBaoUidList:[], hongBaoScoreList: []}).catch(e=>{logger.error(e.stack)});
        }
    }
}
module.exports = union;
