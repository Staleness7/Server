let mongoose = require('mongoose');
let autoIncrement = require("mongoose-auto-increment");
let Schema = mongoose.Schema;

let dbConfig = require('../../../config/mongo.json');
let MongoDbAddress;
if (dbConfig.mongo.user !== null && dbConfig.mongo.password !== null){
    MongoDbAddress = 'mongodb://' + dbConfig.mongo.user +':' + dbConfig.mongo.password + '@'+ dbConfig.mongo.host + ':' + dbConfig.mongo.port + '/' + dbConfig.mongo.database;
} else {
    MongoDbAddress = 'mongodb://' + dbConfig.mongo.host + ':'+ dbConfig.mongo.port + '/' + dbConfig.mongo.database;
}

let options = {
    auth: {authdb: "admin"},
    db: {native_parser: true},
    server: {poolSize: 5},
    user: dbConfig.mongo.user,
    pass: dbConfig.mongo.password
};
let db = mongoose.createConnection(MongoDbAddress, options);
autoIncrement.initialize(db);

// 帐号
let accountSchema = new Schema({
    uid: {type: Number, default: 0, unique: true},
    account: {type: String, default: ""},
    password: {type: String, default: ""},
    phoneAccount: {type: String, default: ""},
    wxAccount: {type: String, default: ""},
    registerInfo: {type: String, default: ""}
});

/*accountSchema.plugin(autoIncrement.plugin, {
    model: 'account',
    field: 'uid',
    startAt: 201345,
    incrementBy: 1
});*/

db.model('account', accountSchema);
exports.accountModel = db.model('account');

// 管理员
let adminSchema = new Schema({
    account: {type: String, default: ""},
    password: {type: String, default: ""},
    permission: {type: Number, default: 0},
    nickname: {type: String, default: ""},
    createTime: {type: Number, default: 0}
});

adminSchema.plugin(autoIncrement.plugin, {
    model: 'admin',
    field: 'uid',
    startAt: 100000,
    incrementBy: 1
});

db.model('admin', adminSchema);
exports.adminModel = db.model('admin');

// 赠送记录
let adminGrantRecordSchema = new Schema({
    uid: {type: String, default: ""},
    nickname: {type: String, default: ""},
    gainUid: {type: String, default: ""},
    type: {type: String, default: ""},
    count: {type: String, default: ""},
    createTime: {type: Number, default: 0}
});
db.model('adminGrantRecord', adminGrantRecordSchema);
exports.adminGrantRecordModel = db.model('adminGrantRecord');

