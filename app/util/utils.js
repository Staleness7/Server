/**
 * Created by cuilifeng on 2014/5/29.
 */


let utils = module.exports;

// control letiable of func "myPrint"
let isPrintFlag = false;


/**
 * Check and invoke callback function
 */
utils.invokeCallback = function (cb) {
    if (!!cb && typeof cb === 'function') {
        cb.apply(null, Array.prototype.slice.call(arguments, 1));
    }
};

/**
 * clone an object
 */
utils.clone = function (origin) {
    if (!origin) {
        return;
    }

    let obj = {};
    for (let f in origin) {
        if (origin.hasOwnProperty(f)) {
            obj[f] = origin[f];
        }
    }
    return obj;
};

utils.size = function (obj) {
    if (!obj) {
        return 0;
    }

    let size = 0;
    for (let f in obj) {
        if (obj.hasOwnProperty(f)) {
            size++;
        }
    }

    return size;
};

// print the file name and the line number ~ begin
function getStack() {
    let orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
        return stack;
    };
    let err = new Error();
    Error.captureStackTrace(err, arguments.callee);
    let stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
}

function getFileName(stack) {
    return stack[1].getFileName();
}

function getLineNumber(stack) {
    return stack[1].getLineNumber();
}

utils.myPrint = function () {
    if (isPrintFlag) {
        let len = arguments.length;
        if (len <= 0) {
            return;
        }
        let stack = getStack();
        let aimStr = '\'' + getFileName(stack) + '\' @' + getLineNumber(stack) + ' :\n';
        for (let i = 0; i < len; ++i) {
            aimStr += arguments[i] + ' ';
        }
        console.log('\n' + aimStr);
    }
};
// print the file name and the line number ~ end

utils.getProperties = function (model, fields) {
    let result = {};
    fields.forEach(function (field) {
        if (model.hasOwnProperty(field)) {
            result[field] = model[field];
        }
    });
    return result;
};

utils.setProperties = function (model, properties) {
    for (let prop in properties) {
        model[prop] = properties[prop];
    }
};

utils.multiplyProperties = function (properties, multiplier) {
    let result = {};
    for (let k in properties) {
        result[k] = Math.floor(properties[k] * multiplier);
    }
    return result;
};

utils.addProperties = function (toProps, fromProps) {
    for (let k in fromProps) {
        if (toProps[k]) {
            toProps[k] += fromProps[k];
        } else {
            toProps[k] = fromProps[k];
        }
    }

};

utils.isEmptyObject = function (obj) {
    for (let name in obj) {
        return false;
    }
    return true;
};

utils.getLength = function (obj) {
    let total = 0;
    for (let k in obj) {
        total++;
    }
    return total;
}

utils.getDist = function (fromPos, toPos) {
    let dx = toPos.x - fromPos.x;
    let dy = toPos.y - fromPos.y;
    return Math.sqrt(dx * dx + dy * dy);
};

utils.isPositiveInteger = function (num) {
    let r = /^[1-9][0-9]*$/;
    return r.test(num);
};

utils.ipToInt = function (ip) {
    let parts = ip.split(".");

    if (parts.length != 4) {
        return 0;
    }
    return (parseInt(parts[0], 10) << 24
        | parseInt(parts[1], 10) << 16
        | parseInt(parts[2], 10) << 8
        | parseInt(parts[3], 10)) >>> 0;
};

utils.getRandomNum = function (Min, Max) {
    let Range = Max - Min;
    let Rand = Math.random();
    return (Min + Math.round(Rand * Range));
};


utils.userId2Number = function (userId) {
    let hash = 5381,
        i = userId.length;

    while (i)
        hash = (hash * 33) ^ userId.charCodeAt(--i);

    /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
     * integers. Since we want the results to be always positive, convert the
     * signed int to an unsigned by doing an unsigned bitshift. */
    return Number(hash >>> 0);
};

utils.createJoinRoomID = function (serverID, roomID){
    let id = parseInt(serverID.split('-')[1]);
    if (!!id){
        return id * 1000 + roomID;
    }

    return 0;
};

utils.parseJoinRoomID = function (joinRoomID){
    joinRoomID = parseInt(joinRoomID);
    if (!!joinRoomID){
        return {
            gameServerID: 'game-' + Math.floor(joinRoomID/1000),
            roomID: joinRoomID % 1000
        };
    }
    return null;
};

let DAY_MS = 24 * 60 * 60 * 1000;
utils.getIntervalDay = function (time1, time2){
    return Math.abs((Math.floor(time1/DAY_MS) - Math.floor(time2/DAY_MS)));
};

