/**
 *dispatch by uid
 */

module.exports.dispatch = function(uid, servers) {
    if(servers.length === 0)  {
		console.log('error: dispatch no servers');
		return null;
	}
    let index = parseInt(uid) % servers.length;
    return servers[index];
};