// 用户
let userSchema = new Schema({
    // 基础信息
    uid: {type: String, default: ""},                           // 用户唯一ID
    nickname: {type: String, default: ""},                      // 昵称
    avatar: {type: String, default: ""},                        // 头像
    avatarFrame: {type: String, default: ""},                   // 头像框
    sex: {type: Number, default: 0},                            // 性别
    // 联盟信息
    unionInfo: [{
        inviteID: {type: Number, default: 0},                   // 我的邀请ID
        unionID: {type: Number, default: 0},                    // 联盟ID
        spreaderID: {type: String, default: ""},                // 推广员ID
        score: {type: Number, default: 0},                      // 积分数量
        safeScore: {type: Number, default: 0},                  // 保险柜积分
        partner: {type: Boolean, default: false},               // 是否是合伙人
        rebateRate: {type: Number, default: 0},                 // 返利比例

        todayDraw: {type: Number, default: 0},                  // 今日总局数
        yesterdayDraw: {type: Number, default: 0},              // 昨日总局数
        totalDraw: {type: Number, default: 0},                  // 总局数
        weekDraw: {type: Number, default: 0},                   // 每周局数

        memberTodayDraw: {type: Number, default: 0},            // 成员今日总局数
        memberYesterdayDraw: {type: Number, default: 0},        // 成员昨日总局数

        todayBigWinDraw: {type: Number, default: 0},            // 今日大赢家局数
        yesterdayBigWinDraw: {type: Number, default: 0},        // 昨日大赢家局数

        memberTodayBigWinDraw: {type: Number, default: 0},      // 成员今日大赢家局数
        memberYesterdayBigWinDraw: {type: Number, default: 0},  // 成员昨日大赢家局数

        todayProvideRebate: {type: Number, default: 0},         // 今日贡献返利
        yesterdayProvideRebate: {type: Number, default: 0},     // 昨日贡献返利

        todayRebate: {type: Number, default: 0},                // 今日返利
        yesterdayRebate: {type: Number, default: 0},            // 昨日返利
        totalRebate: {type: Number, default: 0},                // 总返利

        todayWin: {type: Number, default: 0},                   // 今日赢分
        yesterdayWin: {type: Number, default: 0},               // 昨日赢分

        prohibitGame: {type: Boolean, default: false},         // 禁止游戏
        joinTime: {type: Number, default: 0},                   // 加入时间
    }],
    gold: {type: Number, default: 0},                           // 金币(房卡)


    emailArr: {type: String, default: ""},                      // 邮件
    inviteMsg: [{
        uid: {type: String, default: ""},                       // 邀请人ID
        nickname: {type: String, default: ""},                  // 邀请人名字
        unionID: {type: Number, default: 0},                    // 俱乐部ID
        partner: {type: Boolean, default: false},               // 是否标记为合伙人
        unionName: {type: String, default: ""}                  // 俱乐部名字
    }],

    mobilePhone: {type: String, default: ""},                   // 绑定的手机
    realName: {type: String, default: ""},                      // 实名认证信息
    
    isAgent: {type: Boolean, default: false},                    // 是否是代理

    roomID: {type: String, default: ""},                        // 房间ID
    frontendId: {type: String, default: ""},                    // 前端服务器ID

    syncLock: {type: Number, default: 0},                       // 同步锁

    address: {type: String, default: ""},                       // 地理位置经纬度
    location: {type: String, default: ""},                      // 地理位置信息，国家省市街道

    isBlockedAccount: {type: Number, default: 0},               // 是否冻结帐号
    lastLoginIP: {type: String, default: ""},                   // 最后登录IP
    lastLoginTime: {type: Number, default: 0},                  // 最后登录时间
    createTime: {type: Number, default: 0}                      // 创建时间
});

userSchema.index({uid: 1});
db.model('user', userSchema);
exports.userModel = db.model('user');

// 通用参数
let configSchema = new Schema({
    key: {type: String, default: ""},
    value: {type: String, default: ""},
    describe: {type: String, default: ""}
});
db.model('config', configSchema);
exports.configModel = db.model('config');

// 唯一ID记录
let uniqueIDSchema = new Schema({
    key: {type: Number, default: 1},
    unionInviteID: {type: Number, default: 23467335}
});
db.model('uniqueID', uniqueIDSchema);
exports.uniqueIDModel = db.model('uniqueID');

// 联盟
let unionSchema = new Schema({
    ownerUid: {type: String, default: ""},              // 盟主Uid
    ownerNickname: {type: String, default: ""},         // 盟主昵称
    ownerAvatar: {type: String, default: ""},           // 盟主头像
    unionName: {type: String, default: ""},             // 联盟名字
    curMember: {type: Number, default: 0},              // 当前成员数量
    onlineMember: {type: Number, default: 0},           // 在线成员数量
    roomRuleList: [{
        gameType: {type: Number, default: 0},           // 游戏类型
        ruleName: {type: String, default: ""},          // 房间名字
        gameRule: {type: String, default: ""},          // 游戏规则
    }],
    allowCreateRoom: {type: Boolean, default: true},    // 是否允许创建房间
    maxRoomCount: {type: Number, default: 30},          // 最大房间数量
    notice: {type: String, default: ""},                // 公告
    noticeSwitch: {type: Boolean, default: false},     // 公告开关
    allowMerge: {type: Boolean, default: false},       // 允许合并
    opening: {type: Boolean, default: true},           // 是否正在营业
    joinRequestList: [{                                 // 加入请求列表
        uid: {type: String, default: ""},               // 请求者id
        nickname: {type: String, default: ""},          // 昵称
        avatar: {type: String, default: ""},            // 头像
        createTime: {type: Number, default: 0}          // 请求时间
    }],
    showRank: {type: Boolean, default: false},         // 是否允许显示排行榜
    showSingleRank: {type: Boolean, default: false},   // 是否允许显示单局排行榜
    showUnionActive: {type: Boolean, default: false},  // 是否允许显示联盟活动
    forbidInvite: {type: Boolean, default: false},     // 是否禁止邀请
    forbidGive: {type: Boolean, default: false},       // 是否禁止赠送分数
    hongBaoInfo: {                                     // 红包活动设置
        status: {type: Boolean, default: false},         // 活动开启状态
        startTime: {type: Number, default: 0},           // 开始时间
        endTime: {type: Number, default: 0},             // 结束时间
        count: {type: Number, default: 0},               // 个数
        totalScore: {type: Number, default: 0}           // 红包总分
    },
    hongBaoScoreList: {type: [Number], default: []},        // 红包金额列表
    resultLotteryInfo: {
        status: {type: Boolean, default: false},         // 活动开启状态
        countArr: {type: [Number], default: []},         // 金额
        rateArr: {type: [Number], default: []},          // 金额对应概率
    },
    hongBaoUidList: {type: [String], default: []},      // 红包领取用户列表
    createTime: {type: Number, default: 0},             // 创建时间
});
unionSchema.plugin(autoIncrement.plugin, {
    model: 'union',
    field: 'unionID',
    startAt: 30463,
    incrementBy: 1
});
unionSchema.index({unionID: 1});
db.model('union', unionSchema);
exports.unionModel = db.model('union');

