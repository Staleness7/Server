let domain = module.exports;
let logger = require('pomelo-logger').getLogger('pomelo');
let utils = require('../../../util/utils');
let parameterServices = require('../../../services/configServices');

domain.afterStartup = function (cb) {
    utils.invokeCallback(cb);
};

domain.afterStartAll = async function (cb) {
    await domain.loadParameter();
    utils.invokeCallback(cb);
};

domain.loadParameter = async function () {
    await parameterServices.loadConfig();
    logger.debug("http load parameter finished");
};



