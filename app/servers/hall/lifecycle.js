let logger = require('pomelo-logger').getLogger('pomelo');
let lifecycleDomain = require('./domain/lifecycleDomain');

module.exports.beforeStartup = function (app, cb) {
    // do some operations before application start up
    logger.info(app.curServer.id, 'beforeStartup');
    cb();
};

module.exports.afterStartup = function (app, cb) {
    // do some operations after application start up
    logger.info(app.curServer.id, 'afterStartup');
    cb();
};

module.exports.beforeShutdown = function (app, cb) {
    // do some operations before application shutdown down
    logger.info(app.curServer.id, 'beforeShutdown');
    cb();
};

module.exports.afterStartAll = async function (app) {
    logger.info(app.curServer.id, 'afterStartAll');
    await lifecycleDomain.afterStartAll();
    logger.info(app.curServer.id, 'load config finished');
};
