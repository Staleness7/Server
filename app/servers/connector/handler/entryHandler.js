let code = require('../../../constant/code');
let token = require('../../../util/token');
let userDao = require('../../../dao/userDao');
let logger = require('pomelo-logger').getLogger('logic');
let userInfoServices = require('../../../services/userInfoServices');
let pomeloServices = require('../../../services/pomeloServices');
let configServices = require('../../../services/configServices');
let dispatch = require('../../../util/dispatcher');
let rpcAPI = require('../../../API/rpcAPI');

module.exports = function(app) {
  return new Handler(app);
};

let Handler = function(app) {
  this.app = app;
};

Handler.prototype.entry = async function(msg, session, next) {
    try {
        // 检查服务器状态
        let isAllServerStarted = this.app.get('allServerStarted');
        if (!isAllServerStarted){
            next(null, {code: code.SERVER_MAINTENANCE});
            return;
        }
        // 检查token
        if(!msg.token){
            next(null, {code: code.REQUEST_DATA_ERROR});
            return;
        }
        let authInfo = token.parseToken(msg.token);
        if (!token.checkToken(authInfo)) {
            next(null, {code: code.TOKEN_INFO_ERROR});
            return;
        }
        let uid = authInfo.uid;
        let userInfo = msg.userInfo;
        // 检查登录状态
        let sessionService = this.app.get('sessionService');
        let checkLogin = function () {
            return new Promise((resolve, reject) => {
                sessionService.kick(uid, function (err) {
                    if (!!err){
                        logger.error("kick uid err");
                    }
                    session.on('closed', onUserLeave.bind(null, this.app));
                    session.bind(uid, function (err) {
                        if (!!err){
                            reject(code.FAIL);
                        }else{
                            resolve();
                        }
                    });
                }.bind(this));
            });
        }.bind(this);
        await checkLogin();
        // 获取用户信息
        let userData = await userDao.getUserDataByUid(uid);
        if (!userData){
            userData = await userInfoServices.createUserThenLoad(uid, userInfo);
        }
        // 检查帐号冻结
        if (!!userData.isBlockedAccount){
            next(null, {code: code.BLOCKED_ACCOUNT});
            return;
        }
        // 设置房间
        let roomID = "";
        if(userData.roomID){
            let gameServers = this.app.getServersByType('game');
            let gameServer = dispatch.dispatch(userData.roomID, gameServers);
            let isIn = await rpcAPI.isUserInRoom(gameServer.id, session.uid, userData.roomID);
            if (isIn){
                roomID = userData.roomID;
                await pomeloServices.pushSessionData(session, 'roomID', userData.roomID);
            }
        }

        // 更新用户信息
        let updateUserData = {
            syncLock: 0,            // 登录时清除金币锁，防止数据锁死
            lastLoginIP: sessionService.getClientAddressBySessionId(session.id).ip.split(':').pop(),
            lastLoginTime: Date.now(),
            frontendId: this.app.getServerId(),
            roomID: roomID
        };
        if (!!userInfo && userInfo.nickname) updateUserData.nickname = userInfo.nickname;
        if (!!userInfo && userInfo.avatar) updateUserData.avatar = userInfo.avatar;
        if (!!userInfo && userInfo.lastLoginIP) updateUserData.lastLoginIP = userInfo.lastLoginIP;
        if (!!userInfo && ("sex" in userInfo)) updateUserData.sex = userInfo.sex;
        if (!!userInfo && ("address" in userInfo)) updateUserData.address = userInfo.address;
        let newEmailArr = userInfoServices.getNewUserEmail(userData.emailArr, userData.lastLoginTime);
        if (!!newEmailArr) updateUserData.emailArr = newEmailArr;
        userData = await userDao.updateUserDataByUid(uid, updateUserData);
        next(null, {code: code.OK, msg: {
            userInfo: userData,
            config: configServices.buildClientConfig(this.app.get('config'))
        }});
    }catch (err) {
        logger.error('connector entry error:' + err);
        next(null, {code: typeof err !== 'number'?500:err});
    }
};

let onUserLeave = async function (app, session) {
    if (!session || !session.uid) return;
    let uid = session.uid;
    try {
        let userData  = await userDao.getUserDataByUid(session.uid);
        if (!userData){
            logger.warn('not find leave user uid:' + session.uid);
        }else{
            if (!!userData.roomID){
                let gameServer = dispatch.dispatch(userData.roomID, app.getServersByType('game'));
                rpcAPI.rpc('game.roomRemote.leaveRoom', gameServer.id, userData.roomID, session.uid, async function (err) {
					/* console.log(err); */
                    /*if (!!err) logger.error('onUserLeave.leaveRoom err:' + err);
                    await userDao.syncCacheUserData(uid);*/
                });
            }
            await userDao.updateUserDataByUid(session.uid, {frontendId: ""});
        }
    }catch (err){
        logger.error('onUserLeave error:' + err);
    }
};
