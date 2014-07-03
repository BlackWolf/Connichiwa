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
  native_websocketDidOpen();
};


var onWebsocketMessage = function(e)
{
  var message = e.data;
  log(4, "Received message: " + message);
  
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
  onWebsocketClose();
};


var onWebsocketClose = function()
{
  log(3, "Websocket closed");
  connected = false;
  cleanupWebsocket();
  native_websocketDidClose();
};


function parseNativeMessage(message)
{
  log(4, "Parsing native message: "+message);
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

  log(4, "Sending message: "+message);

  websocket.send(JSON.stringify(message));
}


//////////
// MISC //
//////////


function log(priority, message)
{
  if (debug) console.log(priority+"|"+message);
}