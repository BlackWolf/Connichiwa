"use strict";



var CWDEBUG = false;



//Parse URL
var ParsedURL = (function()
{
  var parser = document.createElement("a");
  parser.href = document.URL;
  
  return parser;
})();


var websocket;
var connected = false;

var onWebsocketOpen = function()
{
  connected = true;
  native_websocketDidOpen();
};


var onWebsocketMessage = function(e)
{
  var message = e.data;
  log("message: " + message);
  
  var object = JSON.parse(message);
  
  if (object.type === "softdisconnect")
  {
    connected = false;
    native_softDisconnect();
  }
  if (object.type === "show")
  {
    $("body").append(object.content);
  }
  
  if (object.type === "update")
  {
    $(object.element).html(object.content);
  }
};


var onWebsocketError = function()
{
  alert("websocket error");
};


var onWebsocketClose = function()
{
  connected = false;
  cleanupWebsocket();
  native_websocketDidClose();
};


function parseNativeMessage(message)
{
  log("GOT MESSAGE "+message);
  var object = JSON.parse(message);
  switch (object.type)
  {
    case "connectwebsocket":
      connected = false;

      var oldWebsocket = websocket;
      cleanupWebsocket();    
      if (oldWebsocket !== undefined) oldWebsocket.close();

      websocket = new WebSocket("ws://" + ParsedURL.hostname + ":" + (parseInt(ParsedURL.port) + 1));
      websocket.onopen = onWebsocketOpen;
      websocket.onmessage = onWebsocketMessage;
      websocket.onclose = onWebsocketClose;
      websocket.onerror = onWebsocketError;
      break;
    case "cwdebug":
      if (object.cwdebug) CWDEBUG = true;
      break;
    case "remoteidentifier":
      var data = { type: "remoteidentifier", identifier: object.identifier };
      sendMessage(data);
      break;
    case "disconnectwebsocket":
      websocket.close();
      break;
  }
}


function cleanupWebsocket()
{
  if (websocket !== undefined) 
  {
    websocket.onopen = undefined;
    websocket.onmessage = undefined;
    websocket.onclose = undefined;
    websocket.onerror = undefined;
    websocket.close();
    websocket = undefined;
  }
}


function sendMessage(message)
{
  if (connected === false) return;

  websocket.send(JSON.stringify(message));
}


//////////
// MISC //
//////////


function log(message)
{
  if (CWDEBUG) console.log(getDateString() + " -- " + message);
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
