let domain = module.exports;
let pomelo= require('pomelo');
let logger = require('pomelo-logger').getLogger('pomelo');
let async = require('async');
let rpcAPI = require('../../../API/rpcAPI');
let userInfoServices = require('../../../services/userInfoServices');
let roomServices = require('../../../services/roomServices');
let utils = require('../../../util/utils');
let dispatch = require('../../../util/dispatcher');
let code = require('../../../constant/code');

domain.init = function () {
    
};
