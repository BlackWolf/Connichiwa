/* global HTTP_PORT, DOCUMENT_ROOT, RESOURCES_PATH, CWDEBUG */
/* global nativeCallServerDidStart, nativeCallRemoteWebsocketDidClose */
"use strict";

/**
 *
 * Constants passed from CWWebserver:
 *     HTTP_PORT -- the port the HTTP server is supposed to run on
 *     DOCUMENT_ROOT -- the root of the web application, defined by the iOS application.
 *     RESOURCES_PATH -- Full path to the root of ConnichiwaResources.bundle.
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
app.use(new Morgan( { immediate: true, format: "2|Request from :remote-addr: :url (:response-time ms)" } ));

//Deliver a minimal page for '/check', which can be used to check if the webserver responds
app.use("/check", function(req, res, next) {
  res.status(200).send("Hic sunt dracones");
});

//Make sure the server only delivers "safe" filetypes
app.use(function(req, res, next) {
  var validExtensionRegexp = /\.(html|htm|js|jpg|jpeg|png|gif|ico|pdf)\??.*$/;
  if (validExtensionRegexp.test(Path.extname(req.url)) === false && req.url !== "/") {
    log(1, req.url + " rejected because of file extension");
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
}



// LOCAL CONNECTION CALLBACKS

var onLocalMessage = function(message)
{
  log(4, "Message from web library: " + message);
  var object = JSON.parse(message);
  sendToRemote(object.target, message);
};

var onLocalClose = function(code, message)
{
  log(3, "Web library websocket closed");
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
    log(4, "Received message from remote device: " + message);
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
          log(3, "Remote websocket closed");
          delete wsRemoteConnections[key];
          cleanupWebsocketConnection(wsConnection);
          nativeCallRemoteWebsocketDidClose(key);
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
    log(4, "Received message from unidentified websocket: " + message);
    var index = wsUnidentifiedConnections.indexOf(wsConnection);

    if (index > -1)
    {
      var object = JSON.parse(message);

      if (object.type === "localidentifier")
      {
        log(3, "Websocket was determined to be local");
        wsLocalConnection = wsConnection;
        wsUnidentifiedConnections.splice(index, 1);
        // wsConnection.onmessage = onLocalMessage;
        // wsConnection.onclose = onLocalClose;
        // wsConnection.onerror = onLocalError;
        // wsConnection.removeListener("message", onUnidentifiedRemoteMessage);
        // wsConnection.removeListener("close", onUnidentifiedRemoteClose);
        // wsConnection.removeListener("error", onUnidentifiedRemoteError);
        wsConnection.removeAllListeners("message");
        wsConnection.removeAllListeners("close");
        wsConnection.removeAllListeners("error");
        wsConnection.on("message", onLocalMessage);
        wsConnection.on("close", onLocalClose);
        wsConnection.on("error", onLocalError);
      }

      if (object.type === "remoteidentifier")
      {
        log(3, "Websocket was determined to be remote");
        wsRemoteConnections[object.identifier] = wsConnection;
        wsUnidentifiedConnections.splice(index, 1);
        // wsConnection.onmessage = onRemoteMessage(wsConnection);
        // wsConnection.onclose = onRemoteClose(wsConnection);
        // wsConnection.onerror = onRemoteError(wsConnection);
        // wsConnection.removeListener("message", onUnidentifiedRemoteMessage);
        // wsConnection.removeListener("close", onUnidentifiedRemoteClose);
        // wsConnection.removeListener("error", onUnidentifiedRemoteError);
        wsConnection.removeAllListeners("message");
        wsConnection.removeAllListeners("close");
        wsConnection.removeAllListeners("error");
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
        log(3, "Unidentified websocket closed");
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
  log(3, "Websocket server is now listening");
  websocketListening = true;
  checkServerStatus();
};


var onWebsocketConnection = function(wsConnection) {
  log(3, "Unidentified websocket connection established");
  wsUnidentifiedConnections.push(wsConnection);
  // wsConnection.onmessage = onUnidentifiedRemoteMessage(wsConnection);
  // wsConnection.onclose = onUnidentifiedRemoteClose(wsConnection);
  // wsConnection.onerror = onUnidentifiedRemoteError(wsConnection);
  wsConnection.on("message", onUnidentifiedRemoteMessage(wsConnection));
  wsConnection.on("close", onUnidentifiedRemoteClose(wsConnection));
  wsConnection.on("error", onUnidentifiedRemoteError(wsConnection));
};



// SENDING MESSAGES

function sendToLocal(message)
{
  if (wsLocalConnection === undefined) {
    log(4, "MESSAGE LOST. No local websocket connection exists: " + message);
    return;
  }

  log(4, "Sending message to web library: " + message);
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
        log(4, "Sending message to remote device " + key + ": " + message);
        wsRemoteConnections[key].send(message);    
      }
    }    
    return;
  }
  else {
    log(4, "Trying to send message to remote device " + identifier);
    if (identifier in wsRemoteConnections === false) return;
    log(4, "Sending message to remote device " + identifier + ": " + message);
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

  log(3, "Starting HTTP and Websocket server");

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
  log(3, "Soft-Disconnecting all remotes");
  var shutdownMessage = JSON.stringify({ type: "softdisconnect" });
  for (var key in wsRemoteConnections)
  {
    if (wsRemoteConnections.hasOwnProperty(key))
    {
      wsRemoteConnections[key].send(shutdownMessage);
      delete wsRemoteConnections[key];
      nativeCallRemoteWebsocketDidClose(key);
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
    nativeCallServerDidStart();
  }
}


function log(prio, message)
{
  console.log(prio + "|" + message);
}
