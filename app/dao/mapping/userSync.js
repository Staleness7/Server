let utils = require('../../util/utils');
let code = require('../../constant/code');
let logger = require('pomelo-logger').getLogger('pomelo');
module.exports = {
    updateUser: function (dbclient, data, cb) {
        let uid = data.uid || null;
        if (!!uid){
            let setData = {};
            for (let key in data){
                if (data.hasOwnProperty(key) && key !== 'uid'){
                    setData[key] = data[key];
                }
            }
            dbclient.userModel.update({uid: uid}, {$set: setData}).exec(function (err, res) {
                if (!!err) {
                    logger.error("userSync", "updateUser uid:" + uid + ",saveData:" + JSON.stringify(setData));
                    utils.invokeCallback(cb, err, null);
                } else {
                    utils.invokeCallback(cb, null, res);
                }
            })
        } else {
            logger.error("userSync", "uid is invalid");
            utils.invokeCallback(cb, code.INVALID_UERS, null);
        }
    }
};