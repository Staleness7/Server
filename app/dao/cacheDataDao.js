let pomelo = require('pomelo');
let utils = require('../util/utils');

let dao = module.exports;

dao.setData = async function (key, value) {
    let redisClient = pomelo.app.get('redisClient');
    return await redisClient.set(key, value);
};

dao.getData = async function (key) {
    let redisClient = pomelo.app.get('redisClient');
    return await redisClient.get(key);
};

dao.deleteData = async function (key) {
    let redisClient = pomelo.app.get('redisClient');
    return await redisClient.del(key);
};