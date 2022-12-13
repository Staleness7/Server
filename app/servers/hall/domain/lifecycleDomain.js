let domain = module.exports;
let pomelo = require('pomelo');
let logger = require('pomelo-logger').getLogger('pomelo');
let utils = require('../../../util/utils');
let parameterServices = require('../../../services/configServices');
let async = require('async');

domain.afterStartAll = async function (cb) {
    await domain.loadParameter();
    utils.invokeCallback(cb);
};

domain.loadParameter = async function () {
    await parameterServices.loadConfig();
    logger.debug("hall load parameter finished");
};