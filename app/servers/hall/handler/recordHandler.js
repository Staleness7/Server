let code = require('../../../constant/code');
let enumeration = require('../../../constant/enumeration');
let dao = require('../../../dao/commonDao');
let logger = require('pomelo-logger').getLogger('logic');
let DAY_MS = 24 * 60 * 60 * 100;
let WEEK_MS = 7 * DAY_MS;

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.getRecordData = async function(msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    let recordType = msg.recordType;
    let startIndex = msg.startIndex || 0;
    let count = msg.count || 20;
    let modelKey = "";
    if (recordType === enumeration.recordType.RECHARGE){
        modelKey = "rechargeRecordModel";
    }else if (recordType === enumeration.recordType.WITHDRAWALS){
        modelKey = "withdrawCashRecordModel";
    }else if (recordType === enumeration.recordType.GAME){
        modelKey = "userGameRecordModel";
    }else if (recordType === enumeration.recordType.SAFE_BOX){
        modelKey = 'safeBoxRecordModel';
    }
    let matchData = {
        uid: session.uid,
        createTime: {$gte: Date.now() - WEEK_MS}
    };
    let result = await dao.findDataAndCount(modelKey, startIndex, count, {createTime: -1}, matchData);
    next(null, {code: code.OK, msg: result});
};

Handler.prototype.getDirectlyMemberRecordData = async function(msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    let startIndex = msg.startIndex || 0;
    let count = msg.count || 20;
    let matchData = {
        spreaderID: session.uid
    };
    let result = await dao.findDataAndCount("userModel", startIndex, count, {createTime: -1}, matchData);
    next(null, {code: code.OK, msg: result});
};

Handler.prototype.getAgentMemberRecordData = async function(msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    let startIndex = msg.startIndex || 0;
    let count = msg.count || 20;
    let matchData = {
        spreaderID: session.uid,
        "directlyMemberCount": {$gte: 1}
    };
    let result = await  dao.findDataAndCount("userModel", startIndex, count, {createTime: -1}, matchData);
    next(null, {code: code.OK, msg: result});
};