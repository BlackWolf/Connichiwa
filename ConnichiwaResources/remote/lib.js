/* global nativeCallWebsocketDidOpen, nativeCallSoftDisconnect, nativeCallWebsocketDidClose */
"use strict";



var debug = false;



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
  log(3, "Websocket opened");
  connected = true;
  nativeCallWebsocketDidOpen();
};

var onWebsocketMessage = function(e)
{
  var message = e.data;
  log(4, "Received message: " + message);
  
  var object = JSON.parse(message);
  
  if (object.type === "softdisconnect")
  {
    connected = false;
    nativeCallSoftDisconnect();
  }
  if (object.type === "show")
  {
    window.requestAnimationFrame(function(timestamp) {
      $("body").append(object.content);
    });
  }
  
  if (object.type === "update")
  {
    window.requestAnimationFrame(function(timestamp) {
      $(object.element).html(object.content);
    });
    // setTimeout(test(object.element, object.content), 0);
    // $(object.element).html(object.content);
    // object.element = object.element.replace("#", "");
    // document.getElementById(object.element).innerHTML = object.content;
  }
};


var onWebsocketClose = function()
{
  log(3, "Websocket closed");
  connected = false;
  cleanupWebsocket();
  nativeCallWebsocketDidClose();
};


var onWebsocketError = function()
{
  onWebsocketClose();
};


function parseNativeMessage(message)
{
  log(4, "Parsing native message: " + message);
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
      if (object.cwdebug) debug = true;
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
    websocket = undefined;
  }
}


function sendMessage(message)
{
  if (connected === false) return;

  log(4, "Sending message: " + message);

  websocket.send(JSON.stringify(message));
}


//////////
// MISC //
//////////


function log(priority, message)
{
  if (debug) console.log(priority + "|" + message);
}
