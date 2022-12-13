let code = require('../../../constant/code');
let scheduler = require('pomelo-scheduler');
let logger = require('pomelo-logger').getLogger('logic');
let RoomFrame = require('../../../gameComponent/roomFrame');
let utils = require('../../../util/utils');
let enumeration = require('../../../constant/enumeration');

let exp = module.exports;

let ROOM_MAX_DELAY_DELETE_TIME = 60 * 60 * 1000;
exp.init = function (app) {
    this.app = app;
    this.roomList = {};

    this.scheduleJobID = -1;
    this.startScheduler();
};

let scheduleTask = function(data){
    let self = data.manager;
    let timeNow = new Date().toLocaleString();
    logger.info(self.app.curServer.id + ':room manager schedule task');
    logger.info(timeNow);
    // 输出现有房间的数量
    let count = 0;
    for (let key in self.roomList){
        if (self.roomList.hasOwnProperty(key)){
            let room = self.roomList[key];
            logger.info('room id: ' + key);
            if (room.isShouldDelete(ROOM_MAX_DELAY_DELETE_TIME)){
                room.destroyRoom();
                delete self.roomList[key];
                logger.info('delete room id:' + key);
            }else{
                count++;
            }
        }
    }
    logger.info('room count:'+ count);
};

exp.startScheduler = function(){
    this.scheduleJobID = scheduler.scheduleJob({period : ROOM_MAX_DELAY_DELETE_TIME}, scheduleTask, {manager: this});
};

exp.stopScheduler = function(){
    scheduler.cancelJob(this.scheduleJobID);
};

exp.beforeShutdown = function(cb){
    this.stopScheduler();
    cb();
};

exp.createRoom = async function(userInfo, gameRule) {
    let roomID = this.createNewRoomID();
    let roomFrame = new RoomFrame(roomID, userInfo, gameRule);
    this.roomList[roomID] = roomFrame;
	return await roomFrame.userEntryRoom(userInfo);
};

exp.joinRoom = async function (userInfo, roomID) {
    let roomFrame = this.roomList[roomID];
	if (!roomFrame) throw new Error(code.ROOM_NOT_EXIST);
	await roomFrame.userEntryRoom(userInfo);
    return roomID;
};

exp.leaveRoom = async function(roomID, uid){
    let roomFrame = this.roomList[roomID];
    if (!roomFrame) throw new Error(code.ROOM_NOT_EXIST);
    return await roomFrame.userOffLine(uid);
};
exp.dismissRoom = function(roomID) {
    delete this.roomList[roomID];
};

exp.getRoomFrameByID = function(roomID){
    return this.roomList[roomID] || null;
};

exp.isUserInRoom = function(uid, roomID) {
    let roomFrame = this.roomList[roomID];
    return roomFrame && roomFrame.ownUser(uid);
};

exp.searchRoomByUid = function(uid){
    let roomID = 0;
    for (let key in this.roomList){
        if (this.roomList.hasOwnProperty(key)){
            let room = this.roomList[key];
            if (room.ownUser(uid)){
                roomID = room.roomID;
                break;
            }
        }
    }
    return roomID;
};

exp.createNewRoomID = function(){
    let gameServers = this.app.getServersByType('game');
    let curServerIndex = 0;
    for (let i = 0; i < gameServers.length; ++i){
        if (gameServers[i].id === this.app.curServer.id){
            curServerIndex = i;
            break;
        }
    }
    let roomID = -1;
    let min = Math.floor(100000/gameServers.length) + 1;
    let max = Math.floor(1000000/gameServers.length) - 1;
    do{
        roomID = utils.getRandomNum(min, max) * gameServers.length + curServerIndex;
    }while(!!this.roomList[roomID] && !!roomID);
    return roomID;
};
