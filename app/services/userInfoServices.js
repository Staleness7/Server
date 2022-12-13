let dao = require('../dao/commonDao');
let userDao = require('../dao/userDao');
let async = require('async');
let pushAPI = require('../API/pushAPI');
let pomelo = require('pomelo');
let code = require('../constant/code');
let utils = require('../util/utils');
let logger = require('pomelo-logger').getLogger('pomelo');

let service = module.exports;

service.createUserThenLoad = async function (uid, userInfo) {
    let saveData = {};
    saveData.uid = uid;
    saveData.gold = parseInt(pomelo.app.get("config")["startGold"] || '0');
    saveData.avatar = userInfo.avatar || "Common/head_icon_default";
    saveData.avatarFrame = "";
    saveData.nickname = userInfo.nickname || saveData.uid.toString();
    saveData.sex = userInfo.sex || 0;
    saveData.createTime = Date.now();

    await dao.createData('userModel', saveData);
    return await userDao.getUserDataByUid(uid);
};

service.updateUserDataNotify = async function (uid, sid, updateUserData){
    if (!uid) return;
    if (!!sid){
        await pushAPI.updateUserInfoPush(updateUserData, [{uid: uid, sid: sid}]);
    }else{
        let userData = await userDao.getUserDataByUid(uid);
        if (!userData || !userData.frontendId) return;
        await pushAPI.updateUserInfoPush(updateUserData, [{uid: uid, sid: sid}]);
    }
};

service.getNewUserEmail = function (userEmail, lastLoginTime) {
    let emailArr = userEmail.length > 0?JSON.parse(userEmail):[];
    let config = pomelo.app.get('config');
    // 删除过期邮件
    let isEmailUpdate = false;
    let newEmailArr = [];
    for (let i = 0; i < emailArr.length; ++i){
        let emailInfo = emailArr[i];
        if (utils.getIntervalDay(emailInfo.createTime, Date.now()) < 7){
            newEmailArr.push(emailArr[i]);
        }else{
            isEmailUpdate = true;
        }
    }
    let lastUpdateSystemEmailTime = parseInt(config["lastUpdateSystemEmailTime"]);
    // 检查是否有新的系统邮件
    if(lastLoginTime > 0 && lastUpdateSystemEmailTime > 0 && lastUpdateSystemEmailTime > lastLoginTime){
        if(!!config["systemEmail"]){
            let systemEmailArr = JSON.parse(config["systemEmail"]);
            for (let i = 0; i < systemEmailArr.length; ++i){
                let systemEmailInfo = systemEmailArr[i];
                let isExist = false;
                for (let j = 0; j < emailArr.length; ++j){
                    if (emailArr[j].id === systemEmailInfo.id){
                        isExist = true;
                        break;
                    }
                }
                if (!isExist && utils.getIntervalDay(systemEmailInfo.createTime, Date.now()) < 7){
                    newEmailArr.push(systemEmailInfo);
                    isEmailUpdate = true;
                }
            }

        }
    }
    return isEmailUpdate?JSON.stringify(newEmailArr):null;
};

service.convertMongoUserDataToRedisUserData = function (userData) {
    if (!userData) return null;
    let redisUserData = {};
    for (let key in userData){
        if (key === '_id') continue;
        if (userData.hasOwnProperty(key)){
            if (typeof userData[key] !== 'string' && key !== '$inc'){
                redisUserData[key] = userData[key].toString();
            }else{
                redisUserData[key] = userData[key];
            }
        }
    }
    return redisUserData;
};

service.convertRedisUserDataToMongoUserData = function (userData) {
    let schema = pomelo.app.get('dbClient')['userModel'].schema.tree;
    let redisUserData = {};
    for (let key in userData){
        if (userData.hasOwnProperty(key)){
            let schemaKey = schema[key];
            if (!!schemaKey && !!schemaKey.type && schemaKey.type.name === 'Number'){
                redisUserData[key] = parseFloat(userData[key]);
            }else{
                redisUserData[key] = userData[key];
            }
        }
    }
    return redisUserData;
};

