let pomelo = require('pomelo');
let enumeration = require('../../../constant/enumeration');
let code = require('../../../constant/code');
let accountServices = require('../../../services/accountServices');
let commonDao = require('../../../dao/commonDao');
let logger = require('pomelo-logger').getLogger('logic');
let authServices = require('../../../services/authServices');
let token = require('../../../util/token');
let utils = require('../../../util/utils');

let TOKEN_RECONNETION_INVALID_TIME = 24 * 60 * 60 * 1000;

module.exports = function (app, http) {

    async function register(req,res){
        if (enumeration.webAccess)
        {
            res.header("Access-Control-Allow-Origin", "*");
            res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
            res.header('Access-Control-Allow-Headers', 'Content-Type');
        }

        let account = req.body.account || null;
        let password = req.body.password || null;
        let loginPlatform = req.body.loginPlatform || null;
        loginPlatform = parseInt(loginPlatform);
        let registerInfo = req.body.registerInfo || JSON.stringify({});
        let smsCode = req.body.smsCode || "";
        let saveData = {};
        let matchData = {};
        if (loginPlatform === enumeration.loginPlatform.ACCOUNT) {
            if (!accountServices.checkAccountAndPassword(account, password, loginPlatform)) {
                res.json({code: code.REQUEST_DATA_ERROR});
                return;
            }
            matchData.account = account;

            saveData.account = account;
            saveData.password = password;
            saveData.registerInfo = JSON.stringify(registerInfo);
        } else if (loginPlatform === enumeration.loginPlatform.WEI_XIN){
            matchData.wxAccount = account;

            saveData.wxAccount = account;
            saveData.registerInfo = JSON.stringify(registerInfo);
        } else if (loginPlatform === enumeration.loginPlatform.MOBILE_PHONE){
            let isAuthPhone = pomelo.app.get('config')["authPhone"] === "true";
            if (isAuthPhone) {
                if (!smsCode) {
                    res.json({code: code.SMS_CODE_ERROR});
                    return;
                } else {
                    if (!await authServices.authSmsCode(account, smsCode)) {
                        res.json({code: code.SMS_CODE_ERROR});
                        return;
                    }
                }
            }
            matchData.phoneAccount = account;

            saveData.phoneAccount = account;
            saveData.registerInfo = JSON.stringify(registerInfo);
        }
        try {
            let accountData = await commonDao.findOneData("accountModel", matchData);
            if (loginPlatform === enumeration.loginPlatform.ACCOUNT){
                if (!!accountData) {
                    res.json({code: code.ACCOUNT_EXIST});
                    return;
                }
            }
            // else if (loginPlatform === enumeration.loginPlatform.MOBILE_PHONE){
            //     if (!accountData) {
            //         res.json({code: code.NOT_FIND_BIND_PHONE});
            //         return;
            //     }
            // }
            if (!accountData) {
                let uid;
                let index = 100;
                // 创建新账户
                while(index > 0){
                    uid = utils.getRandomNum(100000, 999999);
                    let data = await commonDao.findOneData("accountModel", {uid: uid});
                    if (!data) break;
                    // 放置操作次数太多锁死
                    index--;
                    if (index <= 0){
                        res.json({code: code.FAIL});
                        return;
                    }
                }
                saveData.uid = uid;
                accountData = await commonDao.createData("accountModel", saveData);
            }
            let msg = accountServices.dispatcherServers(pomelo.app.getServersByType('connector'), accountData.uid);
            if (!msg) {
                res.json({code: code.GET_HALL_SERVERS_FAIL});
            } else {
                res.json({code: code.OK, msg: msg});
            }
        } catch (err) {
            logger.error("register err:" + JSON.stringify(err));
            res.json({code: err});
        }
    }
    // 帐号注册
    http.post('/register', register);

    // 帐号登录
    http.post('/login', async function (req, res) {
        if (enumeration.webAccess)
        {
            res.header("Access-Control-Allow-Origin", "*");
            res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
            res.header('Access-Control-Allow-Headers', 'Content-Type');
        }

        let account = req.body.account || null;
        let password = req.body.password || null;
        let loginPlatform = parseInt(req.body.loginPlatform) || null;
        if (!account || !password || !loginPlatform) {
            res.json({code: code.REQUEST_DATA_ERROR});
            return;
        }
        let matchData = {};
        if (loginPlatform === enumeration.loginPlatform.ACCOUNT){
            matchData.account = account;
            matchData.password = password;
        } else if (loginPlatform === enumeration.loginPlatform.WEI_XIN){
            matchData.wxAccount = account;
        } else{
            let smsCode = password;
            let isAuthPhone = pomelo.app.get('config')["authPhone"] === "true";
            logger.debug(JSON.stringify(pomelo.app.get('config')));
            logger.debug(isAuthPhone);
            if (isAuthPhone) {
                if (!smsCode) {
                    res.json({code: code.SMS_CODE_ERROR});
                    return;
                } else {
                    if (!await authServices.authSmsCode(account, smsCode)) {
                        res.json({code: code.SMS_CODE_ERROR});
                        return;
                    }
                }
            }

            matchData.phoneAccount = account;
        }
        let result = await commonDao.findOneData("accountModel", matchData);
        if (!result){
            logger.debug("没有查到账户，则直接注册");
            // res.json({code: code.NOT_FIND_BIND_PHONE});
            register(req,res);
        } else{
            let msg = accountServices.dispatcherServers(pomelo.app.getServersByType('connector'), result.uid);
            if(!msg){
                res.json({code: code.GET_HALL_SERVERS_FAIL});
            }else{
                res.json({code: code.OK, msg: msg});
            }
        }
    });

    // 重连
    http.post('/reconnection', async function(req, res) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        // 检查token
        if(!req.body.token){
            res.json({code: code.REQUEST_DATA_ERROR});
            return;
        }
        let authInfo = token.parseToken(req.body.token);
        if (!authInfo || !authInfo.serverID || !authInfo.timekey || !authInfo.uid) {
            res.json({code: code.REQUEST_DATA_ERROR});
            return;
        }
        let nowTime = Date.now();
        if ((nowTime - authInfo.timekey) > TOKEN_RECONNETION_INVALID_TIME){
            res.json(null, {code: code.TOKEN_INFO_ERROR});
            return;
        }
        let msg = accountServices.dispatcherServers(pomelo.app.getServersByType('connector'), authInfo.uid);
        if(!msg){
            res.json({code: code.GET_HALL_SERVERS_FAIL});
        }else{
            res.json({code: code.OK, msg: msg});
        }
    });
};
