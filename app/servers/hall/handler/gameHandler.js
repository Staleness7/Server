 let code = require('../../../constant/code');
let async = require('async');
let rpcAPI = require('../../../API/rpcAPI');
let dispatch = require('../../../util/dispatcher');
let userInfoServices = require('../../../services/userInfoServices');
let pomeloServices = require('../../../services/pomeloServices');
let roomServices = require('../../../services/roomServices');
let logger = require('pomelo-logger').getLogger('logic');
let userDao = require('../../../dao/userDao');
let utils = require('../../../util/utils');

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.joinRoom = async function(msg, session, next) {
    logger.debug('gameHandler', 'joinRoom');
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    let roomID = parseInt(msg.roomID);
    if (!roomID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    try {
        let userData = await userDao.getUserDataByUid(session.uid);
        if (!userData){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        let oldRoomID = session.get('roomID');
        if (!!oldRoomID && roomID !== oldRoomID){
            let gameServer = dispatch.dispatch(oldRoomID, this.app.getServersByType('game'));
            let isIn = await rpcAPI.isUserInRoom(gameServer.id, session.uid, oldRoomID);
            if(!!isIn) {
                roomID = oldRoomID;
            }
        }
        let gameServer = dispatch.dispatch(roomID, this.app.getServersByType('game'));
        let resCode = await rpcAPI.joinRoom(gameServer.id, userInfoServices.buildGameRoomUserInfo(userData), roomID);

        next(null, {code:resCode});
    }catch (err){
        logger.error(err.stack);
        next(null, {code: typeof err === 'number'?err: 500});
    }
};

Handler.prototype.createRoom = async function(msg, session, next) {
    logger.debug('gameHandler', 'createRoom');
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    let gameRule = msg.gameRule;
    // 检查创建参数有效性
    // 获取用户信息
    let userData = await userDao.getUserDataByUid(session.uid);
    if (!userData){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    let gameServers = this.app.getServersByType('game');
    let oldRoomID = session.get('roomID');
    if (!!oldRoomID){
        let gameServer = dispatch.dispatch(oldRoomID, gameServers);
        let isUserInRoom = await rpcAPI.isUserInRoom(gameServer.id, session.uid, oldRoomID);
        if (!!isUserInRoom){
            next(null, {code: code.FAIL});
            return;
        }
    }
    let gameServer = dispatch.dispatch(utils.getRandomNum(0, gameServers.length - 1), gameServers);
    await rpcAPI.createRoom(gameServer.id, userInfoServices.buildGameRoomUserInfo(userData), gameRule, msg.gameType);
    next(null, {code:code.OK});
 };
