let pomelo = require('pomelo');
let sync = require('pomelo-sync-plugin');
let httpPlugin = require('pomelo-http-plugin');
let routeUtil = require('./app/util/routeUtil');
let logger = require('pomelo-logger').getLogger("logic");

/**
 * Init app for client.
 */
let app = pomelo.createApp();
app.set('name', 'PokerGame');

// route configuration
app.configure('production|development', function() {
    app.route('connector', routeUtil.connector);
    app.route('game', routeUtil.game);
});

app.configure('production|development', 'connector', function(){
    app.set('connectorConfig', {
            connector : pomelo.connectors.hybridconnector,
            heartbeat : 30,
            useProtobuf: false
        });

    let mongoClient = require('./app/dao/mongo/models');
    app.set('dbClient', mongoClient);

    // let redisClient = require('./app/dao/redis/redis');
    // redisClient.init();
    // app.set('redisClient', redisClient);
});

app.configure('production|development', 'hall', function () {
   app.set('connectorConfig',{
       connector : pomelo.connectors.hybridconnector,
       heartbeat : 30,
       useProtobuf: false
   });

    let mongoClient = require('./app/dao/mongo/models');
    app.set('dbClient', mongoClient);

    // let redisClient = require('./app/dao/redis/redis');
    // redisClient.init();
    // app.set('redisClient', redisClient);
});

app.configure('production|development', 'game', function () {
    app.set('connectorConfig',{
        connector : pomelo.connectors.hybridconnector,
        heartbeat : 30,
        useProtobuf: false
    });

    let mongoClient = require('./app/dao/mongo/models');
    app.set('dbClient', mongoClient);

    // let redisClient = require('./app/dao/redis/redis');
    // redisClient.init();
    // app.set('redisClient', redisClient);

    let unionManager = require('./app/servers/game/domain/unionManager');
    unionManager.init(app);
    app.unionManager = unionManager;
});

app.configure('production|development', 'http', function() {
    app.loadConfig('httpConfig', app.getBase() + '/config/http.json');
    app.use(httpPlugin, {
        http: app.get('httpConfig')[app.getServerId()]
    });

    let mongoClient = require('./app/dao/mongo/models');
    app.set('dbClient', mongoClient);

    // let redisClient = require('./app/dao/redis/redis');
    // redisClient.init();
    // app.set('redisClient', redisClient);
});

app.configure('production|development', 'center', function() {
    app.set('connectorConfig',{
        connector : pomelo.connectors.hybridconnector,
        heartbeat : 30,
        useProtobuf: false
    });

    let mongoClient = require('./app/dao/mongo/models');
    app.set('dbClient', mongoClient);

    // let redisClient = require('./app/dao/redis/redis');
    // redisClient.init();
    // app.set('redisClient', redisClient);

    let centerManager = require('./app/servers/center/domain/centerManager');
    centerManager.init();
    app.centerManager = centerManager;
});

// start app
app.start();

process.on('uncaughtException', function (err) {
    logger.error(' Caught exception: ' + err.stack);
});

process.on('unhandledRejection', (err) => {
    logger.error(' Caught exception: ' + err.stack);
    // application specific logging, throwing an error, or other logic here
});
