let exp = module.exports = {};
let pomelo = require('pomelo');

exp.rpc = function () {
    let routeArr = arguments[0].split('.');
    let args = [];
    for (let key in arguments){
        if (key === '0') continue;
        if (arguments.hasOwnProperty(key)){
            args.push(arguments[key]);
        }
    }
    pomelo.app.rpc[routeArr[0]][routeArr[1]][routeArr[2]].toServer.apply(null, args);
};

// ------------------------------房间相关-----------------------------
exp.joinRoom = function(serverID, userInfo, roomID){
    return new Promise((resolve, reject)=>{
        pomelo.app.rpc.game.roomRemote.joinRoom.toServer(serverID, userInfo, roomID, function (err, code) {
            if (!!err){
                reject(err);
            }else{
                resolve(code);
            }
        });
    });

};

exp.createRoom = function(serverID, userInfo, gameRule, gameType){
	console.log('rpcAPI createRoom', serverID, userInfo, gameRule, gameType);
    return new Promise((resolve, reject)=>{
        pomelo.app.rpc.game.roomRemote.createRoom.toServer(serverID, userInfo, gameRule, gameType, function (err, res) {
            if(!!err){
                reject(err);
            }else{
                resolve(res);
            }
        });
    });
};

exp.getMatchRoomList = function (serverID, gameTypeID, cb) {
    pomelo.app.rpc.game.roomRemote.getMatchRoomList.toServer(serverID, gameTypeID, cb);
};

exp.matchRoom = function(serverID, userInfo, frontendId, cb){
    pomelo.app.rpc.game.roomRemote.matchRoom.toServer(serverID, userInfo, frontendId, cb);
};

exp.leaveRoom = function(app, serverID, roomID, uid, cb){
    pomelo.app.rpc.game.roomRemote.leaveRoom.toServer(serverID, roomID, uid, cb);
};

exp.isUserInRoom = function(serverID, uid, roomID) {
    return new Promise((resolve) => {
        pomelo.app.rpc.game.roomRemote.isUserInRoom.toServer(serverID, uid, roomID, function (err, isInRoom) {
            resolve(!!isInRoom);
        });
    });
};

exp.searchRoomByUid = function(serverID, uid){
    return new Promise((resolve, reject)=>{
        pomelo.app.rpc.game.roomRemote.searchRoomByUid.toServer(serverID, uid, function (err, roomID) {
            if (!!err){
                reject(err);
            }else{
                resolve(roomID);
            }
        });
    });
};

exp.getRoomGameDataByKind = function(serverID, kindID, cb){
    pomelo.app.rpc.game.roomRemote.getRoomGameDataByKind.toServer(serverID, kindID, cb);
};

exp.getRoomGameDataByRoomID = function (serverID, roomID) {
    return new Promise((resolve, reject) => {
        pomelo.app.rpc.game.roomRemote.getRoomGameDataByRoomID.toServer(serverID, roomID, function (err, gameData) {
            if (!!err){
                reject(err);
            }else{
                resolve(gameData);
            }
        });
    });
};

exp.updateRoomUserInfo = function (app, serverID, newUserInfo, roomID, cb){
    pomelo.app.rpc.game.roomRemote.updateRoomUserInfo.toServer(serverID, newUserInfo, roomID, cb);
};

exp.recharge = function(serverID, rechargePlatform, rechargeData, cb){
    pomelo.app.rpc.hall.rechargeRemote.recharge.toServer(serverID, rechargePlatform, rechargeData, cb);
};

// ------------------------------机器人相关-------------------------------
exp.requestRobotNotify = function (roomID, gameTypeInfo, robotCount, cb) {
    pomelo.app.rpc.robot.robotRemote.requestRobotNotify.toServer("robot-1", roomID, gameTypeInfo, robotCount, cb);
};

exp.robotLeaveRoomNotify = function (kind, uidArr) {
    return new Promise((resolve, reject) => {
        pomelo.app.rpc.robot.robotRemote.robotLeaveRoomNotify.toServer("robot-1", kind, uidArr, function (err) {
            if (!!err){
                reject(err);
            }else{
                resolve();
            }
        });
    });
};

exp.getCurRobotWinRate = function (kind) {
    return new Promise((resolve) => {
        pomelo.app.rpc.robot.controllerRemote.getCurRobotWinRate.toServer("robot-1", kind, function (err, rate) {
            if (!!err){
                resolve(0.5);
            }else{
                resolve(rate);
            }
        });
    });
};

exp.robotGoldChanged = function (kind, count) {
    return new Promise((resolve, reject) => {
        pomelo.app.rpc.robot.controllerRemote.robotGoldChanged.toServer("robot-1", kind, count, function (err) {
            if (!!err){
                reject(err);
            }else{
                resolve();
            }
        });
    });
};
