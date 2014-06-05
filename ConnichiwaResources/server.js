/**
 *
 * Constants passed from CWWebserver:
 *     SERVER_PORT -- the port the HTTP server is supposed to run on
 *     DOCUMENT_ROOT -- the root of the web application. Must be put before file paths of the web application.
 *     RESOURCES_PATH -- Full path to the root of ConnichiwaResources.bundle. Must be used to access Connichiwa resource files.
 *
**/

var http    = require('http');
var fs      = require('fs');
var connect = require('connect');

var server = connect.createServer();

server.use('/public', function(req, res) {
  res.write("public!");
  res.end();
});

server.use(function(req, res, next) {
  console.log("LOL!");
  next();
});

server.use(function(req, res, next) {
  res.write("hallo!");
  res.end();
});

/*
var server = http.createServer(function(req, res) {
  console.log((new Date()) + ' Received request for ' + req.url);

  var file;
  if (req.url == '/') file = '/index.html'
  else file = req.url;

  if (file.charAt(0) != '/') file = '/'+file;

  var data = fs.readFileSync(DOCUMENT_ROOT + file);

  if (file == '/logown6.png') res.writeHead(200, {'Content-Type': 'image/png'});
  else res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(data);
  res.end();
});
 */

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
