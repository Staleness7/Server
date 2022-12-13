let api = module.exports;
let pomelo = require('pomelo');
let logger = require('pomelo-logger').getLogger('pomelo');

api.roomMessagePush = function(msg, uidAndFrontendIdArr){
    return new Promise((resolve, reject) => {
        let channelService = pomelo.app.get('channelService');
        msg.pushRouter = 'RoomMessagePush';
        channelService.pushMessageByUids('ServerMessagePush', msg, uidAndFrontendIdArr, {}, function (err) {
            if (!!err){
                logger.error(err.stack);
                reject(err);
            }else{
                resolve();
            }
        });
    });
};

api.gameMessagePush = function(msg, uidAndFrontendIdArr){
    return new Promise((resolve, reject) => {
        let channelService = pomelo.app.get('channelService');
        msg.pushRouter = 'GameMessagePush';
        channelService.pushMessageByUids('ServerMessagePush', msg, uidAndFrontendIdArr, {}, function (err) {
            if (!!err){
                logger.error(err.stack);
                reject(err);
            }else{
                resolve();
            }
        });
    });
};

api.selfEntryRoomPush = function(msg, uidAndFrontendIdArr){
    return new Promise((resolve, reject) => {
        let channelService = pomelo.app.get('channelService');
        msg.pushRouter = 'SelfEntryRoomPush';
        channelService.pushMessageByUids('ServerMessagePush', msg, uidAndFrontendIdArr, {}, function (err) {
            if (!!err){
                logger.error(err.stack);
                reject(err);
            }else{
                resolve();
            }
        });
    });
};

api.updateUserInfoPush = function(msg, uidAndFrontendIdArr){
    return new Promise((resolve, reject) => {
        let channelService = pomelo.app.get('channelService');
        msg.pushRouter = 'UpdateUserInfoPush';
        channelService.pushMessageByUids('ServerMessagePush', msg, uidAndFrontendIdArr, {}, function (err) {
            if (!!err){
                logger.error(err.stack);
                reject(err);
            }else{
                resolve(true);
            }
        });
    });
};

api.broadcastPush = function(msg){
    return new Promise((resolve, reject) => {
        let channelService = pomelo.app.get('channelService');
        msg.pushRouter = 'BroadcastPush';
        channelService.broadcast('connector', 'ServerMessagePush', msg, null, function (err) {
            if (!!err){
                logger.error(err.stack);
                reject(err);
            }else{
                resolve();
            }
        });
    });
};

api.popDialogContentPush = function(msg, uidAndFrontendIdArr){
    return new Promise((resolve, reject) => {
        let channelService = pomelo.app.get('channelService');
        msg.pushRouter = 'PopDialogContentPush';
        channelService.pushMessageByUids('ServerMessagePush',msg, uidAndFrontendIdArr, {}, function (err) {
            if (!!err){
                logger.error(err.stack);
                reject(err);
            }else{
                resolve();
            }
        });
    });
};
