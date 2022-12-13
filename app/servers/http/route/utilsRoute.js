let request = require('request');
let qr = require('qr-image');
let authServices = require('../../../services/authServices');
let pomelo = require('pomelo');
let code = require('../../../constant/code');

module.exports = function (app, http) {
    // 发送验证码
    http.post('/getSMSCode', async function (req, res) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        try {
            await authServices.sendSmsAuthCode(req.body.phoneNumber);

            res.end(JSON.stringify({code: code.OK}));
        }catch(e) {
            res.end(JSON.stringify({code: code.SMS_SEND_FAILED}));
        }
    });
};
