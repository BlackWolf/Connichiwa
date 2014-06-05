/**
 * Variables we get passed from CWWebserver:
 *     SERVER_PORT -- the port the HTTP server is supposed to run on
 *     RESOURCES_PATH -- Full path to the root of ConnichiwaResources.bundle. Must be used to access resource files.
**/

var http    = require('http');
var fs      = require('fs');

var server = http.createServer(function(req, res) {
  console.log((new Date()) + ' Received request for ' + req.url);

  var data = fs.readFileSync(RESOURCES_PATH + '/test.html');

  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(data);
  res.end();
});

server.listen(SERVER_PORT);

/*
function sendMessageToMaster(message) {
	if (includeServer == undefined) includeServer = true;

	for (var i=0; i<wsConnections.length; i++) {
		wsConnections[i].sendUTF(message);
	}

	if (includeServer) {
		objc_receivedMessage(message);
	}
}
*/
