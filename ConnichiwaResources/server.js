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
var httpLoaded;

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
  httpLoaded = true;
  checkServerStatus();
};

///////////////
// WEBSOCKET //
///////////////

var websocket;
var websocketLoaded;
var wsLocalConnection;
var wsUnidentifiedRemoteConnections;
var wsRemoteConnections;



// LOCAL CONNECTION CALLBACKS

var onLocalMessage = function(message)
{
  log("WEBSOCKET", "Forwarding local message: " + message);
  
  var object = JSON.parse(message);
  if (object.target === "native") log("WEBSOCKET", "!!! ERROR: TRIED TO SEND MESSAGE TO NATIVE VIA WEBSOCKET: " + message);

  sendToRemote(object.target, message);
};

var onLocalClose = function(code, message)
{
  
};

var onLocalError = function(error)
{
  
};



// REMOTE CONNETION CALLBACKS

var onRemoteMessage = function(wsConnection)
{
  return function(message)
  {
    //Usually, the webserver just blindly relays messages, but we need to make one exception:
    //The "remoteidentifier" message needs to unidentifiedparsed so we know the ID of each remote connection
    //If we find that identifier, the connection is moved from the unidentified remote connections to the normal remote connections
    var unidentifiedIndex = wsUnidentifiedRemoteConnections.indexOf(wsConnection);
    if (unidentifiedIndex !== -1)
    {
      var object = JSON.parse(message);
        
      if (object.type === "remoteidentifier")
      {
        wsRemoteConnections[object.identifier] = wsConnection;
        wsUnidentifiedRemoteConnections.splice(unidentifiedIndex, 1);
        log("WEBSOCKET", "Got identifier for remote connection: " + object.identifier);
      }
    }
    
    //A message from a remote device is relayed to the weblib
  //      log("WEBSOCKET", "Forwarding remote message: " + message);
    sendToLocal(message);
  };
};

var onRemoteClose = function(wsConnection)
{
  return function(code, message)
  {
    log("WEBSOCKET", "GOT A CLOSE: " + code + " ; " + message);
    
    for (var key in wsRemoteConnections)
    {
      if (wsRemoteConnections.hasOwnProperty(key))
      {
        if (wsRemoteConnections[key] === wsConnection)
        {
          delete wsRemoteConnections[key];
          native_remoteWebsocketDidClose(key);
          break;
        } 
      }
    }
    
    for (var i = 0 ; i < wsUnidentifiedRemoteConnections.length ; i++)
    {
      if (wsUnidentifiedRemoteConnections[i] === wsConnection)
      {
        wsUnidentifiedRemoteConnections.splice(wsUnidentifiedRemoteConnections.indexOf(wsConnection), 1);
        //We don't sent native_remoteWebsocketDidClose() here because an unidentified connection is not considered established
        break;
      }
    }  
  };
};

var onRemoteError = function(wsConnection)
{
  return function(error)
  {
    log("WEBSOCKET", "GOT AN ERROR");
  };
};

function sendToWeblib(message)
{
  if (wsLocalConnection === undefined) {
    log("Message lost because no local websocket connection exists: " + message);
    return;
  }
  log("WEBSERVER", "Sending message to weblib: " + message);
  wsLocalConnection.send(message);
}

function sendToLocal(message)
{
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



// WEBSOCKET CALLBACKS

var onWebsocketListening = function()
{
  websocketLoaded = true;
  checkServerStatus();
};

var onWebsocketConnection = function(wsConnection) {
  //For now, we just assume first device means its the master device
  //TODO We should probably check the source IP here or something
  if (wsLocalConnection === undefined) {
    wsLocalConnection = wsConnection;
    wsLocalConnection.on("message", onLocalMessage);
    wsLocalConnection.on("close", onLocalClose);
    wsLocalConnection.on("error", onLocalError);

    log("WEBSOCKET", "Initialized local connection");
  }
  else
  {
    wsUnidentifiedRemoteConnections.push(wsConnection);
    wsConnection.on("message", onRemoteMessage(wsConnection));
    wsConnection.on("close", onRemoteClose(wsConnection));
    wsConnection.on("error", onRemoteError(wsConnection));

    log("WEBSOCKET", "Initialized remote connection");
  }
};



////////////////////
// SERVER CONTROL //
////////////////////

function startListening()
{
  httpLoaded = false;
  websocketLoaded = false;
  wsLocalConnection = undefined;
  wsUnidentifiedRemoteConnections = [];
  wsRemoteConnections = {};

  http = app.listen(HTTP_PORT, onHttpListening);
  websocket = new WebsocketServer({ port: WEBSOCKET_PORT }, onWebsocketListening);
  websocket.on("connection", onWebsocketConnection);
}


function stopListening()
{
  httpLoaded = false;
  websocketLoaded = false;

  //It can take some time until the server closes the websocket connection
  //Therefore, send a message to the remotes so they can leave early
  var shutdownMessage = JSON.stringify({ type: "servershuttingdown" });
  for (var key in wsRemoteConnections)
  {
    if (wsRemoteConnections.hasOwnProperty(key))
    {
      wsRemoteConnections[key].send(shutdownMessage);
    }
  }  
  for (var i = 0; i < wsUnidentifiedRemoteConnections.length; i++)
  {
    wsUnidentifiedRemoteConnections[i].send(shutdownMessage);
  }

  websocket.close();
  http.close();
}


function checkServerStatus()
{
  if (httpLoaded && websocketLoaded)
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
