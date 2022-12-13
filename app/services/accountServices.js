let code = require('../constant/code');
let dao = require('../dao/commonDao');
let enumeration = require('../constant/enumeration');
let dispatcher = require('../util/dispatcher');
let token = require('../util/token');

let services = module.exports;

services.checkAccountAndPassword = function (account, password, loginPlatform) {
    if (!account || !password || !loginPlatform) return false;
    if (typeof account !== 'string' || typeof password !== 'string') return false;
    if (loginPlatform === enumeration.loginPlatform.ACCOUNT){
        return account.length <= 20 && password.length <= 20;
    }else if (loginPlatform === enumeration.loginPlatform.MOBILE_PHONE){
        return account.length === 11 && password.length < 20;
    }else if (loginPlatform === enumeration.loginPlatform.WEI_XIN){
        return true;
    }
    return false;
};

services.registerAccount = async function (account, password, loginPlatform, registerInfo) {
    if (!services.checkAccountAndPassword(account, password, loginPlatform)){
        throw new Error(code.REQUEST_DATA_ERROR);
    }
    let saveData = {
        account: account,
        password: password
    };
    let matchData = {
        account: account,
        password: password,
        registerInfo: registerInfo
    };
    let accountData = await dao.findOneData("accountModel", matchData);
    if (!!accountData) {
        throw new Error(code.ACCOUNT_EXIST);
    }
    return await dao.createData("accountModel", saveData);
};

services.dispatcherServers = function (Servers, uid) {
    //根据userID 分配hall服务器
    if (!Servers || Servers.length === 0) {
        return null;
    }
    let connector = dispatcher.dispatch(uid, Servers);
    return {
        serverInfo: {
            host: connector.clientHost,
            port: connector.clientPort
        },
        token: token.createToken(uid,connector.id)
    };
};