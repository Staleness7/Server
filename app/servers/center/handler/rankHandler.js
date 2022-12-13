let code = require('../../../constant/code');

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
};

Handler.prototype.getTodayWinGoldCountRankRequest = function(msg, session, next){
    if(!session.uid){
        next(null, {code: code.INVALID_UERS});
    }else{
        next(null, {code: code.OK, msg: this.app.centerManager.getRankListData(msg.startIndex, msg.count, session.uid)});
    }
};