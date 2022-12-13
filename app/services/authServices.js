let utils = require('../util/utils');
let pomelo = require('pomelo');
let code = require('../constant/code');
let commonDao = require('../dao/commonDao');
let aliyunSmsServices = require('./aliyunSmsServices');
let captchapng = require('captchapng');

let CODE_TIME_OUT_TIME = 5 * 60 * 1000;

let services = module.exports;

services.sendSmsAuthCode = async function(phone) {
    // 获取短信配置信息
    let smsAuthConfig = pomelo.app.get('config')["smsAuthConfig"];
    if (!!smsAuthConfig) smsAuthConfig = JSON.parse(smsAuthConfig);
    if (!smsAuthConfig){
        throw new Error(code.SMS_CODE_ERROR);
    }
    if (!aliyunSmsServices.isInit){
        aliyunSmsServices.initAccessKey(smsAuthConfig["AccessKeyId"], smsAuthConfig["AccessKeySecret"]);
    }
    let verificationCode = utils.getRandomNum(1000, 9999).toString();
    let data = {
        PhoneNumbers: phone,	                            //要发送到短信的手机
        SignName: smsAuthConfig.SignName,			            //短信签名，阿里云短信平台申请
        TemplateCode: smsAuthConfig.TemplateCode,		        //短信模板Code，阿里云短信平台申请
        TemplateParam: '{"code":"' + verificationCode +'"}'
    };
    await aliyunSmsServices.sendRegistSms(data);
    commonDao.updateDataEx("smsCodeRecordModel", {phone: phone}, {code: verificationCode, createTime: Date.now()}, {upsert: true}).catch(err=>{});
};

services.authSmsCode = async function (phone, authCode) {
    try {
        let res = await commonDao.findOneData("smsCodeRecordModel" , {phone:phone});
        return (!!res && res.code === authCode && (Date.now() - res.createTime <= CODE_TIME_OUT_TIME));
    }catch (e){
        console.error(e);
        return false;
    }
};

services.getImgAuthCode = function (uniqueID) {
    let verificationCode = utils.getRandomNum(1000, 9999).toString();
    let p = new captchapng(100,60,verificationCode);                // width,height,numeric captcha
    p.color(80, 80, 80, 255);                                        // First color: background (red, green, blue, alpha)
    p.color(255, 255, 255, 255);                                     // Second color: paint (red, green, blue, alpha)

    let img = p.getBase64();

    // 存储到缓存服务器，
    cacheDataDao.setData("IMG_AUTH_CODE_" + uniqueID, verificationCode, CODE_TIME_OUT_TIME).catch(err=>{});
    return new Buffer(img,'base64');
};

services.authImgCode = async function (uniqueID, authCode) {
    return await cacheDataDao.getData("IMG_AUTH_CODE_" + uniqueID) === authCode;
};