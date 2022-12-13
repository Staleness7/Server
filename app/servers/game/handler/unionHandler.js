let code = require('../../../constant/code');
let unionManager = require('../domain/unionManager');
let userDao = require('../../../dao/userDao');
let rpcAPI = require('../../../API/rpcAPI');
let dispatch = require('../../../util/dispatcher');
let userInfoServices = require('../../../services/userInfoServices');
let logger = require('pomelo-logger').getLogger("logic");

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.getUnionInfo = async function (msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.getUnionRoomList = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    next(null, {code: code.OK, msg: {roomList: union.getUnionRoomList()}});
};

Handler.prototype.createRoom = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || (!msg.gameRuleID && !msg.gameRule)){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    try {
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

        let union = await unionManager.getUnion(msg.unionID);
        let resCode = await union.createRoom(msg.gameRuleID, msg.gameRule, userInfoServices.buildGameRoomUserInfo(userData));
        next(null, {code: resCode});
    }catch (e){
        if (typeof e === 'number'){
            logger.error("createRoom code:" + e);
            next(null, {code: e});
        }else{
            logger.error(e.stack);
            next(null, {code: 500});
        }
    }
};

Handler.prototype.quickJoin = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    try {
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

        let union = await unionManager.getUnion(msg.unionID);
        let resCode = await union.quickJoin(msg.gameRuleID, userInfoServices.buildGameRoomUserInfo(userData));
        next(null, {code: resCode});
    }catch(e){
        if (typeof e === 'number'){
            logger.error("quickJoin code:" + e);
            next(null, {code: e});
        }else{
            logger.error(e.stack);
            next(null, {code: 500});
        }
    }
};

// 领取红包
Handler.prototype.getHongBao = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    try {
        let union = await unionManager.getUnion(msg.unionID);
        let res = await union.getHongBao(session.uid);
        if (typeof res === 'object'){
            next(null, {code: code.OK, msg: {score: res.score}, updateUserData: res.updateUserData});
        } else{
            next(null, {code: code.OK, msg: {score: res}});
        }
    }catch(e){
        if (typeof e === 'number'){
            logger.error("quickJoin code:" + e);
            next(null, {code: e});
        }else{
            logger.error(e.stack);
            next(null, {code: 500});
        }
    }
};