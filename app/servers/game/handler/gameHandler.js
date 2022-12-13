let code = require('../../../constant/code');
let unionManager = require('../domain/unionManager');
let logger = require('pomelo-logger').getLogger("logic");

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.roomMessageNotify = function (msg, session, next){
    try {
        if (!session.uid){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        let curRoomID = session.get('roomID');
        if (!curRoomID){
            next(null, {code: code.NOT_IN_ROOM});
            return;
        }
        let roomFrame = unionManager.getRoomFrameByID(curRoomID);
        if (!roomFrame){
            next(null, {code: code.NOT_IN_ROOM});
            return;
        }

        roomFrame.receiveRoomMessage(session.uid, msg);
    } catch (e){
        logger.error(e.stack);
    } finally {
        next();
    }
};

Handler.prototype.gameMessageNotify = function (msg, session, next){
    try {
        if (!session.uid){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        let curRoomID = session.get('roomID');
        if (!curRoomID){
            next(null, {code: code.NOT_IN_ROOM});
            return;
        }
        let roomFrame = unionManager.getRoomFrameByID(curRoomID);
        if (!roomFrame){
            next(null, {code: code.NOT_IN_ROOM});
            return;
        }
        roomFrame.receiveGameMessage(session.uid, msg);
    } catch (e){
        logger.error(e.stack);
    } finally {
        next();
    }
};
