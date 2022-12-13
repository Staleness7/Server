let code = require('../constant/code');
let dao = require('../dao/commonDao');
let userDao = require('../dao/userDao');
let updateUserInfoServices = require('./userInfoServices');
let pushAPI = require('../API/pushAPI');
let jsMd5 = require('js-md5');
let pomelo = require('pomelo');
let httpService = require('../services/httpRequestServices');
let rechargeLogger = require('pomelo-logger').getLogger('recharge');

let service = module.exports;

service.sendPurchaseItem = async function(uid, amount, platform, rechargeInfo){
    let userData = await userDao.getUserDataByUid(uid);
    if (!userData) throw new Error(code.INVALID_UERS);
    // 记录充值信息
    let oneRMBToGold = parseInt(pomelo.app.get('config')["oneRMBToGold"] || "1");
    let goldCount = oneRMBToGold * amount;
    let rechargerData = {
        uid: userData.uid,
        nickname: userData.nickname,
        spreaderID: userData.spreaderID,
        rechargeMoney: amount,
        goldCount: goldCount,
        userOrderID: rechargeInfo.userOrderID,
        platformReturnOrderID: rechargeInfo.platformReturnOrderID,
        platform: platform,
        createTime: Date.now()
    };
    await dao.createData("rechargeRecordModel", rechargerData);
    // 更新用户信息
    let updateUserData = {};
    updateUserData.$inc.gold = goldCount;
    updateUserData.$inc.rechargeNum = amount;
    let newUserData = await userDao.updateUserDataByUid(uid, updateUserData);
    if (!!newUserData.frontendId){
        updateUserInfoServices.updateUserDataNotify(uid, newUserData.frontendId, {gold: newUserData.gold, rechargeNum: newUserData.rechargeNum}).catch(err=>{});
        pushAPI.popDialogContentPush({code: code.RECHARGE_SUCCESS}, [{uid:uid, sid: newUserData.frontendId}]).catch(function(err){
            rechargeLogger.error('popDialogContentPush err:' + err);
        });
    }
};