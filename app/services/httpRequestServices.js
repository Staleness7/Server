/**
 * Created by 52835 on 2017/8/31.
 */
let request = require('request');
let code = require('../constant/code');
let xml2js = require('xml2js');
let service = module.exports;

service.httpGet = function(url){
    console.log('发送GET请求' + url);
    return new Promise((resolve, reject) =>{
        request(url, function(err, response, body){
            if (!!err || response.statusCode  !== 200){
                console.error('send http get request err:' + url);
                reject(code.FAIL);
            }else{
                console.log('收到GET数据', body);
                resolve(body);
            }
        });
    });

};

service.httpPost = function(url, requestData, cb){
    console.log('发送POST请求', url);
    console.log('POST参数', requestData);
    return new Promise((resolve, reject)=>{
        request({
            url: url,
            method:'POST',
            json: true,
            headers: {
                // "content-type": "application/json",
                "CONTENT-TYPE": "application/x-www-form-urlencoded"
            },
            body: JSON.stringify(requestData)
        }, function(err, response, body){
            if (!!err || response.statusCode  !== 200){
                console.error('send http post request err:' + url);
                reject(code.FAIL);
            }else{
                console.log('收到POST数据', body);
                resolve(body);
            }
        });
    });
};

service.httpPostXml = function (url, requestData) {
    return new Promise((resolve, reject)=>{
        let builder = new xml2js.Builder();  // JSON->xml
        let requestXmlData = builder.buildObject(JSON.stringify(requestData));

        console.log('发送POSTxml请求', url);
        console.log('POSTxml参数', requestData);

        request({
            url: url,
            method:'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'Content-Length': requestXmlData.length
            },
            body: requestXmlData
        }, function(err, response, body){
            let parser = new xml2js.Parser();   //xml -> json
            let data = parser.parseString(body);
            console.log(data);

            if (!!err || response.statusCode !== 200){
                console.error('send http post request err:' + url, body);
                reject(code.FAIL);
            }else{
                console.log('收到POSTxml数据', body);
                resolve(body);
            }
        });
    });
};