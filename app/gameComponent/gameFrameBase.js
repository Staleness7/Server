let roomProto = require('../API/Protos/RoomProto');
let pushAPI = require('../API/pushAPI');
let logger = require('pomelo-logger').getLogger('game');

let gameFrameBase = function(roomFrame) {
    this.roomFrame = roomFrame;
    this.publicParameter = this.roomFrame.publicParameter;
    this.userArr = this.roomFrame.userArr;
};
let pro = gameFrameBase.prototype;

/**
 * 收到消息
 * @param chairID
 * @param msg
 */
pro.receivePlayerMessage = function(chairID, msg){};
/**
 * 发送消息
 * @param msg
 * @param chairIDArr
 */
pro.sendData = function (msg, chairIDArr) {
    if(!chairIDArr){
        chairIDArr = [];
        for (let key in this.userArr){
            if(this.userArr.hasOwnProperty(key)){
                chairIDArr.push(this.userArr[key].chairID);
            }
        }
    }
    let uidAndFrontendIdArr = [];
    for (let i = 0; i < chairIDArr.length; ++i){
        let user = this.getUserByChairID( chairIDArr[i]);
        if(!!user && (user.userStatus&roomProto.userStatusEnum.OFFLINE) === 0){
            uidAndFrontendIdArr.push({uid: user.userInfo.uid, sid: user.userInfo.frontendId});
        }
    }
    if(uidAndFrontendIdArr.length === 0) return;
    logger.debug ("roomFrame", 'send game Data:' + JSON.stringify(msg));
    pushAPI.gameMessagePush(msg, uidAndFrontendIdArr).catch(function(err){
        logger.error(new Error(err));
    });
};

/**
 * 向所有玩家发送消息
 * @param msg
 */
pro.sendDataToAll = function (msg){
    this.sendData(msg, null);
};

/**
 * 发送消息，除去某玩家
 * @param msg
 * @param exceptChairIDArr
 */
pro.sendDataExceptChairIDs = function (msg, exceptChairIDArr) {
    let allChairIDArr = [];
    for(let key in this.userArr){
        if (this.userArr.hasOwnProperty(key)){
            let user = this.userArr[key];
            if (exceptChairIDArr.indexOf(user.chairID) !== -1) continue;
            allChairIDArr.push(user.chairID);
        }
    }
    this.sendData(msg, allChairIDArr);
};

/**
 * 获取用户信息
 * @param chairID
 * @returns {*}
 */
pro.getUserByChairID = function (chairID) {
    return this.roomFrame.getUserByChairID(chairID);
};

/**
 * 获取用户进入房间信息
 * @param chairID
 */
pro.getEnterGameData = function(chairID) {};

/**
 * 游戏准备时间
 */
pro.onEventGamePrepare = function() {};

/**
 * 游戏开始事件
 */
pro.onEventGameStart = function() {};

/**
 * 用户进入事件
 * @param chairID
 */
pro.onEventUserEntry = function(chairID) {};

/**
 * 用户离开事件
 * @param chairID
 */
pro.onEventUserLeave = function(chairID) {};

/**
 * 用户是否可以离开
 * @param chairID
 */
pro.isUserEnableLeave = function(chairID) {};

/**
 * 用户掉线时间
 * @param chairID
 */
pro.onEventUserOffLine = function(chairID) {};

/**
 * 房间解散事件
 */
pro.onEventRoomDismiss = function() {};

/*
 * 游戏结束后
 * 获取房间当前局的游戏数据
 * @return [{
 *	cards: 手牌
 *	score: 输赢分
 *	uid: 玩家uid
 *	cardType: 牌类型
 * }]
 */
pro.getGameBureauData = function () {};

pro.getGameVideoData = function () {return null};

module.exports = gameFrameBase;
