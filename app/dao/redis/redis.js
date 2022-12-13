let redisClient = module.exports;
let redis = require( 'redis' );
let utils = require( '../../util/utils.js' );
let code = require('../../constant/code');
let _redis;

let redisConfig = require('../../../config/redis');

redisClient.init = function() {
	_redis = redis.createClient( redisConfig.redis.port, redisConfig.redis.host );
	if(redisConfig.redis.password.length > 0){
        _redis.auth(redisConfig.redis.password, function () {
            console.log('redis auth success');
        });
    }

	_redis.on('connect',function(){
        console.log('connect redis success');
    });

	return _redis;
};

redisClient.set = function (key, value) {
    return new Promise((resolve, reject) =>{
        _redis.set(key, value, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.get = function (key) {
    return new Promise((resolve, reject) =>{
        _redis.get(key, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.del = function (key) {
    return new Promise((resolve, reject) =>{
        _redis.del(key, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.hset = function( key, field, value ) {
    return new Promise((resolve, reject) =>{
        _redis.hset(key, field, JSON.stringify( value) , function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        })
    });
};

redisClient.hmset = function (key, obj) {
    return new Promise((resolve, reject) =>{
        _redis.hmset(key, obj, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.hget = function( key, field) {
    return new Promise((resolve, reject) =>{
        _redis.hget(key, field, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.hgetall = function( key ) {
    return new Promise((resolve, reject) =>{
        _redis.hgetall(key, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.hdel = function( key, field ) {
    return new Promise((resolve, reject) =>{
        _redis.hdel(key, field, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.multi = function (multiArr) {
    return new Promise((resolve, reject) =>{
        _redis.multi(multiArr).exec(function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.exists = function (key) {
    return new Promise((resolve, reject) =>{
        _redis.exists(key, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.hsetWithObj = async function (key, obj) {
    obj = utils.clone(obj);
    let multiArr = [];
    let incData = obj['$inc'];
    if (!!incData){
        for (let filed in incData){
            if (incData.hasOwnProperty(filed)){
                multiArr.push(["hincrbyfloat", key, filed, incData[filed]]);
            }
        }
        delete obj['$inc'];
    }

    multiArr.push(['hmset', key, obj]);
    return new Promise((resolve, reject)=> {
        if (multiArr.length > 0){
            _redis.multi(multiArr).exec(function (err, result) {
                if (!!err){
                    reject(code.SQL_ERROR);
                }else{
                    resolve(result);
                }
            });
        }else{
            resolve();
        }
    });

};

redisClient.hsetWithObjThenGet = async function (key, obj) {
    obj = utils.clone(obj);
    let multiArr = [];
    let incData = obj['$inc'];
    if (!!incData){
        for (let filed in incData){
            if (incData.hasOwnProperty(filed)){
                multiArr.push(["hincrbyfloat", key, filed, incData[filed]]);
            }
        }
        delete obj['$inc'];
    }
    if (utils.getLength(obj) > 0) multiArr.push(['hmset', key, obj]);
    multiArr.push(['hgetall', key]);
    return new Promise((resolve, reject) => {
        _redis.multi(multiArr).exec(function (err, replies) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(replies.pop());
            }
        });
    });
};

redisClient.keys = function (key) {
    return new Promise((resolve, reject) =>{
        _redis.keys(key, function (err, result) {
            if (!!err){
                reject(code.SQL_ERROR);
            }else{
                resolve(result);
            }
        });
    });
};

redisClient.flushall = function() {
    return new Promise((resolve, reject) =>{
        _redis.flushall(function (err) {
            if (!!err){
                reject(err);
            }else{
                resolve();
            }
        });
    });
};