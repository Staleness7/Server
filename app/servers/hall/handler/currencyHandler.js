let code = require('../../../constant/code');
let enumeration = require('../../../constant/enumeration');
let userInfoServices = require('../../../services/userInfoServices');
let dao = require('../../../dao/commonDao');
let userDao = require('../../../dao/userDao');
let logger = require('pomelo-logger').getLogger('logic');

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.withdrawCashRequest = async function(msg, session, next){
    try {
        if(!session.uid){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        // 判断参数是否正确
        if (!msg.count || typeof msg.count !== 'number' || msg.count <= 0){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        let count = msg.count;
        // 获取数据
        let userData = await userDao.getUserDataByUidFromCache(session.uid);
        if (!userData){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        // 判断金币是否已经锁定
        if (!!userData.syncLock){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        // 判定是否已经绑定
        if (msg.withdrawCashType === enumeration.withdrawCashType.ALI_PAY){
            if (!userData.aliPayInfo || userData.aliPayInfo.length === 0){
                next(null, {code: code.REQUEST_DATA_ERROR});
                return;
            }
        }
        if (msg.withdrawCashType === enumeration.withdrawCashType.BANK_CARD){
            if (!userData.bankCardInfo || userData.bankCardInfo.length === 0){
                next(null, {code: code.REQUEST_DATA_ERROR});
                return;
            }
        }
        // 判断金币是否足够
        if (count > userData.gold){
            next(null, {code: code.NOT_ENOUGH_GOLD});
            return;
        }
        // 更新金币
        let newUserData = await userDao.updateUserDataByUid(session.uid, {$inc: {gold: -count}} );
        if (!newUserData || newUserData.gold < 0){
            // 金币不足则还原操作
            await userDao.updateUserDataByUid(session.uid, {$inc: {gold: count}});
            next(null, {code: code.NOT_ENOUGH_GOLD});
            return;
        }
        // 创建申请信息
        let saveData = {
            uid: session.uid,
            count: count,
            curGold: newUserData.gold,
            type: msg.withdrawCashType,
            status: 0,
            createTime: Date.now()
        };
        if (msg.withdrawCashType === enumeration.withdrawCashType.ALI_PAY){
            let aliPayInfo = JSON.parse(newUserData.aliPayInfo || "{}");
            saveData.account = aliPayInfo.aliPayAccount;
            saveData.ownerName = aliPayInfo.ownerName
        }else if (msg.withdrawCashType === enumeration.withdrawCashType.BANK_CARD){
            let bankCardInfo = JSON.parse(newUserData.bankCardInfo || "{}");
            saveData.account = bankCardInfo.cardNumber;
            saveData.ownerName = bankCardInfo.ownerName
        }
        await dao.createData("withdrawCashRecordModel", saveData);
        // 推送
        await userInfoServices.updateUserDataNotify(session.uid, newUserData.frontendId, {gold: newUserData.gold});
        next(null, {code: code.OK});
    }catch (err){
        logger.error("withdrawCashRequest", err);
        next(null, {code: typeof err === 'number'?err: 500});
    }
};

Handler.prototype.extractionCommission = async function (msg, session, next) {
    try {
        if(!session.uid){
            next(null, {code: code.INVALID_UERS});
            return;
        }
        let userData = await userDao.getUserDataByUidFromCache(session.uid);
        if (!!userData.syncLock){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        if (userData.realCommision <= 0){
            next(null, {code: code.OK});
            return;
        }
        let updateUserData = {
            $inc: {
                gold: userData.realCommision,
                realCommision: -userData.realCommision
            }
        };
        let newUserData = await userDao.updateUserDataByUid(session.uid, updateUserData);
        if (newUserData.realCommision < 0){
            let updateUserData = {
                $inc: {
                    gold: -userData.realCommision,
                    realCommision: userData.realCommision
                }
            };
            await userDao.updateUserDataByUid(session.uid, updateUserData);
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }

        let saveData = {
            uid: session.uid,
            count: userData.realCommision,
            remainderCount: newUserData.realCommision,
            curGold: newUserData.gold,
            createTime: Date.now()
        };
        await dao.createData("extractionCommissionRecordModel", saveData);

        await userInfoServices.updateUserDataNotify(user, updateUserData);

        next(null, {code: code.OK});
    }catch (err){
        logger.error("extractionCommission", err);
        next(null, {code: typeof err === 'number'?err: 500});
    }
};