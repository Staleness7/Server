let exp = module.exports;
let enumeration = require('../constant/enumeration');
let logger = require('pomelo-logger').getLogger('logic');

let gameList = [
    {gameType: enumeration.gameType.PDK, gameFrameSinkPath: 'paodekuai/gameFrame', maxPlayerCount: 2},
    {gameType: enumeration.gameType.NN, gameFrameSinkPath: 'niuniu/gameFrame', maxPlayerCount: 5},
    {gameType: enumeration.gameType.SG, gameFrameSinkPath: 'sangong/gameFrame', maxPlayerCount: 5},
    {gameType: enumeration.gameType.SZ, gameFrameSinkPath: 'sanzhang/gameFrame', maxPlayerCount: 2},
    {gameType: enumeration.gameType.ZNMJ, gameFrameSinkPath: 'majiang/gameFrame', maxPlayerCount: 4},
    {gameType: enumeration.gameType.DGN, gameFrameSinkPath: 'dougongniu/gameFrame', maxPlayerCount: 5},
];

exp.getDefaultMaxPlayerCount = function (gameType) {
    for (let i = 0; i < gameList.length; ++i){
        if (gameType === gameList[i].gameType){
            return gameList[i].maxPlayerCount;
        }
    }
    throw new Error('getDefaultMaxPlayerCount，游戏类型错误gameType=' + gameType);
};

exp.getGameFrameSink = function (gameType) {
    for (let i = 0; i < gameList.length; ++i){
        if (gameType === gameList[i].gameType){
            return gameList[i].gameFrameSinkPath;
        }
    }
    throw new Error('getGameFrameSink，游戏类型错误gameType=' + gameType);
};

let diamondConfig = {};
diamondConfig[enumeration.gameType.PDK] = {10: 4, 20: 8};
diamondConfig[enumeration.gameType.NN] =  {10: 4, 20: 8, 30: 12};
diamondConfig[enumeration.gameType.SZ] =  {6:  2, 12: 4, 15: 6, 20: 8};
diamondConfig[enumeration.gameType.SG] =  {10: 4, 20: 8, 30: 12};
diamondConfig[enumeration.gameType.ZNMJ] ={8:  4, 16: 8};
diamondConfig[enumeration.gameType.DGN] = {10: 4, 20: 8, 30: 12};

exp.oneUserDiamondCount = function (bureau, gameType) {
    try {
        return diamondConfig[gameType][bureau] || 1;
    }catch (e){
        logger.error(e.stack);
        logger.error("oneUserDiamondCount err: bureau=" + bureau + ",gameType=" + gameType );
        return 1;
    }
};


