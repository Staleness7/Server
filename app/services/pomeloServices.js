let logger = require('pomelo-logger').getLogger('logic');
let pomelo = require('pomelo');

let exp = module.exports;

exp.pushSessionData = function (session, key, value) {
    return new Promise((resolve, reject) => {
        session.set (key, value);
        session.push(key, function (err) {
            if (!!err){
                reject(err);
            }else{
                resolve();
            }
        });
    });
};

exp.getSession = function (sid, uid) {
    return new Promise((resolve, reject) => {
        let localSessionService = pomelo.app.get('localSessionService');
        localSessionService.getByUid(sid, uid, function(err, result) {
            if (!!err){
                logger.error("getSession err:" + JSON.stringify(err));
                reject(err);
            }else{
                resolve(!!result?result[0]:null);
            }
        });
    });
};

exp.sleep = function (time) {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
};