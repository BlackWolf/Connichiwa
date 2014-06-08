/**
 *
 * Constants passed from CWWebserver:
 *     SERVER_PORT -- the port the HTTP server is supposed to run on
 *     DOCUMENT_ROOT -- the root of the web application. Must be put before file paths of the web application.
 *     RESOURCES_PATH -- Full path to the root of ConnichiwaResources.bundle. Must be used to access Connichiwa resource files.
 *
**/

var express = require('express');
var connect = require('connect');
var fs   = require('fs');
var path    = require('path');

//var server = connect.createServer();
var app = express();

app.use(function(req, res, next) {
        console.log("SUPERLOL "+req.url);
        next();
        });

//app.use(connect.logger());
//server.use(connect.logger());

//We want DOCUMENT_ROOT to be our document root, so preprend the request url with it
/*server.use(function(req, res, next) {
  req.url = DOCUMENT_ROOT+req.url;
  next();
});*/

/*
server.use(function(req, res, next) {
  var files = fs.readdirSync(req.url);
  console.log(JSON.stringify(files));
  next();
});
*/

//First things first - only serve safe filetypes
// server.use(function(req, res, next) {
//   if (/.*/.test(path.extname(req.url))) {
//     next();
//   }
// });

/*
server.use(function(req, res, next) {
  if (req.url != "/5650.png") {
    next();
    return;
  }

  //var blah = req.url.replace(/%20/g, " ");
  //console.log("READING "+DOCUMENT_ROOT + blah);
  var data = fs.readFileSync(DOCUMENT_ROOT + req.url);

  res.writeHead(200, {'Content-Type': 'image/jpeg'});
  res.write(data);
  res.end();
});
 */

//server.use(connect.static(DOCUMENT_ROOT));
app.use('/', express.static(DOCUMENT_ROOT));

/*
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
});*/

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

//server.listen(SERVER_PORT);
app.listen(SERVER_PORT);

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
