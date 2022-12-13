let constant = function () {
    this.OK = 0;                                    // 结果正确

    // 通用
    this.FAIL = 1;                                  // 请求失败
    this.REQUEST_DATA_ERROR = 2;                    // 请求数据错误
    this.SQL_ERROR = 3;                             // 数据库操作错误
    this.INVALID_UERS = 4;                          // 无效用户
    this.PERMISSION_NOT_ENOUGH = 6;                 // 权限不足
    this.SMS_CODE_ERROR = 7;                        // 短信验证码错误
    this.IMG_CODE_ERROR = 8;                        // 图形验证码错误
    this.SMS_SEND_FAILED = 9;                       // 短信发送失败
    this.SERVER_MAINTENANCE = 10;                   // 服务器维护
    this.NOT_ENOUGH_GOLD = 11;                      // 钻石不足
    this.USER_DATA_LOCKED = 12;                     // 用户数据被锁定
    this.NOT_ENOUGH_SCORE = 13;                     // 积分不足

    // 帐号相关
    this.ACCOUNT_OR_PASSWORD_ERROR = 101;           // 账号或密码错误
    this.GET_HALL_SERVERS_FAIL = 102;               // 获取大厅服务器失败
    this.ACCOUNT_EXIST = 103;                       // 账号已存在
    this.ACCOUNT_NOT_EXIST =  104;                  // 帐号不存在
    this.NOT_FIND_BIND_PHONE = 105;                 // 该手机号未绑定
    this.PHONE_ALREADY_BIND = 106;                  // 该手机号已被绑定，无法重复绑定
    this.NOT_FIND_USER = 107;                       // 用户不存在

    // 大厅相关
    this.TOKEN_INFO_ERROR = 201;                    // 无效的token
    this.NOT_ENOUGH_VIP_LEVEL = 202;                // vip等级不足
    this.BLOCKED_ACCOUNT = 203;                     // 帐号已冻结
    this.ALREADY_CREATED_UNION = 204;               // 已经创建过牌友圈，无法重复创建
    this.UNION_NOT_EXIST = 205;                     // 联盟不存在
    this.USER_IN_ROOM_DATA_LOCKED = 206;            // 用户在房间中，无法操作数据
    this.NOT_IN_UNION = 207;                        // 用户不在联盟中
    this.ALREADY_IN_UNION = 208;                    // 用户已经在联盟中
    this.INVITE_ID_ERROR = 209;                     // 邀请码错误
    this.NOT_YOUR_MEMBER = 210;                     // 添加的用户不是你的下级成员
    this.FORBID_GIVE_SCORE = 211;                   // 禁止赠送积分
    this.FORBID_INVITE_SCORE = 212;                 // 禁止玩家或代理邀请玩家
    this.CAN_NOT_CREATE_NEW_HONG_BAO = 213;         // 暂时无法分发新的红包

    // 游戏相关
    this.ROOM_COUNT_REACH_LIMIT = 301;              // 房间数量到达上线
    this.LEAVE_ROOM_GOLD_NOT_ENOUGH_LIMIT = 302;    // 金币不足，无法开始游戏
    this.LEAVE_ROOM_GOLD_EXCEED_LIMIT = 303;        // 金币超过最大限度，无法开始游戏
    this.CAN_NOT_LEAVE_ROOM = 305;                  // 正在游戏中无法离开房间
    this.NOT_IN_ROOM = 306;                         // 不在该房间中
    this.ROOM_PLAYER_COUNT_FULL = 307;              // 房间玩家已满
    this.ROOM_NOT_EXIST = 308;                      // 房间不存在
    this.CAN_NOT_ENTER_NOT_LOCATION = 309;          // 无法进入房间，获取定位信息失败
    this.CAN_NOT_ENTER_TOO_NEAR = 310;              // 无法进入房间，与房间中的其他玩家太近

    // 推送相关
    this.RECHARGE_FAIL = 401;                        // 充值失败
    this.RECHARGE_SUCCESS = 402;                     // 充值成功

    this[this.FAIL] = '请求失败';
    this[this.REQUEST_DATA_ERROR] = '请求数据错误';
    this[this.SQL_ERROR] = '数据库操作错误';
    this[this.INVALID_UERS] = '无效用户';
    this[this.PERMISSION_NOT_ENOUGH] = '权限不足';
    this[this.SMS_CODE_ERROR] = '短信验证码错误';
    this[this.IMG_CODE_ERROR] = '图形验证码错误';
    this[this.SMS_SEND_FAILED] = '短信发送失败';
    this[this.SERVER_MAINTENANCE] = '服务器正在维护中，请稍后再试';
    this[this.NOT_ENOUGH_GOLD] = '钻石不足';
    this[this.USER_DATA_LOCKED] = '用户数据被锁定，请退出房间后重试';
    this[this.NOT_ENOUGH_SCORE] = '积分不足';

    this[this.ACCOUNT_OR_PASSWORD_ERROR] = '账号或密码错误';
    this[this.GET_HALL_SERVERS_FAIL] = '获取大厅服务器失败';
    this[this.ACCOUNT_EXIST] = '账号已存在';
    this[this.ACCOUNT_NOT_EXIST] = '帐号不存在';
    this[this.NOT_FIND_BIND_PHONE] = '该手机号未绑定用户';
    this[this.PHONE_ALREADY_BIND] = '该手机号已被绑定，无法重复绑定';
    this[this.NOT_FIND_USER] = '用户不存在';
    this[this.NOT_IN_ROOM] = '不在该房间中';
    this[this.CAN_NOT_ENTER_NOT_LOCATION] = '无法进入房间，获取定位信息失败';
    this[this.CAN_NOT_ENTER_TOO_NEAR] = '无法进入房间，与房间中的其他玩家太近';

    this[this.TOKEN_INFO_ERROR] = 'token无效';
    this[this.NOT_ENOUGH_VIP_LEVEL] = 'vip等级不足';
    this[this.BLOCKED_ACCOUNT] = '帐号被冻结，禁止登录';
    this[this.ALREADY_CREATED_UNION] = '已经创建过牌友圈，无法创建多个';
    this[this.UNION_NOT_EXIST] = '联盟不存在';
    this[this.USER_IN_ROOM_DATA_LOCKED] = '玩家正在房间中，无法操作数据';
    this[this.NOT_IN_UNION] = '用户不在联盟中';
    this[this.ALREADY_IN_UNION] = '用户已经在联盟中';
    this[this.INVITE_ID_ERROR] = '邀请码错误';
    this[this.NOT_YOUR_MEMBER] = '添加的用户不是你的下级成员';
    this[this.FORBID_GIVE_SCORE] = '当前联盟禁止赠送积分';
    this[this.FORBID_INVITE_SCORE] = '当前联盟禁止玩家或代理邀请新玩家';
    this[this.CAN_NOT_CREATE_NEW_HONG_BAO] = '暂时无法创建新的红包';

    this[this.ROOM_COUNT_REACH_LIMIT] = '房间数量到达上线';
    this[this.LEAVE_ROOM_GOLD_NOT_ENOUGH_LIMIT] = '金币低于房间的金币下限';
    this[this.LEAVE_ROOM_GOLD_EXCEED_LIMIT] = '金币超过房间的金币上限';
    this[this.CAN_NOT_LEAVE_ROOM] = '当前正在游戏中，无法离开房间';
    this[this.ROOM_PLAYER_COUNT_FULL] = '房间玩家已满';
    this[this.ROOM_NOT_EXIST] = '房间不存在';

    this[this.RECHARGE_FAIL] = '充值失败';
    this[this.RECHARGE_SUCCESS] = '充值成功';

    this[500] = '请求超时';

};
module.exports = new constant();

