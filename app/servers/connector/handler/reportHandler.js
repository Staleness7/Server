module.exports = function(app) {
  return new Handler(app);
};

let Handler = function(app) {
  this.app = app;
};

Handler.prototype.getNetworkDelay = function(msg, session, next) {
    next();
};
