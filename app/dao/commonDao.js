let pomelo = require('pomelo');
let logger = require('pomelo-logger').getLogger('pomelo');
let code = require('../constant/code');

let dao = module.exports;

dao.createData = async function (modelKey, saveData) {
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("createData", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            let newData = new model(saveData);
            let res = await newData.save();
            return res._doc;
        }catch (err){
            logger.error("createData", " model=" + modelKey + ", saveData=" + JSON.stringify(saveData) + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.createDataArr = async function (modelKey, saveDataArr) {
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("createData", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            return await model.create(saveDataArr);
        }catch (err){
            logger.error("createData", " model=" + modelKey + ", saveData=" + JSON.stringify(saveDataArr) + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.findOneData = async function (modelKey, matchData) {
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("findOneData","not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            let res = await model.findOne(matchData);
            return !!res?res._doc:null;
        }catch (err){
            logger.error("findOneData", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData) + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.findData = async function (modelKey, matchData, sortData, startIndex, count) {
    sortData = sortData || {};
    startIndex = startIndex || 0;
    count = count || 1000;
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("findData", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            let recordArr = await model.find(matchData).sort(sortData).skip(startIndex).limit(count).exec();
            for (let i = 0; i < recordArr.length; ++i){
                recordArr[i] = recordArr[i]._doc;
            }
            return recordArr;
        }catch (err){
            logger.error("findData", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData) + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.findDataAndCount = async function (modelKey, startIndex, count, sortData, matchData) {
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("findDataAndCount", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            let recordArr = await model.find(matchData).sort(sortData).skip(startIndex).limit(count).exec();
            for (let i = 0; i < recordArr.length; ++i){
                recordArr[i] = recordArr[i]._doc;
            }
            let totalCount = await dao.getDataCount(modelKey, matchData);
            return {recordArr: recordArr, totalCount: totalCount};
        }catch (err){
            logger.error("findDataAndCount", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData) + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.getDataCount = async function (modelKey, matchData) {
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("getDataCount", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            return await model.find(matchData).count().exec();
        }catch (err){
            logger.error("getDataCount", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData) + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.findOneAndUpdate = async function (modelKey, matchData, saveData) {
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("findOneAndUpdate", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            let res = await model.findOneAndUpdate(matchData, saveData, {new: true});
            return !!res?res._doc:null;
        }catch (err){
            logger.error("getDataCount", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData) + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.findOneAndUpdateEx = async function (modelKey, matchData, saveData, options) {
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("findDataAndUpdateEx", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            let res = await model.findOneAndUpdate(matchData, saveData, options);
            return !!res?res._doc:null;
        }catch (err){
            logger.error("findDataAndUpdateEx", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData) + ", saveData=" + saveData + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};


dao.updateData = async function (modelKey, matchData, saveData){
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("updateData", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            return await model.update(matchData, saveData);
        }catch (err){
            logger.error("updateData", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData) + ", saveData=" + saveData + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.updateDataEx = async function (modelKey, matchData, saveData, options){
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("updateData", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            return await model.update(matchData, saveData, options);
        }catch (err){
            logger.error("updateDataEx", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData) + ", saveData=" + saveData + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.updateAllData = async function (modelKey, matchData, saveData) {
    return await dao.updateDataEx(modelKey, matchData, saveData, {multi: true});
};

dao.deleteData = async function (modelKey, matchData){
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("updateAllData", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            return await model.remove(matchData);
        }catch (err){
            logger.error("updateData", "model=" + modelKey + ", matchData=" + JSON.stringify(matchData)  + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};

dao.getStatisticsInfo = async function(modelKey, execData){
    let model = pomelo.app.get('dbClient')[modelKey];
    if (!model) {
        logger.error("updateAllData", "not find model:" + modelKey);
        throw new Error(code.SQL_ERROR);
    }else{
        try {
            return await model.aggregate(execData).exec();
        }catch (err){
            logger.error("getStatisticsInfo", "model=" + modelKey + ", execData=" + JSON.stringify(execData)  + ", err:" + err);
            throw new Error(code.SQL_ERROR);
        }
    }
};