let enumeration = require('../constant/enumeration');
let rpcAPI = require('../API/rpcAPI');
let dao = require('../dao/commonDao');
let async = require('async');
let pomelo = require('pomelo');
let logger = require('pomelo-logger').getLogger('pomelo');
let utils = require('../util/utils');

let pro = module.exports;

pro.loadConfig = async function () {
    let defaultConfig = require(pomelo.app.getBase() + '/config/config.json');
    let shouldSave = pomelo.app.getServerId() === 'center';
    let result = await dao.findData("configModel", {});
    let configs = {};
    for (let key in defaultConfig){
        if(defaultConfig.hasOwnProperty(key)){
            let isExist = false;
            for (let i = 0; i < result.length; ++i){
                if (result[i].key === key){
                    isExist = true;
                    configs[key] = result[i].value;
                    break;
                }
            }
            if (!isExist){
                let value = defaultConfig[key].value;
                if (typeof value !== 'string'){
                    value = JSON.stringify(value);
                }
                if (shouldSave){
                    let saveData = {};
                    saveData.key = key;
                    saveData.value = value;
                    saveData.describe = defaultConfig[key].describe;

                    await dao.createData("configModel", saveData);
                }
                configs[key] = value;
            }
        }
    }
    for (let j = 0; j < result.length; ++j){
        if (configs.hasOwnProperty(result[j].key)) continue;
        configs[result[j].key] = result[j].value;
    }
    pomelo.app.set('config', configs);
};

pro.loadGameTypes = async function (cb) {
    let defaultGameTypes = require(pomelo.app.getBase() + '/config/gameTypes.json');
    let shouldSave = pomelo.app.getServerId() === 'center';
    let result = await dao.findData("gameTypeModel", {});
    let gameTypes = [];
    if (result.length === 0){
        for(let i = 0; i < defaultGameTypes.length; ++i){
            let gameType = defaultGameTypes[i];
            gameType.gameTypeID = utils.getUniqueIndex();
            gameTypes.push(gameType);
        }
        if(shouldSave){
            await dao.createDataArr("gameTypeModel", gameTypes);
        }
    }else{
        for (let j = 0; j < result.length; ++j){
            gameTypes.push(result[j]._doc);
        }
    }
    pomelo.app.set('gameTypes', gameTypes);
    utils.invokeCallback(cb);
};

pro.updateConfig = function(app, config, cb){
    app.set('config', config);
    let gameServerArr = app.getServersByType('game');
    for(let i = 0; i < gameServerArr.length; ++i){
        rpcAPI.rpc('game.roomRemote.updatePublicParameter', gameServerArr[i].id, config, function(err){
            if (!!err){
                logger.error("updatePublicParameter", "updatePublicParameterToGame err:" + err);
            }
        });
    }
    let hallServerArr = app.getServersByType('hall');
    for(let i = 0; i < hallServerArr.length; ++i){
        rpcAPI.rpc('hall.notifyRemote.updatePublicParameter', hallServerArr[i].id, config, function(err){
            if (!!err){
                logger.error("updatePublicParameter", "updatePublicParameterToGame err:" + err);
            }
        });
    }
    rpcAPI.rpc('http.notifyRemote.updatePublicParameter', hallServerArr[i].id, config, function(err){
        if (!!err){
            logger.error("updatePublicParameter", "updatePublicParameterToGame err:" + err);
        }
    });
    cb();
};

pro.updatePublicParameterByKey = function(app, operationType, key, value, cb){
    let publicParameter = app.get('publicParameter');
    let dataValue = publicParameter[key];
    async.waterfall([
        function(cb){
            if (operationType === enumeration.updateDataType.ADD || operationType === enumeration.updateDataType.UPDATE){
                if (!!dataValue){
                    dao.updateData("configModel", {key: key}, {value: value}, function(err){
                        if (!err){
                            publicParameter[key] = value;
                        }
                        cb(err);
                    });
                }else{
                    dao.createData("configModel", {key: key, value: value}, function(err){
                        if (!err){
                            publicParameter[key] = value;
                        }
                        cb(err);
                    });
                }
            } else if(operationType === enumeration.updateDataType.REMOVE){
                dao.deleteData({key: key}, function(err){
                    if (!err){
                        delete publicParameter[key];
                    }
                    cb(err);
                });
            } else{
                cb(code.REQUEST_DATA_ERROR);
            }
        }
    ], function(err){
        if (!!err){
            logger.error("updatePublicParameterByKey err:" + err);
        }else{
            app.set('publicParameter', publicParameter);
        }
        cb(err);
    });
};

pro.buildClientConfig = function(config){
    let defaultPublicParameters = require(pomelo.app.getBase() + '/config/config.json');
    let clientParameter = {};
    for (let key in config){
        if (config.hasOwnProperty(key)){
            if (!!defaultPublicParameters[key] &&!defaultPublicParameters[key].backend) {
                clientParameter[key] = config[key];
            }
        }
    }
    return clientParameter;
};

