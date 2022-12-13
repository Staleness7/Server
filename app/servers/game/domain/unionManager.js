let code = require('../../../constant/code');
let scheduler = require('pomelo-scheduler');
let logger = require('pomelo-logger').getLogger('logic');
let utils = require('../../../util/utils');
let enumeration = require('../../../constant/enumeration');
let pomelo = require('pomelo');
let Union = require('./union');

let exp = module.exports;

let UNION_MAX_DELAY_DELETE_TIME = 24 * 60 * 60 * 1000;
exp.init = function () {
    this.unionList = {};

    this.scheduleJobID = -1;
    this.startScheduler();
};

exp.beforeShutdown = async function(cb){
    scheduler.cancelJob(this.dailyTaskSchedulerID);
    scheduler.cancelJob(this.weekTaskSchedulerID);
    await dao.updateAllData("userModel", {$or:[{roomID: {$ne:""}}, {frontendId: {$ne:""}}]}, {roomID: "", frontendId: ""});
    cb();
};

let scheduleTask = function(data){
    let self = data.manager;
    let timeNow = new Date().toLocaleString();
    logger.info(pomelo.app.curServer.id + ':room manager schedule task');
    logger.info(timeNow);
    // 输出现有缓存联盟的数量
    let count = 0;
    for (let key in self.unionList){
        if (self.unionList.hasOwnProperty(key)){
            let union = self.unionList[key];
            logger.info('union id: ' + key);
            if (union.isShouldDelete(UNION_MAX_DELAY_DELETE_TIME)){
                union.onDestroy();
                delete self.unionList[key];
                logger.info('delete union id:' + key);
            }else{
                count++;
            }
        }
    }
    logger.info('union count:'+ count);
};

exp.dailyTaskScheduler = function() {
    logger.info('dailyTaskSchedulerClearData');
    for (let key in exp.unionList){
        if (exp.unionList.hasOwnProperty(key)){
            let union = exp.unionList[key];
            union.dailyClear();
        }
    }
};

exp.startScheduler = function(){
    this.scheduleJobID = scheduler.scheduleJob({period : 60 * 60 * 1000}, scheduleTask, {manager: this});

    this.dailyTaskSchedulerID = scheduler.scheduleJob('0 0 0 * * *', exp.dailyTaskScheduler);
};

exp.stopScheduler = function(){
    scheduler.cancelJob(this.scheduleJobID);
    scheduler.cancelJob(this.dailyTaskSchedulerID);
};

exp.beforeShutdown = function(cb){
    this.stopScheduler();
    cb();
};

exp.getUnion = async function (unionID) {
    if (!this.unionList[unionID]){
        let union = new Union(unionID);
        this.unionList[unionID] = union;
        await union.init();
    }
    return this.unionList[unionID];
};

exp.removeUnionCache = function (unionID) {
    if (!this.unionList[unionID]) return;
    let union = this.unionList[unionID];
    union.onDestroy();
    delete this.unionList[unionID];
    logger.info('delete union id:' + unionID);
};

exp.joinRoom = async function(userInfo, roomID) {
    let union = this.getUnionByRoomID(roomID);
    if (!union){
        return code.ROOM_NOT_EXIST;
    }
    return await union.joinRoom(roomID, userInfo);
};

exp.leaveRoom = async function(roomID, uid){
    let roomFrame = this.getRoomFrameByID(roomID);
    if (!roomFrame) return;
    return await roomFrame.userOffLine(uid);
};

exp.dismissRoom = function(roomID) {
    let union = this.getUnionByRoomID(roomID);
    if (!union) {
        logger.warn('dismissRoom', 'union not exit');
        return;
    }
    delete union.destroyRoom(roomID);
};

exp.getRoomFrameByID = function(roomID){
    for (let key in this.unionList){
        if (this.unionList.hasOwnProperty(key)){
            if (!!this.unionList[key].roomList[roomID]){
                return this.unionList[key].roomList[roomID];
            }
        }
    }
    return null;
};

exp.getUnionByRoomID = function (roomID) {
    for (let key in this.unionList){
        if (this.unionList.hasOwnProperty(key)){
            if (!!this.unionList[key].roomList[roomID]){
                return this.unionList[key];
            }
        }
    }
    return null;
};

exp.isUserInRoom = function(uid, roomID) {
    let roomFrame = this.getRoomFrameByID(roomID);
    return roomFrame && roomFrame.isUserInRoom(uid);
};

exp.createNewRoomID = function(){
    let gameServers = pomelo.app.getServersByType('game');
    let curServerIndex = 0;
    for (let i = 0; i < gameServers.length; ++i){
        if (gameServers[i].id === pomelo.app.curServer.id){
            curServerIndex = i;
            break;
        }
    }
    let roomID = -1;
    let min = Math.floor(100000/gameServers.length) + 1;
    let max = Math.floor(1000000/gameServers.length) - 1;
    do{
        roomID = utils.getRandomNum(min, max) * gameServers.length + curServerIndex;
    }while(!!this.getRoomFrameByID(roomID));
    return roomID;
};
