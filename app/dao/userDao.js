let pomelo = require('pomelo');
let utils = require('../util/utils');
let code = require('../constant/code');
let commonDao = require('./commonDao');
let logger = require('pomelo-logger').getLogger('pomelo');
let userInfoServices = require('../services/userInfoServices');

let dao = module.exports;

let USER_CACHE_DATA_HEAD = "USER_MODEL";

dao.getUserDataByUid = async function (uid) {
    // 查询缓存中是否存在
    return await commonDao.findOneData("userModel", {uid: uid});
};

dao.getUserData = async function (matchData) {
    // 查询缓存中是否存在
    return await commonDao.findOneData("userModel", matchData);
};

dao.getUnlockUserDataAndLock = async function (uid) {
    return await commonDao.findOneAndUpdateEx("userModel", {uid: uid, syncLock: 0}, {syncLock: 1}, {new: true});
};

dao.loadUserDataByUid = async function (uid) {
    // 查询缓存中是否存在
    let redisClient = pomelo.app.get('redisClient');
    let data = await redisClient.hgetall(USER_CACHE_DATA_HEAD + uid);
    if (!!data){
        return userInfoServices.convertRedisUserDataToMongoUserData(data);
    }else{
        let userData = await commonDao.findOneData("userModel", {uid: uid});
        if (!userData){
            return null;
        }else{
            await redisClient.hmset(USER_CACHE_DATA_HEAD + uid, userInfoServices.convertMongoUserDataToRedisUserData(userData._doc));
            return userData._doc;
        }
    }
};

dao.updateUserDataByUid = async function (uid, saveData) {
    return await commonDao.findOneAndUpdateEx("userModel", {uid: uid}, saveData, {new: true});
};

dao.updateUserData = async function (matchData, saveData) {
    return  await commonDao.findOneAndUpdateEx("userModel", matchData, saveData, {new: true});
};

dao.updateUserDataAndUnlockByUid = async function (uid, saveData) {
    saveData.syncLock = 0;
    return await commonDao.findOneAndUpdateEx("userModel", {uid: uid}, saveData, {new: true});
};

dao.updateUserDataAndUnlock = async function (matchData, saveData) {
    saveData.syncLock = 0;
    return await commonDao.findOneAndUpdateEx("userModel", matchData, saveData, {new: true});
};

dao.unlockUserData = async function (uid) {
    await commonDao.updateData("userModel", {uid: uid}, {syncLock: 0});
};

dao.updateUserDataArr = async function (saveDataArr) {
    let tasks = [];
    let addTack = function(changeUserData){
        tasks.push(new Promise(async function (resolve) {
            try{
                let userData = await dao.updateUserData(changeUserData.matchData, changeUserData.saveData).catch((e)=>{
                    logger.error(e.stack);
                    resolve();
                });
                resolve(userData);
            }catch (err){
                logger.error("updateUserDataArr", JSON.stringify(err));
                resolve(null);
            }
        }));
    };
    for (let i = 0; i < saveDataArr.length; ++i){
        addTack(saveDataArr[i]);
    }
    return await Promise.all(tasks);
};