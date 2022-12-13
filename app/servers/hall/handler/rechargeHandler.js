let code = require('../../../constant/code');
let rechargeServices = require('../../../services/rechargeServices');
let enumeration = require('../../../constant/enumeration');

module.exports = function(app) {
    return new Handler(app);
};

let Handler = function(app) {
    this.app = app;
    this.publicParameter = app.get('config');
};

Handler.prototype.purchaseItem = function (msg, session, next){
    if (!session.uid){
        next(null, {code: code.INVALID_UERS});
        return;
    }
    let count = msg.count;
    if (!count || typeof count !== 'number' || count <= 0){
        next(null, {code: code.REQUEST_DATA_ERROR});
        return;
    }
    let config = this.app.get('config');
    if (config['freeShopItem'] === 'free'){
        rechargeServices.sendPurchaseItem(session.uid, count, enumeration.RechargePlatform.NONE, {userOrderID: 0, platformReturnOrderID:0})
            .then(()=>{
                next(null, {code: code.OK});
            })
            .catch(err=>{
                next(null, {code: err});
            });
    }else {
        next(null, {code: code.REQUEST_DATA_ERROR});
    }
};