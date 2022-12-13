let pomelo = require('pomelo');
let async = require('async');
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
    lifecycleDomain.afterStartup(function(){
        logger.info(app.curServer.id, 'load config finished');
        cb();
    });
};

module.exports.beforeShutdown = function (app, cb) {
    // do some operations before application shutdown down
    logger.info(app.curServer.id, 'beforeShutdown');
    console.time('ShutDown' + app.curServer.id);
    pomelo.app.centerManager.beforeShutdown(function () {
        console.timeEnd('ShutDown' + app.curServer.id);
        cb();
    }).catch(e=>{console.error(e)});
};

module.exports.afterStartAll = function (app) {
    logger.info(app.curServer.id, 'afterStartAll');

    lifecycleDomain.afterStartAll().catch(e=>{console.error(e)});
};