// 保险柜操作记录
let safeBoxRecordSchema = new Schema({
    uid: {type: String, default: ""},                   // 操作者ID
    unionID: {type: String, default: ""},               // 联盟ID
    count: {type: String, default: ""},                 // 操作数量
    createTime: {type: Number, default: 0}              // 赠送时间
});
safeBoxRecordSchema.plugin(autoIncrement.plugin, {
    model: 'safeBoxRecord',
    field: 'index',
    startAt: 10000001,
    incrementBy: 1
});
db.model('safeBoxRecord', safeBoxRecordSchema);
exports.safeBoxRecordModel = db.model('safeBoxRecord');

// 改分记录
let scoreModifyRecordSchema = new Schema({
    uid: {type: String, default: ""},                   // 改成ID
    nickname: {type: String, default: ""},              // 改分昵称
    avatar: {type: String, default: ""},                // 改分头像
    gainUid: {type: String, default: ""},               // 被改分者ID
    gainNickname: {type: String, default: ""},          // 被改分者昵称
    unionID: {type: Number, default: 0},               // 联盟ID
    count: {type: Number, default: 0},                 // 数量
    createTime: {type: Number, default: 0}              // 时间
});
scoreModifyRecordSchema.plugin(autoIncrement.plugin, {
    model: 'scoreModifyRecord',
    field: 'index',
    startAt: 1000001,
    incrementBy: 1
});
db.model('scoreModifyRecord', scoreModifyRecordSchema);
exports.scoreModifyRecordModel = db.model('scoreModifyRecord');

// 赠送积分记录
let scoreGiveRecordSchema = new Schema({
    uid: {type: String, default: ""},                   // 改成ID
    nickname: {type: String, default: ""},              // 改分昵称
    gainUid: {type: String, default: ""},               // 被改分者ID
    gainNickname: {type: String, default: ""},          // 被改分者昵称
    unionID: {type: Number, default: 0},               // 联盟ID
    count: {type: Number, default: 0},                 // 数量
    createTime: {type: Number, default: 0}              // 时间
});
scoreGiveRecordSchema.plugin(autoIncrement.plugin, {
    model: 'scoreGiveRecord',
    field: 'index',
    startAt: 1000001,
    incrementBy: 1
});
db.model('scoreGiveRecord', scoreGiveRecordSchema);
exports.scoreGiveRecordModel = db.model('scoreGiveRecord');

// 每日数据记录
let gameProfitRecordSchema = new Schema({
    day: {type: String, default: ""},
    register: {type: Number, default: 0},               // 新增用户
    active: {type: Number, default: 0},                 // 活跃用户
    drawCount: {
        gameType: {type: Number, default: 0},           // 游戏类型
        count: {type: Number, default: 0},              // 游戏局数
    },
    expendGold: {type: Number, default: 0},             // 花费总金币数 
});
db.model('gameProfitRecord', gameProfitRecordSchema);
exports.gameProfitRecordSchemaModel = db.model('gameProfitRecord');

// 玩家游戏局数统计

