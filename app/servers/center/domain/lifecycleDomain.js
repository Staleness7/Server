let domain = module.exports;
let logger = require('pomelo-logger').getLogger('pomelo');
let parameterServices = require('../../../services/configServices');
let commonDao = require('../../../dao/commonDao');

domain.afterStartup = async function (cb) {
    await domain.loadParameter();
    cb();
};

domain.afterStartAll = async function () {
    await commonDao.updateDataEx('uniqueIDModel', {key: 1}, {$setOnInsert: {unionInviteID: 21130144}}, {upsert: true});
};

domain.loadParameter = async function () {
    await parameterServices.loadConfig();
    logger.debug("http load parameter finished");
};