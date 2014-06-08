/**
 *
 * Constants passed from CWWebserver:
 *     SERVER_PORT -- the port the HTTP server is supposed to run on
 *     DOCUMENT_ROOT -- the root of the web application, defined by the iOS application.
 *     RESOURCES_PATH -- Full path to the root of ConnichiwaResources.bundle.
 *
**/

var WEBSOCKET_PORT = parseInt(SERVER_PORT)+1;

var Express = require('express');
var Morgan = require('morgan');
var Path = require('path');
var WebsocketServer = require('ws').Server;

///////////////
// WEBSERVER //
///////////////

var app = Express();

//Activate logging
app.use(Morgan( {immediate: true, format: ':date :remote-addr -- :url (:response-time ms)'} ));

//Make sure the server only delivers "safe" filetypes
app.use(function(req, res, next) {
  var validExtensionRegexp = /\.(html|htm|js|jpg|jpeg|png|gif|ico|pdf)$/;
  if (validExtensionRegexp.test(Path.extname(req.url)) === false && req.url !== '/') {
    console.log(req.url+" rejected because of file extension");
    res.status(404).send("File not found");
    return;
  }

  next();
});

//Make sure we serve the necessary Connichiwa files to the web app unter /connichiwa/
app.use('/connichiwa', Express.static(RESOURCES_PATH+"/public"));

//DOCUMENT_ROOT is now served as /
app.use('/', Express.static(DOCUMENT_ROOT));

app.listen(SERVER_PORT);

///////////////
// WEBSOCKET //
///////////////

var websocket = new WebsocketServer({port: WEBSOCKET_PORT});

websocket.on('connection', function(websocketConnection) {
  console.log("WEBSOCKET connection");

  websocketConnection.on('message', function(message) {
    console.log("WEBSOCKET received "+message);
  });
});

//////////
// MISC //
//////////

function fromNative_sendMessage(message) {
  //Redirect the message to our own webview (the master webview) unaltered
  //We leave parsing or rejecting the message to the Connichiwa Web Library
  //this server.js should only work as a mere relay for redirecting messages
}

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
