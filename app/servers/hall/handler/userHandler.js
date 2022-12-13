let code = require('../../../constant/code');
let userInfoServices = require('../../../services/userInfoServices');
let authServices = require('../../../services/authServices');
let pomelo = require('pomelo');
let commonDao = require('../../../dao/commonDao');
let userDao = require('../../../dao/userDao');

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.safeBoxOperation = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.count || typeof msg.count !== 'number' || msg.count === 0){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let userData = await userDao.getUserDataByUid(session.uid);
    if (!userData){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    // 存入
    if (msg.count > 0){
        if (userData.gold < msg.count){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
    }
    // 取出
    else{
        if (userData.safeGold < msg.count * -1){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
    }

    let updateUserData = {
        $inc: {
            gold: -msg.count,
            safeGold: msg.count
        }
    };
    let newUserData = await userDao.updateUserDataByUid(session.uid, updateUserData);
    if(newUserData.gold < 0 || newUserData.safeGold < 0){
        updateUserData = {
            gold: msg.count,
            safeGold: -msg.count
        };
        await userDao.updateUserDataByUid(session.uid, updateUserData);
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    await userInfoServices.updateUserDataNotify(session.uid, newUserData.frontendId, {gold: newUserData.gold, safeGold: newUserData.safeGold});
    next(null, {code: code.OK});
};

Handler.prototype.bindPhone = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.phone || !msg.smsCode){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let isAuthPhone = pomelo.app.get('config')["authPhone"] === "true";
    if (isAuthPhone) {
        if (!msg.smsCode) {
            next(null, {code: code.SMS_CODE_ERROR});
            return;
        } else {
            if (!await authServices.authSmsCode(msg.phone, msg.smsCode)) {
                next(null, {code: code.SMS_CODE_ERROR});
                return;
            }
        }
    }
    let accountData = await commonDao.findOneData("accountModel", {phoneAccount: msg.phone});
    if (!!accountData){
        next(null, {code: code.PHONE_ALREADY_BIND});
        return;
    }

    await commonDao.updateData("accountModel", {uid: parseInt(session.uid)}, {phoneAccount: msg.phone});
    await userDao.updateUserDataByUid(session.uid, {mobilePhone: msg.phone});

    next(null, {code: code.OK, updateUserData: {mobilePhone: msg.phone}});
};

Handler.prototype.authRealName = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.name || !msg.idCard){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let realNameInfo = JSON.stringify({name: msg.name,  idCard: msg.idCard});
    await userDao.updateUserDataByUid(session.uid, {realName: realNameInfo});

    next(null, {code: code.OK, updateUserData: {realName: realNameInfo}});
};

Handler.prototype.updateUserAddress = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    await userDao.updateUserDataByUid(session.uid, {address: msg.address, location: msg.location});

    next(null, {code: code.OK, updateUserData: {address: msg.address, location: msg.location}});
};

Handler.prototype.searchByPhone = async function(msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.phone){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let userData = await userDao.getUserData({mobilePhone: msg.phone});
    if (!userData){
        next(null, {code: code.NOT_FIND_BIND_PHONE});
    }else{
        next(null, {code: code.OK, msg: {userData: userData}});
    }
};

Handler.prototype.searchUserData = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.uid){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let userData = await userDao.getUserData({uid: msg.uid});
    if (!userData){
        next(null, {code: code.NOT_FIND_USER});
    }else{
        next(null, {code: code.OK, msg: {userData: userData}});
    }
};