// 发起订单记录
let rechargeOrderRecordSchema = new Schema({
    orderID: {type: String, default: ""},
    uid: {type: String, default: ""},
    itemID: {type: String, default: ""},
    createTime: {type: Number, default: 0}
});
db.model('rechargeOrderRecord', rechargeOrderRecordSchema);
exports.rechargeOrderRecordModel = db.model('rechargeOrderRecord');

// 充值记录
let rechargeRecordSchema = new Schema({
    uid: {type: String, default: ""},
    nickname: {type: String, default: ""},
    spreaderID: {type: String, default: "0"},
    rechargeMoney: {type: Number, default: 0},
    goldCount: {type: Number, default: 0},
    userOrderID: {type: String, default: ""},
    platformReturnOrderID: {type: String, default: ""},
    platform: {type: String, default: ""},
    createTime: {type: Number, default: 0}
});
rechargeRecordSchema.plugin(autoIncrement.plugin, {
    model: 'rechargeRecord',
    field: 'index',
    startAt: 1000000,
    incrementBy: 1
});
db.model('rechargeRecord', rechargeRecordSchema);
exports.rechargeRecordModel = db.model('rechargeRecord');

// 玩家游戏记录
let userGameRecordSchema = new Schema({
    roomID: {type: String, default: ""},
    unionID: {type: Number, default: 0},
    creatorUid: {type: String, default: ""},
    gameType: {type: Number, default: 0},
    userList: [{
        uid: {type: String, default: ""},
        nickname: {type: String, default: ""},
        avatar: {type: String, default: ""},
        score: {type: Number, default: 0},
        spreaderID: {type: String, default: ""}
    }],
    detail: {type: String, default: ""},
    videoRecordID: {type: Number, default: 0},
    createTime: {type: Number, default: 0}
});
userGameRecordSchema.plugin(autoIncrement.plugin, {
    model: 'userGameRecord',
    field: 'index',
    startAt: 1000000,
    incrementBy: 1
});
db.model('userGameRecord', userGameRecordSchema);
exports.userGameRecordModel = db.model('userGameRecord');

// 录像记录
let gameVideoRecordSchema = new Schema({
    roomID: {type: String, default: ""},
    gameType: {type: Number, default: 0},
    detail: {type: String, default: ""},
    createTime: {type: Number, default: 0}
});
gameVideoRecordSchema.plugin(autoIncrement.plugin, {
    model: 'gameVideoRecord',
    field: 'videoRecordID',
    startAt: 1000000,
    incrementBy: 1
});
db.model('gameVideoRecord', gameVideoRecordSchema);
exports.gameVideoRecordModel = db.model('gameVideoRecord');

// 玩家抽水记录
let userRebateRecordSchema = new Schema({
    uid: {type: String, default: ""},
    roomID: {type: String, default: ""},
    gameType: {type: Number, default: 0},
    unionID: {type: Number, default: 0},
    playerUid: {type: String, default: ""},
    totalCount: {type: Number, default: 0},
    gainCount: {type: Number, default: 0},
    start: {type: Boolean, default: false},
    createTime: {type: Number, default: 0}
});
db.model('userRebateRecord', userRebateRecordSchema);
exports.userRebateRecordModel = db.model('userRebateRecord');

// 短信验证码记录
let smsCodeRecordSchema = new Schema({
    phone: {type: String, default: ""},
    code: {type: String, default: ""},
    createTime: {type: Number, default: 0}
});
db.model('smsCodeRecord', smsCodeRecordSchema);
exports.smsCodeRecordModel = db.model('smsCodeRecord');

// 玩家分数变化记录
let userScoreChangeRecordSchema = new Schema({
    uid: {type: String, default: ""},                   // 玩家id
    nickname: {type: String, default: ""},              // 昵称
    unionID: {type: Number, default: 0},                // 联盟ID
    changeCount: {type: Number, default: 0},            // 分数变化
    leftCount: {type: Number, default: 0},              // 剩余分数
    leftSafeBoxCount: {type: Number, default: 0},       // 剩余保险柜分数
    changeType: {type: Number, default: 0},             // 改变类型
    describe: {type: String, default: ""},              // 描述
    createTime: {type: Number, default: 0}              // 操作时间
});
db.model('userScoreChangeRecord', userScoreChangeRecordSchema);
exports.userScoreChangeRecordModel = db.model('userScoreChangeRecord');