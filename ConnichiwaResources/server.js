/* global SERVER_PORT, DOCUMENT_ROOT, RESOURCES_PATH, CWDEBUG */
/* global native_localWebsocketWasOpened */
"use strict";

/**
 *
 * Constants passed from CWWebserver:
 *     SERVER_PORT -- the port the HTTP server is supposed to run on
 *     DOCUMENT_ROOT -- the root of the web application, defined by the iOS application.
 *     RESOURCES_PATH -- Full path to the root of ConnichiwaResources.bundle.
 *     CWDEBUG -- true if the app runs in debug config, false for release
 *
**/

var WEBSOCKET_PORT = parseInt(SERVER_PORT) + 1;

var Express = require("express");
var Morgan = require("morgan");
var Path = require("path");
var WebsocketServer = require("ws").Server;

///////////////
// WEBSERVER //
///////////////

var app = new Express();

//Activate logging
if (CWDEBUG === true) {
  app.use(new Morgan( { immediate: true, format: "WEBSERVER :date :remote-addr -- REQUEST :url (:response-time ms)" } ));
}

//Make sure the server only delivers "safe" filetypes
app.use(function(req, res, next) {
  var validExtensionRegexp = /\.(html|htm|js|jpg|jpeg|png|gif|ico|pdf)\??.*$/;
  if (validExtensionRegexp.test(Path.extname(req.url)) === false && req.url !== "/") {
    console.log(req.url + " rejected because of file extension");
    res.status(404).send("File not found");
    return;
  }

  next();
});

//Make sure we serve the Connichiwa Web Library to the web app under /connichiwa/
app.use("/connichiwa", Express.static(RESOURCES_PATH + "/weblib"));

//DOCUMENT_ROOT is served as /
app.use("/", Express.static(DOCUMENT_ROOT));

app.listen(SERVER_PORT);

///////////////
// WEBSOCKET //
///////////////

var websocket = new WebsocketServer({ port: WEBSOCKET_PORT });
var wsLocalConnection;
var wsRemoteConnections = [];

websocket.on("connection", function(wsConnection) {
  //For now, we just assume first device means its the master device
  //TODO We should probably check the source IP here or something
  if (wsLocalConnection === undefined) {
    wsLocalConnection = wsConnection;
    log("WEBSOCKET", "Initialized local connection");
    sendToWeblib(JSON.stringify({ type: "debug", cwdebug: CWDEBUG }));
    native_localWebsocketWasOpened();
  }
  else
  {
    wsRemoteConnections.push(wsConnection);
    log("WEBSOCKET", "Initialized remote connection");
  }

  wsConnection.on("message", function(message) {
    log("WEBSOCKET", "Received mesage: " + message);
  });
});

function sendToWeblib(message)
{
  if (wsLocalConnection === undefined) {
    log("Message lost because no local websocket connection exists: " + message);
    return;
  }
//  log("WEBSERVER", "Sending mesage to weblib: " + message);
  wsLocalConnection.send(message);
}

//////////
// MISC //
//////////

function log(type, message)
{
  if (CWDEBUG !== true) return;

  while (type.length < 9)
  {
    type += " ";
  }

  console.log(type + " " + getDateString() + " -- " + message);
}

function getDateString(date)
{
  if (date === undefined) date = new Date();

  var hours = String(date.getHours());
  hours = (hours.length === 1) ? "0" + hours : hours;

  var minutes = String(date.getMinutes());
  minutes = (minutes.length === 1) ? "0" + minutes : minutes;

  var seconds = String(date.getSeconds());
  seconds = (seconds.length === 1) ? "0" + seconds : seconds;

  var milliseconds = String(date.getMilliseconds());
  milliseconds = (milliseconds.length === 1) ? "00" + milliseconds : milliseconds;
  milliseconds = (milliseconds.length === 2) ? "0" + milliseconds : milliseconds;

  return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}
