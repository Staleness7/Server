let code = require('../../../constant/code');
let unionManager = require('../domain/unionManager');
let userDao = require('../../../dao/userDao');
let logger = require('pomelo-logger').getLogger("logic");

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.addRoomRuleList = async function (msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.ruleName || !msg.gameType || !msg.roomRule){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.addRoomRuleList(msg.roomRule, msg.ruleName, msg.gameType);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.updateRoomRuleList = async function (msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.ruleName || !msg.gameType || !msg._id || !msg.roomRule){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.updateRoomRuleList(msg._id, msg.roomRule, msg.ruleName, msg.gameType);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.removeRoomRuleList = async function (msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.roomRuleID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.removeRoomRuleList(msg.roomRuleID);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.updateUnionNotice = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || (!msg.notice && msg.notice !== '') || msg.notice.length > 50){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.updateUnionNotice(msg.notice);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.updateOpeningStatus = async function (msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.updateOpeningStatus(msg.isOpen);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.transferUnion = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.transferUid || msg.transferUid === session.uid){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let userData = await userDao.getUserDataByUid(msg.transferUid);
    if (!userData){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    // 转移的玩家必须在联盟中
    let unionInfoItem = userData.unionInfo.find(function (ele) {
        return ele.unionID === msg.unionID;
    });
    if (!unionInfoItem){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.transferUnion(msg.transferUid);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.updateUnionName = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.unionName){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.updateUnionName(msg.unionName);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.updatePartnerNoticeSwitch = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.updatePartnerNoticeSwitch(msg.isOpen);
    next(null, {code: code.OK});
};

Handler.prototype.dismissRoom = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID || !msg.roomID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.dismissRoom(msg.roomID);
    next(null, {code: code.OK, msg: {unionInfo: union.getUnionInfo(session.uid), roomList: union.getUnionRoomList()}});
};

Handler.prototype.hongBaoSetting = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    try {
        let union = await unionManager.getUnion(msg.unionID);
        if (session.uid !== union.getOwnerUid()){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        let resCode = await union.updateHongBaoSetting(msg.status, msg.startTime, msg.endTime, msg.count, msg.totalScore);
        next(null, {code: resCode});
    }catch (e){
        logger.error(e.stack);
        next(null, {code: 500});
    }
};

Handler.prototype.updateLotteryStatus = async function (msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.unionID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let union = await unionManager.getUnion(msg.unionID);
    if (session.uid !== union.getOwnerUid()){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await union.updateLotteryStatus(msg.isOpen);
    next(null, {code: code.OK,});
};