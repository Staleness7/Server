let crypto = require('crypto');
let global = require('../constant/global');
module.exports.createToken = function (uid, serverID) {
    let msg = Date.now() + '|' + uid + '|' + serverID;
    let cipher = crypto.createCipher('aes256', global.TOKEN_PWD);
    let enc = cipher.update(msg, 'utf8', 'hex');
    enc += cipher.final('hex');
    return enc;
};
module.exports.parseToken = function (token) {
    let decipher = crypto.createDecipher('aes256', global.TOKEN_PWD);
    let dec;
    try {
        dec = decipher.update(token, 'hex', 'utf8');
        dec += decipher.final('utf8');
    } catch (err) {
        console.error('[token] fail to decrypt token. %j', token);
        return null;
    }
    let ts = dec.split('|');
    if (ts.length !== 3) {

        return null;
    }
    return {uid: ts[1], serverID: ts[2], timekey: Number(ts[0])};
};

let TOKEN_USEFUL_TIME = 30000;
module.exports.checkToken = function (authInfo) {
    if (!authInfo || !authInfo.serverID || !authInfo.timekey || !authInfo.uid) {
        return false;
    }
    let nowTime = Date.now();
    return ((nowTime - authInfo.timekey) < TOKEN_USEFUL_TIME);
};