let utils = require('./app/util/utils');
let arr = utils.randomRedPacket(1000, 20);
console.log(arr);

let total = 0;
for (let i = 0; i < arr.length; ++i){
    total += arr[i];
}
console.log(total);
