/* global HTTP_PORT, DOCUMENT_ROOT, RESOURCES_PATH, CWDEBUG */
/* global native_serverDidStart, native_remoteWebsocketDidClose */
"use strict";

/**
 *
 * Constants passed from CWWebserver:
 *     HTTP_PORT -- the port the HTTP server is supposed to run on
 *     DOCUMENT_ROOT -- the root of the web application, defined by the iOS application.
 *     RESOURCES_PATH -- Full path to the root of ConnichiwaResources.bundle.
 *     CWDEBUG -- true if the app runs in debug config, false for release
 *
**/

var WEBSOCKET_PORT = parseInt(HTTP_PORT) + 1;



var Express = require("express");
var Morgan = require("morgan");
var Path = require("path");
var WebsocketServer = require("ws").Server;



///////////////
// WEBSERVER //
///////////////

var app = new Express();

var http;
var httpListening;

//Activate logging
if (CWDEBUG === true) app.use(new Morgan( { immediate: true, format: "WEBSERVER :date :remote-addr -- REQUEST :url (:response-time ms)" } ));

//Deliver a minimal page for '/check', which can be used to check if the webserver responds
app.use("/check", function(req, res, next) {
  res.status(200).send("Hic sunt dracones");
});

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

//Serve the webpage that is accessed by remote devices
app.use("/remote", Express.static(RESOURCES_PATH + "/remote"));

//Serve scripts delivered with Connichiwa
app.use("/scripts", Express.static(RESOURCES_PATH + "/scripts"));

//DOCUMENT_ROOT (web app) is served as /
app.use("/", Express.static(DOCUMENT_ROOT));

var onHttpListening = function()
{
  httpListening = true;
  checkServerStatus();
};

///////////////
// WEBSOCKET //
///////////////

var websocket;
var websocketListening;
var wsLocalConnection;
var wsUnidentifiedConnections;
var wsRemoteConnections;

function cleanupWebsocketConnection(wsConnection)
{
  if (wsConnection !== undefined) 
  {
    wsConnection.onopen = undefined;
    wsConnection.onmessage = undefined;
    wsConnection.onclose = undefined;
    wsConnection.onerror = undefined;
  }
};



// LOCAL CONNECTION CALLBACKS

var onLocalMessage = function(message)
{
  sendToRemote(object.target, message);
};

var onLocalClose = function(code, message)
{
  cleanupWebsocketConnection(wsLocalConnection);
  wsLocalConnection = undefined;
};

var onLocalError = function(error)
{
  onLocalClose();
};



// REMOTE CONNECTION CALLBACKS

var onRemoteMessage = function(wsConnection)
{
  return function(message)
  {
    //A message from a remote device is relayed to the weblib
    //log("WEBSOCKET", "Forwarding remote message: " + message);
    sendToLocal(message);
  };
};

var onRemoteClose = function(wsConnection)
{
  return function(code, message)
  { 
    for (var key in wsRemoteConnections)
    {
      if (wsRemoteConnections.hasOwnProperty(key))
      {
        if (wsRemoteConnections[key] === wsConnection)
        {
          delete wsRemoteConnections[key];
          cleanupWebsocketConnection(wsConnection);
          native_remoteWebsocketDidClose(key);
          break;
        } 
      }
    }
  };
};

var onRemoteError = function(wsConnection)
{
  return function(error)
  {
    onRemoteClose(wsConnection);
  };
};


var onUnidentifiedRemoteMessage = function(wsConnection)
{
  return function(message)
  {
    var index = wsUnidentifiedConnections.indexOf(wsConnection);

    if (index > -1)
    {
      var object = JSON.parse(message);

      if (object.type === "localidentifier")
      {
        wsLocalConnection = wsConnection;
        wsUnidentifiedConnections.splice(index, 1);
        wsConnection.on("message", onLocalMessage);
        wsConnection.on("close", onLocalClose);
        wsConnection.on("error", onLocalError);
      }

      if (object.type === "remoteidentifier")
      {
        wsRemoteConnections[object.identifier] = wsConnection;
        wsUnidentifiedConnections.splice(index, 1);
        wsConnection.on("message", onRemoteMessage(wsConnection));
        wsConnection.on("close", onRemoteClose(wsConnection));
        wsConnection.on("error", onRemoteError(wsConnection));
        sendToLocal(message);
      }
    }
  };
};


var onUnidentifiedRemoteClose = function(wsConnection)
{
  return function(code, message)
  {
    for (var i = 0 ; i < wsUnidentifiedConnections.length ; i++)
    {
      if (wsUnidentifiedConnections[i] === wsConnection)
      {
        //We don't sent native_remoteWebsocketDidClose() here because 
        //an unidentified connection is not considered established
        wsUnidentifiedConnections.splice(wsUnidentifiedConnections.indexOf(wsConnection), 1);
        cleanupWebsocketConnection(wsConnection);
        break;
      }
    } 
  };
};


var onUnidentifiedRemoteError = function(wsConnection)
{
  return function(error)
  {
    onUnidentifiedRemoteClose(wsConnection);
  };
};



// WEBSOCKET CALLBACKS

var onWebsocketListening = function()
{
  websocketListening = true;
  checkServerStatus();
};


var onWebsocketConnection = function(wsConnection) {
  wsUnidentifiedConnections.push(wsConnection);
  wsConnection.on("message", onUnidentifiedRemoteMessage(wsConnection));
  wsConnection.on("close", onUnidentifiedRemoteClose(wsConnection));
  wsConnection.on("error", onUnidentifiedRemoteError(wsConnection));
};



// SENDING MESSAGES

function sendToLocal(message)
{
  if (wsLocalConnection === undefined) {
    log("Message lost because no local websocket connection exists: " + message);
    return;
  }

  wsLocalConnection.send(message);
}


function sendToRemote(identifier, message)
{
  if (identifier === "broadcast")
  {
    for (var key in wsRemoteConnections)
    {
      if (wsRemoteConnections.hasOwnProperty(key))
      {
        wsRemoteConnections[key].send(message);    
      }
    }    
    return;
  }
  else {
    if (identifier in wsRemoteConnections === false) return;
    wsRemoteConnections[identifier].send(message);
  }
}


function sendToWeblib(message)
{
  sendToLocal(message);
}



////////////////////
// SERVER CONTROL //
////////////////////

function startListening()
{
  if (http !== undefined && websocket !== undefined) return;

  httpListening = false;
  websocketListening = false;
  wsLocalConnection = undefined;
  wsUnidentifiedConnections = [];
  wsRemoteConnections = {};

  http = app.listen(HTTP_PORT, onHttpListening);
  websocket = new WebsocketServer({ port: WEBSOCKET_PORT }, onWebsocketListening);
  websocket.on("connection", onWebsocketConnection);
}


function softDisconnectAllRemotes()
{
  var shutdownMessage = JSON.stringify({ type: "softdisconnect" });
  for (var key in wsRemoteConnections)
  {
    if (wsRemoteConnections.hasOwnProperty(key))
    {
      wsRemoteConnections[key].send(shutdownMessage);
      delete wsRemoteConnections[key];
      native_remoteWebsocketDidClose(key);
    }
  }  
  for (var i = 0; i < wsUnidentifiedConnections.length; i++)
  {
    wsUnidentifiedConnections[i].send(shutdownMessage);
    wsUnidentifiedConnections[i] = undefined; 
  }
}


function checkServerStatus()
{
  if (httpListening && websocketListening)
  {
    native_serverDidStart();
  }
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
