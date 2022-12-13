let utils = require('../util/utils');
let async = require('async');
let code = require('../constant/code');
let userDao = require('../dao/userDao');
let dao = require('../dao/commonDao');
let logger = require('pomelo-logger').getLogger('logic');
let userInfoServices = require('./userInfoServices');
let pomelo = require("pomelo");

let services = module.exports;

services.execRebate = async function (unionID, roomID, gameType, userInfo, lowPartnerUnionInfo, lowUid, spreaderID, count, bigWin, isOneDraw) {
    if (!spreaderID) return;
    let lowPartnerRebateRate = !lowPartnerUnionInfo?0:lowPartnerUnionInfo.rebateRate;
    let userData = await userDao.getUserDataByUid(spreaderID);
    if(!userData){
        console.warn("execRebate", "not find user data spreaderID = " + spreaderID);
        return;
    }
    let unionInfo = userData.unionInfo.find(function (ele) {
        return ele.unionID === unionID;
    });
    if(!unionInfo){
        console.warn("execRebate", "not find unionInfo spreaderID = " + spreaderID);
        return;
    }
    let getScore = count * parseFloat((unionInfo.rebateRate - lowPartnerRebateRate).toFixed(2));
    getScore = Math.floor(getScore * 100)/100;
    if (getScore < 0){
        logger.error("execRebate", "getScore < 0");
        return;
    }
    if (getScore > 0){
        // 更新用户数据
        let saveData = {
            $inc: {
                "unionInfo.$.safeScore": getScore,
                "unionInfo.$.todayRebate": getScore,
                "unionInfo.$.totalRebate": getScore,
            }
        };
        if (!isOneDraw){
            saveData.$inc["unionInfo.$.memberTodayDraw"] = 1;
            if (bigWin){
                saveData.$inc["unionInfo.$.memberTodayBigWinDraw"] = 1;
            }
        }
        // 更新推广员数据
        {
            let newUserData = await userDao.updateUserData({uid: spreaderID, "unionInfo.unionID": unionID}, saveData);
            if (!!newUserData.frontendId){
                userInfoServices.updateUserDataNotify(newUserData.uid, newUserData.frontendId, {unionInfo: newUserData.unionInfo}).catch(err=>{});
            }
        }
        // 记录下级玩家贡献的的返利数
        if (!!lowUid){
            await userDao.updateUserData({uid: lowUid, "unionInfo.unionID": unionID}, {$inc: {"unionInfo.$.todayProvideRebate": getScore}});
        }
        // 添加记录
        let createData = {
            uid: spreaderID,
            roomID: roomID,
            gameType: gameType,
            unionID: unionID,
            playerUid: userInfo.uid,
            totalCount: count,
            gainCount: getScore,
            start: false,
            createTime: Date.now()
        };
        dao.createData("userRebateRecordModel", createData).catch(e=>{logger.error(e.stack)});
    }else if (!isOneDraw){
        // 更新用户数据
        let saveData = {
            $inc: {
                "unionInfo.$.memberTodayDraw": 1,
            }
        };
        if (bigWin){
            saveData.$inc["unionInfo.$.memberTodayBigWinDraw"] = 1;
        }
        // 更新推广员数据
        await userDao.updateUserData({uid: spreaderID, "unionInfo.unionID": unionID}, saveData);
    }

    if (!unionInfo.spreaderID || unionInfo.rebateRate >= 1) return;
    await services.execRebate(unionID, roomID, gameType, userInfo, unionInfo, spreaderID, unionInfo.spreaderID, count, bigWin);
};