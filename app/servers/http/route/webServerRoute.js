let pomelo = require('pomelo');
let enumeration = require('../../../constant/enumeration');
let code = require('../../../constant/code');
let async = require('async');
let userDao = require('../../../dao/userDao');
let logger = require('pomelo-logger').getLogger('logic');
let rpcAPI = require('../../../API/rpcAPI');
let pushAPI = require('../../../API/pushAPI');
let userInfoServices = require('../../../services/userInfoServices');
let dispatch = require('../../../util/dispatcher');

module.exports = function (app, http) {
    http.post('/updateUserDataNotify', async function(req, res){
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        let uid = req.body.uid || null;
        let updateKeys = req.body.updateKeys || null;

        try {
            let userData = await userDao.getUserDataByUid(uid);
            if (!userData || !userData.frontendId){
                res.json({code: code.OK});
                return;
            }
            let updateUserData = {};
            for(let i = 0; i < updateKeys.length; ++i){
                let key = updateKeys[i];
                updateUserData[key] = userData[key];
            }
            await userInfoServices.updateUserDataNotify(uid, userData.frontendId, updateUserData);
            res.json({code:code.OK});
        }catch (err){
            res.json({code: err});
        }
    });

    http.post('/updateUnionDataNotify', async function(req, res){
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        let unionID = req.body.unionID || null;

        try {
            if (!unionID){
                res.json({code: code.OK});
                return;
            }
            let server = dispatch.dispatch(unionID, app.getServersByType('game'));
            if (!server){
                res.json({code: code.OK});
                return;
            }
            rpcAPI.rpc('game.notifyRemote.updateUnionDataNotify', server.id, unionID, function (err, data) {
                if (!!err){
                    res.send({code: err});
                }else{
                    res.send({code: code.OK, msg: {recordArr: [data]}})
                }
            })
        }catch (err){
            res.json({code: err});
        }
    });

    http.post('/reloadParameterNotify', function (req, res) {
        let servers = pomelo.app.getServers();
        for (let key in servers){
            if (servers.hasOwnProperty(key)){
                let server = servers[key];
                let route = server.serverType + '.notifyRemote.reloadParameterNotify';
                rpcAPI.rpc(route, server.id, function (err) {
                    if (!!err){
                        logger.error("reloadParameterNotify err:" + err);
                    }
                });
            }
        }
        res.send({code: code.OK});
    });

    http.post('/sendSystemBroadcast', function (req, res) {
        pushAPI.broadcastPush({content: req.body.content}, function (err) {
            if (!!err){
                res.send({code: code.FAIL});
            }else{
                res.send({code: code.OK});
            }
        })
    });
    
    http.post('/getGameControllerData', function (req, res) {
        let permission = parseInt(req.body.permission);

        if ((permission & enumeration.userPermissionType.GAME_CONTROL) === 0){
            res.send({code: code.PERMISSION_NOT_ENOUGH});
            return;
        }

        if (!req.body.kind){
            res.send({code: code.REQUEST_DATA_ERROR});
            return;
        }

        rpcAPI.rpc('robot.controllerRemote.getGameControllerData', 'robot-1', parseInt(req.body.kind), function (err, data) {
            if (!!err){
                res.send({code: err});
            }else{
                res.send({code: code.OK, msg: {recordArr: [data]}})
            }
        })
    });

    http.post('/updateGameControllerData', function(req, res) {
        let permission = req.body.permission;

        if ((permission & enumeration.userPermissionType.GAME_CONTROL) === 0){
            res.send({code: code.PERMISSION_NOT_ENOUGH});
            return;
        }

        if (!req.body.kind){
            res.send({code: code.REQUEST_DATA_ERROR});
            return;
        }

        let data = JSON.parse(req.body.data);

        rpcAPI.rpc('robot.controllerRemote.updateGameControllerData', 'robot-1', parseInt(req.body.kind), data, function (err) {
            res.send({code: !!err?err:code.OK});
        })
    });
    
    http.post('/modifyInventoryValue', function (req, res) {
        let permission = req.body.permission;

        if ((permission & enumeration.userPermissionType.GAME_CONTROL) === 0){
            res.send({code: code.PERMISSION_NOT_ENOUGH});
            return;
        }

        if (!req.body.kind || !req.body.uid || !req.body.count){
            res.send({code: code.REQUEST_DATA_ERROR});
            return;
        }

        rpcAPI.rpc('robot.controllerRemote.modifyInventoryValue', 'robot-1', req.body.uid, parseInt(req.body.kind), parseFloat(req.body.count), function (err) {
            res.send({code: !!err?err:code.OK});
        })
    });

    http.post('/deleteUnionNotify', function (req, res) {
        let permission = req.body.permission;

        if (permission !== -1){
            res.send({code: code.PERMISSION_NOT_ENOUGH});
            return;
        }

        if (!req.body.unionID){
            res.send({code: code.REQUEST_DATA_ERROR});
            return;
        }

        let server = dispatch.dispatch(req.body.unionID, app.getServersByType('game'));
        rpcAPI.rpc('game.notifyRemote.deleteUnionDataNotify', server.id, req.body.unionID, function (err) {
            res.send({code: !!err?err:code.OK});
        })
    })
};