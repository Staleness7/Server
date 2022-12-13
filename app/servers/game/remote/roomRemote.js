let code = require('../../../constant/code');
let unionManager = require('../domain/unionManager');
let logger = require('pomelo-logger').getLogger("logic");

module.exports = function (app) {
    return new roomRemote(app);
};

let roomRemote = function (app) {
    this.app = app;
};
let pro = roomRemote.prototype;

pro.createRoom = async function(userInfo, gameRule, gameType, cb){
    await this.roomManager.createRoom(userInfo, gameRule, gameType);
    cb();
};

pro.joinRoom = async  function (userInfo, roomID, cb) {
    try {
        let resCode = await unionManager.joinRoom(userInfo, roomID);
        cb(null, resCode);
    } catch(err) {
        logger.error(err.stack);
        cb(parseInt(err.message || 500));
    }
};

pro.leaveRoom = function(roomID, uid, cb){
    unionManager.leaveRoom(roomID, uid)
        .then(()=>{
            cb();
        })
        .catch((err)=>{
            logger.error(err.stack);
            cb();
        })
};

pro.isUserInRoom = function(uid, roomID, cb) {
    cb(null, unionManager.isUserInRoom(uid, roomID));
};

pro.searchRoomByUid = function(uid, cb){
    cb(null, unionManager.searchRoomByUid(uid));

};

pro.updateRoomUserInfo = function (newUserInfo, roomID, cb){
    let roomFrame = this.roomManager.getRoomFrameByID(roomID);
    if (!roomFrame){
        cb(code.REQUEST_DATA_ERROR);
    }
    else {
        roomFrame.updateRoomUserInfo(newUserInfo, false);
        cb();
    }
};

pro.updatePublicParameter = function(config, cb){
    this.app.set('config', config);
    cb();
};


pro.getMatchRoomList = function (gameTypeID, cb) {
    cb(null, this.roomManager.getMatchRoomList(gameTypeID));
};

