let scheduler = require('pomelo-scheduler');
let dao = require('../../../dao/commonDao');
let userDao = require('../../../dao/userDao');
let pomelo = require('pomelo');
let logger = require('pomelo-logger').getLogger('logic');

let exp = module.exports;

exp.init = function(){
    this.dailyTaskSchedulerID = scheduler.scheduleJob('0 0 0 * * *', exp.dailyTaskScheduler);

    this.weekTaskSchedulerID = scheduler.scheduleJob('0 0 17 * * 0', exp.weekTaskScheduler);
};

exp.beforeShutdown = async function(cb){
    scheduler.cancelJob(this.dailyTaskSchedulerID);
    scheduler.cancelJob(this.weekTaskSchedulerID);
    await dao.updateAllData("userModel", {$or:[{roomID: {$ne:""}}, {frontendId: {$ne:""}}]}, {roomID: "", frontendId: ""});
    cb();
};

exp.dailyTaskScheduler = function(){
    logger.info('dailyTaskSchedulerClearData');
    // 删除3天前的订单生成记录
    {
        let matchData = {createTime: {"$lte": Date.now() - 3 * 24 * 60 * 60 * 1000}};
        dao.deleteData("rechargeOrderRecordModel", matchData).catch(function(err){
            logger.error('dailyTaskSchedulerClearData rechargeOrderRecordModel err:' + err);
        });
    }
    // 删除4天前的游戏记录
    {
        let matchData = {createTime: {"$lte": Date.now() - 4 * 24 * 60 * 60 * 1000}};
        dao.deleteData("userGameRecordModel", matchData).catch(function(err){
            logger.error('dailyTaskSchedulerClearData userGameRecordModel err:' + err);
        });
    }
    // 删除3天前的返利记录
    {
        let matchData = {createTime: {"$lte": Date.now() - 3 * 24 * 60 * 60 * 1000}};
        dao.deleteData("userRebateRecordModel", matchData).catch(function(err){
            logger.error('dailyTaskSchedulerClearData userRebateRecordModel err:' + err);
        });
    }
    // 删除7天前的改分记录和赠送记录和分数变化记录
    {
        let matchData = {createTime: {"$lte": Date.now() - 7 * 24 * 60 * 60 * 1000}};
        dao.deleteData("scoreModifyRecordModel", matchData).catch(function(err){
            logger.error('dailyTaskSchedulerClearData scoreModifyRecordModel err:' + err);
        });
        dao.deleteData("scoreGiveRecordModel", matchData).catch(function(err){
            logger.error('dailyTaskSchedulerClearData scoreGiveRecordModel err:' + err);
        });
        dao.deleteData("userScoreChangeRecordModel", matchData).catch(function(err){
            logger.error('dailyTaskSchedulerClearData userScoreChangeRecordModel err:' + err);
        });
    }
    // 将玩家进入数据复制到昨日数据
    let startTime = Date.now();
    let updateTotalCount = 0;
    function doLotsWork(cache) {
        updateTotalCount++;
        for(let i = 0; i < cache.length; ++i){
            let data = cache[i];
            if (data.unionInfo.length === 0) continue;
            for (let j = 0; j < data.unionInfo.length; ++j){
                let unionInfoItem = data.unionInfo[j];
                unionInfoItem.yesterdayDraw = unionInfoItem.todayDraw;
                unionInfoItem.todayDraw = 0;

                unionInfoItem.memberYesterdayDraw = unionInfoItem.memberTodayDraw;
                unionInfoItem.memberTodayDraw = 0;

                unionInfoItem.yesterdayBigWinDraw = unionInfoItem.todayBigWinDraw;
                unionInfoItem.todayBigWinDraw = 0;

                unionInfoItem.memberYesterdayBigWinDraw = unionInfoItem.memberTodayBigWinDraw;
                unionInfoItem.memberTodayBigWinDraw = 0;

                unionInfoItem.yesterdayProvideRebate = unionInfoItem.todayProvideRebate;
                unionInfoItem.todayProvideRebate = 0;

                unionInfoItem.yesterdayRebate = unionInfoItem.todayRebate;
                unionInfoItem.todayRebate = 0;

                unionInfoItem.yesterdayWin = unionInfoItem.todayWin;
                unionInfoItem.todayWin = 0;
            }
            userDao.updateUserDataByUid(data.uid, {unionInfo: data.unionInfo}).catch(e=>{logger.error(e.stack)})
        }
    }

    let model = pomelo.app.get('dbClient')["userModel"];
    let stream = model.find({}).stream();
    let cache = [];
    stream.on('data',function(item){
        cache.push(item);
        if(cache.length === 10){
            /** signal mongo to pause reading **/
            stream.pause();
            doLotsWork(cache);
            cache=[];
            /** signal mongo to continue, fetch next record **/
            stream.resume();
        }
    });
    stream.on('end',function(){
        if (cache.length !== 0){
            doLotsWork(cache);
            cache=[];
        }
        logger.info("dailyTaskScheduler time:" + (Date.now() - startTime) + "ms");
        logger.info('dailyTaskScheduler end, updateTotalCount:' + updateTotalCount);
    });
    stream.on('close',function(){
        logger.info('dailyTaskScheduler close');
    });
};

// 清理每周的总局数
exp.weekTaskScheduler = function(){
    logger.info('weekTaskSchedulerClearData');
    dao.updateAllData("userModel", {"unionInfo.weekDraw": {'$exists':true}}, {"unionInfo.$.weekDraw": 0}).catch(e=>{logger.error(e.stack)});
    logger.info('weekTaskScheduler close');
};