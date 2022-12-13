let dispatch = require('./dispatcher');
let code = require('../constant/code');
let exp = module.exports;
let logger = require('pomelo-logger').getLogger('pomelo');


exp.game = function(session, msg, app, cb) {
    let roomID = session.get('roomID');
    if(!!roomID){
        let server = dispatch.dispatch(roomID, app.getServersByType('game'));
        if (!server){
            logger.error('can not dispatcher game server');
            cb(code.FAIL);
        }else{
            cb(null, server.id);
        }
        return;
    }
    let body = msg.args[0].body;
    if (body.unionID){
        let server = dispatch.dispatch(body.unionID, app.getServersByType('game'));
        if (!server){
            logger.error('can not dispatcher game server');
            cb(code.FAIL);
        }else{
            cb(null, server.id);
        }
    } else {
        logger.error('game server msg invaild');
        cb(code.FAIL);
    }
};

exp.connector = function(session, msg, app, cb) {
    if(!session) {
        cb(new Error('fail to route to connector server for session is empty'));
        return;
    }

    if(!session.frontendId) {
        cb(new Error('fail to find frontend id in session'));
        return;
    }

    cb(null, session.frontendId);
};