utils.getTimeDay = function (time) {
    if(time !== 0){
        time = time || Date.now();
    }
    return Math.floor((time + 8 * 60 * 60 * 1000)/DAY_MS);
};

utils.parseQueryString = function(url){
    let obj = {};
    let start = url.indexOf("?")+1;
    let str = url.substr(start);
    let arr = str.split("&");
    for(let i = 0 ;i < arr.length;i++){
        let arr2 = arr[i].split("=");
        obj[arr2[0]] = arr2[1];
    }
    return obj;
};

utils.parseIntArr = function(str, c){
    c = c || '&';

    let arr = str.split(c);
    for (let i = 0; i < arr.length; ++i){
        arr[i] = parseInt(arr[i]);
    }
    return arr;
};

utils.getTimeTodayStart = function(){
    let now = Date.now();
    return now - (now%DAY_MS);
};

utils.getTimeWeekStart = function(){
    let now = new Date();
    let todayStart = now.getTime() - (now%DAY_MS);
    let week = now.getDay();
    let n = 0;
    if (week === 0){
        n = 6;
    }else{
        n = week - 1;
    }
    return todayStart - (DAY_MS * n);
};

//生成随机字符串
utils.randomString = function (len) {
    len = len || 16;
    let chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
    let maxPos = chars.length;
    let pwd = '';
    for (let i = 0; i < len; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
};

utils.getUniqueIndex = function () {
    let date = new Date();
    return "" + date.getFullYear() + date.getMonth() + date.getDay() + date.getHours() + date.getMinutes() + date.getSeconds() + date.getMilliseconds() + utils.getRandomNum(1000, 9999);
};

utils.getTimeIndex = function () {
    let date = new Date();
    return "" + date.getFullYear() + date.getMonth() + date.getDay() + date.getHours() + date.getMinutes() + date.getSeconds() + date.getMilliseconds() + utils.getRandomNum(1000, 9999);
};

//时间戳转换成日期
Date.prototype.format = function(format) {
    let date = {
        "M+": this.getMonth() + 1,
        "d+": this.getDate(),
        "h+": this.getHours(),
        "m+": this.getMinutes(),
        "s+": this.getSeconds(),
        "q+": Math.floor((this.getMonth() + 3) / 3),
        "S+": this.getMilliseconds()
    };
    if (/(y+)/i.test(format)) {
        format = format.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (let k in date) {
        if (new RegExp("(" + k + ")").test(format)) {
            format = format.replace(RegExp.$1, RegExp.$1.length === 1
                ? date[k] : ("00" + date[k]).substr(("" + date[k]).length));
        }
    }
    return format;
};

String.prototype.format = function(args) {
    let result = this;
    if (arguments.length > 0) {
        if (arguments.length === 1 && typeof (args) === "object") {
            for (let key in args) {
                if(args[key]!==undefined){
                    let reg = new RegExp("({" + key + "})", "g");
                    result = result.replace(reg, args[key]);
                }
            }
        }
        else {
            for (let i = 0; i < arguments.length; i++) {
                if (arguments[i] !== undefined) {
                    let reg = new RegExp("({[" + i + "]})", "g");
                    result = result.replace(reg, arguments[i]);
                }
            }
        }
    }
    return result;
};

utils.getStringRealLength = function(str) {
    let realLength = 0;
    for(let i = 0; i < str.length; ++i) {
        let count = str.charCodeAt(i);
        if(count >= 0 && count <= 128) {
            ++ realLength;
        } else {
            realLength += 2;
        }
    }
    return realLength;
};

// 根据经纬度获取，两点之间的距离,返回单位千米
utils.getDistanceByLocation = function (location1, location2) {
    let radLat1 = location1.x*Math.PI / 180.0;
    let radLat2 = location2.x*Math.PI / 180.0;
    let a = radLat1 - radLat2;
    let  b = location1.y*Math.PI / 180.0 - location1.y*Math.PI / 180.0;
    let s = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(a/2),2) +
        Math.cos(radLat1)*Math.cos(radLat2)*Math.pow(Math.sin(b/2),2)));
    s = s *6378.137 ;// EARTH_RADIUS;
    s = Math.round(s * 10000) / 10000;
    return s;
};

// 红包生成
utils.randomRedPacket = function (remainMoney,remainSize) {
    let moneyList=[];
    const min=1;
    let max,money;
    while (remainSize>1){
        max=remainMoney/remainSize*2;
        money=Math.random()*max;
        money=money<min ? min : money;
        money=Math.round(money);
        moneyList.push(money);
        remainSize--;
        remainMoney-=money;
    }

    moneyList.push(Math.round(remainMoney*100)/100);
    return moneyList;
};

