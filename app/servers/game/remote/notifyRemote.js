let domain = require('../domain/lifecycleDomain');
let unionManager = require('../domain/unionManager');

module.exports = function (app) {
    return new remote(app);
};

let remote = function (app) {
    this.app = app;
};
let pro = remote.prototype;

pro.reloadParameterNotify = function(cb){
    domain.loadParameter().then(()=>{cb()}).catch(()=>{});
};

pro.updateUnionDataNotify = async function (unionID, cb) {
    let union = await unionManager.getUnion(unionID);
    if (!union) {
        cb();
        return;
    }
    union.updateStatus().then(()=>{cb()}).catch(()=>{});
};

pro.deleteUnionDataNotify = function (unionID, cb) {
    unionManager.removeUnionCache(unionID);
    cb();
};