service.buildShortUserInfo = function (userInfo){
    let shortUserInfo = {};
    if ('nickname' in userInfo) shortUserInfo.nickname = userInfo.nickname;
    if ('avatar' in userInfo) shortUserInfo.avatar = userInfo.avatar;
    if ('uid' in userInfo) shortUserInfo.uid = userInfo.uid;
    if ('sex' in userInfo) shortUserInfo.sex = userInfo.sex;
    return shortUserInfo;
};

service.buildShortMemberInfo = function (userInfo) {
    return{
        uid: userInfo.uid,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        achievement: userInfo.achievement,
        lastLoginTime: userInfo.lastLoginTime
    };
};

service.buildShortAgentInfo = function (userInfo) {
    return{
        uid: userInfo.uid,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        directlyMemberAchievement: userInfo.directlyMemberAchievement,
        agentMemberAchievement: userInfo.agentMemberAchievement,
        directlyMemberCount: userInfo.directlyMemberCount,
        agentMemberCount: userInfo.agentMemberCount,
        lastLoginTime: userInfo.lastLoginTime
    };
};

service.buildGameRoomUserInfo = function(userInfo){
    let buildUserInfo = {};
    if ('uid' in userInfo) buildUserInfo.uid = userInfo.uid;
    if ('nickname' in userInfo) buildUserInfo.nickname = userInfo.nickname;
    if ('avatar' in userInfo) buildUserInfo.avatar = userInfo.avatar;
    if ('gold' in userInfo) buildUserInfo.gold = userInfo.gold;
    if ('frontendId' in userInfo) buildUserInfo.frontendId = userInfo.frontendId;
    if ('unionInfo' in userInfo) buildUserInfo.unionInfo = userInfo.unionInfo;
    if ('address' in userInfo) buildUserInfo.address = userInfo.address;
    if ('location' in userInfo) buildUserInfo.location = userInfo.location;
    if ('lastLoginIP' in userInfo) buildUserInfo.lastLoginIP = userInfo.lastLoginIP;
    if ('sex' in userInfo) buildUserInfo.sex = userInfo.sex;
    for (let key in buildUserInfo){
        if (buildUserInfo.hasOwnProperty(key)){
            return buildUserInfo;
        }
    }
    return null;
};

service.buildGameRoomUserInfoWithUnion = function (userInfo, unionID) {
    let buildUserInfo = {};
    if ('uid' in userInfo) buildUserInfo.uid = userInfo.uid;
    if ('nickname' in userInfo) buildUserInfo.nickname = userInfo.nickname;
    if ('avatar' in userInfo) buildUserInfo.avatar = userInfo.avatar;
    if ('gold' in userInfo) buildUserInfo.gold = userInfo.gold;
    if ('frontendId' in userInfo) buildUserInfo.frontendId = userInfo.frontendId;
    if ('address' in userInfo) buildUserInfo.address = userInfo.address;
    if ('location' in userInfo) buildUserInfo.location = userInfo.location;
    if ('lastLoginIP' in userInfo) buildUserInfo.lastLoginIP = userInfo.lastLoginIP;
    if ('sex' in userInfo) buildUserInfo.sex = userInfo.sex;
    // 普通房间
    if (unionID === 1){
        buildUserInfo.score = 0;
        buildUserInfo.spreaderID = "";
    }else{
        if ('unionInfo' in userInfo) {
            let unionInfoItem = userInfo.unionInfo.find(function (ele){
                    return ele.unionID === unionID;
                }
            );
            if (!!unionInfoItem){
                buildUserInfo.score = unionInfoItem.score;
                buildUserInfo.spreaderID = unionInfoItem.spreaderID;
                buildUserInfo.prohibitGame = unionInfoItem.prohibitGame || false;
            }else{
                buildUserInfo.score = 0;
                buildUserInfo.spreaderID = "";
                buildUserInfo.prohibitGame = false;
            }
        }
    }

    for (let key in buildUserInfo){
        if (buildUserInfo.hasOwnProperty(key)){
            return buildUserInfo;
        }
    }
};
