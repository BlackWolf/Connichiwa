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

var onWebsocketOpen = function()
{
  native_websocketDidOpen();
};


var onWebsocketMessage = function(e)
{
  var message = e.data;
  log("message: " + message);
  
  var object = JSON.parse(message);
  
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
  native_websocketDidClose();
};


function parseNativeMessage(message)
{
  var object = JSON.parse(message);
  switch (object.type)
  {
    case "connectwebsocket":
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
    case "disconnect":
      websocket.close();
      break;
  }
}


function sendMessage(message)
{
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
