let enumeration = module.exports;

enumeration.webAccess = true;

enumeration.gameType = {
    SZ: 1,              // 拼三张
    NN: 2,              // 牛牛
    PDK: 3,             // 跑得快
    SG: 4,              // 三公
    ZNMJ: 5,            // 扎鸟麻将
    SY: 6,               // 水鱼
	DGN: 8, // 斗公牛
};

// 登录平台
enumeration.loginPlatform = {
    NONE: 0,
    ACCOUNT: 1,
    WEI_XIN: 2,
    MOBILE_PHONE: 3
};

// 操作类型
enumeration.updateDataType = {
    NONE: 0,
    ADD: 1,
    REMOVE:2,
    UPDATE: 3
};

// 邮件状态
enumeration.emailStatus = {
    NONE: 0,
    NOT_RECEIVE: 1,
    RECEIVED: 2
};

// 第三方支付平台中的选择支付方式
enumeration.payType = {
    NONE: 0,
    ALI_PAY: 1,                 //支付宝
    WE_CHAT: 2,                 //微信
    UNION: 3                    //银行卡
};

// 广播类型
enumeration.broadcastType = {
    NONE: 0,
    LOOP: 1,                // 循环广播
    SYSTEM: 2,              // 系统广播
    BIG_WIN: 3              // 赢大奖广播
};

// 支付平台
enumeration.rechargePlatform = {
    NONE: 0
};

// ---------------------------------------房间相关----------------------------------------------
// 房间支付模式
enumeration.roomRentPayType = {
    BIG_WIN: 1,             // 大赢家模式
    AA: 2                   // 平均模式
};

// 房间类型
enumeration.roomType = {
    NONE: 0,
    NORMAL: 1,                  // 匹配类型
    CONTINUE: 2,                // 持续房间(类似捕鱼)
    HUNDRED: 3                  // 百人房间
};

// 游戏开始类型
enumeration.gameRoomStartType = {
    NONE: 0,
    ALL_READY: 1,
    AUTO_START: 2
};

// 房间解散原因
enumeration.gameRoomDismissReason = {
    NONE: 0,                     // 未知原因
    BUREAU_FINISHED: 1,          // 完成所有局数
    USER_DISMISS: 2,              // 用户解散
    UNION_OWNER_DISMISS: 3,      // 盟主解散
};

// 房间创建
enumeration.roomCreatorType = {
    NONE: 0,
    USER_CREATE: 1,             // 玩家创建
    UNION_CREATE: 2             // 联盟创建
};

// 房间费用支付方式
enumeration.roomPayType = {
    AAZHIFU: 1,
    YINGJIAZHIFU: 2,
    WOZHIFU: 3,
};

// 积分变化类型
enumeration.scoreChangeType = {
    NONE: 0,
    GIVE: 1,                            // 被赠送积分
    MODIFY_LOW: 2,                      // 修改下级分数
    MODIFY_UP: 3,                       // 被上级修改分数
    GAME_WIN: 4,                        // 游戏赢分
    GAME_START_UNION_CHOU: 5,           // 游戏开始联盟抽分
    GAME_WIN_CHOU: 6,                   // 游戏赢家抽分
    SAFE_BOX: 7,                        // 保险柜操作
};

// ---------------------------------------管理工具----------------------------------------------
// 权限类型
enumeration.userPermissionType = {
    NONE: 0,
    LOGIN_CLIENT:                   0x0001,             // 登录客户端
    LOGIN_MT:                       0x0002,             // 登录管理工具
    USER_MANAGER:                   0x0004,             // 用户管理
    USER_SYSTEM_MANAGER:            0x0008,             // 系统管理
    EXCHANGE_MANAGER:               0x0010,             // 兑换管理
    SPREAD_MANAGER:                 0x0020,             // 推广管理
    GAME_MANAGER:                   0x0040,             // 游戏管理
    DATA_MANAGER:                   0x0080,             // 数据统计
    GAME_CONTROL:                   0x0100,              // 游戏控制
    UNION_MANAGER:                  0X0200              // 联盟控制
};

// 记录类型
enumeration.recordType = {
    NONE: 0,
    RECHARGE: 1,                        // 充值记录
    WITHDRAWALS: 2,                     // 提现记录
    GAME: 3,                            // 游戏记录
    LOGIN: 4,                           // 登录记录
    EXTRACT_COMMISSION: 5,              // 提取佣金记录
    GAME_PROFIT: 6,                     // 游戏抽水记录
    EXTRACT_INVENTORY: 7,               // 库存抽取记录
    ADMIN_GRANT: 8,                     // 管理员赠送记录
    SAFE_BOX: 9,                        // 保险柜操作
};