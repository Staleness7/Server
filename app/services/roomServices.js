let rpcAPI = require('../API/rpcAPI');
let code = require('../constant/code');
let utils = require('../util/utils');
let pomelo = require('pomelo');
let logger = require('pomelo-logger').getLogger('logic');
let dispatch = require('../util/dispatcher');
let async = require('async');

let service = module.exports;

service.searchRoomByUid = async function(uid){
    let gameServers = pomelo.app.getServersByType('game');
    for (let i = 0; i < gameServers.length; ++i){
        let roomID = await rpcAPI.searchRoomByUid(gameServers[i].id, uid).catch(err=>{});
        if (!!roomID) return roomID;
    }
    return 0;
};

service.getMatchRoomList = function (gameTypeID) {
    return new Promise((resolve, reject)=>{
        let roomArr = [];
        // 查询可加入房间列表
        let servers = pomelo.app.getServersByType('game');
        let tasks = [];
        let index = 0;
        function task(cb) {
            let server = servers[index++];
            rpcAPI.getMatchRoomList(server.id, gameTypeID, cb);
        }
        for (let i = 0; i < servers.length; ++i){
            tasks.push(task);
        }
        async.parallel(tasks, function (err, resultArr) {
            if (!!err){
                logger.error("startMatch", "matchRoom err:" + err);
                reject(err);
            }else{
                for (let i = 0; i < resultArr.length; ++i){
                    if (!!resultArr[i]){
                        roomArr = roomArr.concat(resultArr[i]);
                    }
                }
                resolve(roomArr);
            }
        })
    })
};

service.startMatch = async function (userRoomData, gameTypeInfo) {
    let roomArr = await service.getMatchRoomList(gameTypeInfo.gameTypeID);
    return await service.matchRoom(userRoomData, roomArr, gameTypeInfo);
};

service.matchRoom = async function (userRoomData, roomArr, gameTypeInfo) {
    // 判断进入条件
    if(userRoomData.gold < gameTypeInfo.goldLowerLimit) throw new Error(code.LEAVE_ROOM_GOLD_NOT_ENOUGH_LIMIT);
    if (roomArr.length === 0){
        return await service.createRoom(userRoomData, gameTypeInfo, null);
    }else{
        let index = utils.getRandomNum(0, roomArr.length - 1);
        let roomID = await service.joinRoom(userRoomData, roomArr[index]).catch(err=>{
            logger.error("matchRoom", "joinRoom err:" + err);
        });
        if (!roomID){
            roomArr.splice(index, 1);
            return await service.matchRoom(userRoomData, roomArr, gameTypeInfo);
        }
        return roomID;
    }
};

service.createRoom = async function (userRoomData, gameTypeInfo, gameRule) {
    let gameServer = dispatch.dispatch(utils.getRandomNum(0, pomelo.app.getServersByType('game').length - 1), pomelo.app.getServersByType('game'));
    return await rpcAPI.createRoom(gameServer.id, userRoomData, gameRule, gameTypeInfo);
};

service.joinRoom = async function (userRoomData, roomID) {
    let gameServers = pomelo.app.getServersByType('game');
    let server = dispatch.dispatch(roomID, gameServers);
    await rpcAPI.joinRoom(server.id, userRoomData, roomID);
    return roomID;
};