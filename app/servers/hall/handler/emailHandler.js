let code = require('../../../constant/code');
let userInfoServices = require('../../../services/userInfoServices');
let userDao = require('../../../dao/userDao');
let commonDao = require('../../../dao/commonDao');
let logger = require('pomelo-logger').getLogger('logic');

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.readEmail = async function (msg, session, next) {
    try {
        if (!session.uid){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        if (!msg.emailID){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        let userData = await userDao.getUserDataByUid(session.uid);
        if (!userData){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        if (userData.emailArr.length === 0){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        let emailArr = JSON.parse(userData.emailArr);
        let isUpdate = false;
        for (let i = 0; i < emailArr.length; ++i){
            let info = emailArr[i];
            if (info.id === msg.emailID){
                if (info.isRead) break;
                info.isRead = true;
                isUpdate = true;
                break;
            }
        }
        if (isUpdate){
            await userDao.updateUserDataByUid(session.uid, {emailArr: JSON.stringify(emailArr)});
            await userInfoServices.updateUserDataNotify(session.uid, userData.frontendId, {emailArr: JSON.stringify(emailArr)});
        }
        next(null, {code :code.OK});
    }catch (err){
        logger.error("withdrawCashRequest", err);
        next(null, {code: typeof err === 'number'?err: 500});
    }
};

Handler.prototype.deleteEmail = async function (msg, session, next) {
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    if (!msg.emailID){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let userData = await userDao.getUserDataByUid(session.uid);
    if (!userData){
        next(null, {code: code.REQUEST_DATA_ERROR});
    }
    if (userData.emailArr.length === 0){
        next(null, {code: code.OK});
        return;
    }
    let emailArr = JSON.parse(userData.emailArr);
    let isUpdate = false;
    for (let i = 0; i < emailArr.length; ++i){
        let info = emailArr[i];
        if (info.id === msg.emailID){
            emailArr.splice(i, 1);
            isUpdate = true;
            break;
        }
    }
    if (isUpdate){
        await userDao.updateUserData(session.uid, {emailArr: JSON.stringify(emailArr)});
        next(null, {code :code.OK, updateUserData: {emailArr: JSON.stringify(emailArr)}});
    }else{
        next(null, {code :code.OK});
    }
};