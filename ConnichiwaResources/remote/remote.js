"use strict";



var CRDebug = (function()
{
  /**
   * true if debug mode is on, otherwise false
   */
  var debug = false;

  var enableDebug = function()
  {
    debug = true;
  };

  /**
   * Logs a message to the console if debug mode is on
   *
   * @param {int} priority The priority of the message. Messages with lower priority are printed at lower debug states.
   * @param {string} message the message to log
   *
   * @memberof CWDebug
   */
  var log = function(priority, message)
  {
    if (debug) console.log(priority + "|" + message);
  };

  return {
    enableDebug : enableDebug,
    log         : log
  };
})();
/* global Remote */
"use strict";



var CRMasterCommunicationParser = (function() 
{
  var parse = function(message)
  {
    CRDebug.log(4, "Received message: " + message);
    var object = JSON.parse(message);

    if (object.type === "softdisconnect")
    {
      Remote._softDisconnectWebsocket();
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
    }

    if (object.type === "updateStyle")
    {
      window.requestAnimationFrame(function(timestamp) {
        for (var style in object.styles) {
          $(object.element).css(style, object.styles[style]);
        }
      });
    }

    if (object.type === "beginPath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(object.element)[0].getContext("2d");
        context.beginPath();
        context.moveTo(object.coords.x, object.coords.y);
      });
    }

    if (object.type === "updatePath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(object.element)[0].getContext("2d");
        context.lineTo(object.coords.x, object.coords.y);
        context.stroke();
      });
    }

    if (object.type === "endPath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(object.element)[0].getContext("2d");
        context.closePath();
      });
    }
    if (object.type === "loadScript")
    {
      $.getScript(object.url, function() {
        //TODO check for AJAX errors n stuff
        var message = {
          type    : "scriptLoaded",
          request : object
        };
        Remote.send(message);
      });
    }
  };

  return {
    parse : parse
  };
})();
/* global Remote, CRDebug */
"use strict";



var CRNativeCommunicationParser = (function()
{
  var parse = function(message)
  {
    CRDebug.log(4, "Parsing native message: " + message);
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "connectwebsocket": _parseConnectWebsocket(object); break;
      case "cwdebug": _parseDebug(object); break;
      case "remoteidentifier": _parseRemoteIdentifier(object); break;
      case "disconnectwebsocket": _parseDisconnectWebsocket(object); break;
    }
  };


  var _parseConnectWebsocket = function(message)
  {
    Remote._connectWebsocket();
  };


  var _parseDebug = function(message)
  {
    CRDebug.enableDebug();
  };


  var _parseRemoteIdentifier = function(message) 
  {
    var data = { type: "remoteidentifier", identifier: message.identifier };
    Remote.send(data);
  };

  var _parseDisconnectWebsocket = function(message)
  {
    Remote._disconnectWebsocket();  
  };

  return {
    parse : parse
  };
})();
"use strict";

function CRURLParser(url)
{
  var parser = document.createElement("a");
  parser.href = url;

  return parser;
}
/* global CRDebug, CRURLParser, CRMasterCommunicationParser */
/* global nativeCallWebsocketDidOpen, nativeCallSoftDisconnect, nativeCallWebsocketDidClose */
"use strict";



var Remote = (function() 
{
  var _parsedURL = new CRURLParser(document.URL);
  var _websocket;
  var softDisconnected = false;

  var _connectWebsocket = function()
  {
    //If we replace the websocket (or re-connect) we don't want to call onWebsocketClose
    //Therefore, first cleanup, then close
    var oldWebsocket = _websocket;
    _cleanupWebsocket();    
    if (oldWebsocket !== undefined) oldWebsocket.close();

    _websocket = new WebSocket("ws://" + _parsedURL.hostname + ":" + (parseInt(_parsedURL.port) + 1));
    _websocket.onopen = onWebsocketOpen;
    _websocket.onmessage = onWebsocketMessage;
    _websocket.onclose = onWebsocketClose;
    _websocket.onerror = onWebsocketError;
  };


  var _disconnectWebsocket = function()
  {
    _websocket.close();
  };


  var _softDisconnectWebsocket = function()
  {
    softDisconnected = true;
    nativeCallSoftDisconnect();
  };


  function _cleanupWebsocket()
  {
    if (_websocket !== undefined) 
    {
      _websocket.onopen = undefined;
      _websocket.onmessage = undefined;
      _websocket.onclose = undefined;
      _websocket.onerror = undefined;
      _websocket = undefined;
    }
  }


  var onWebsocketOpen = function()
  {
    CRDebug.log(3, "Websocket opened");
    softDisconnected = false;
    nativeCallWebsocketDidOpen();
  };


  var onWebsocketMessage = function(e)
  {
    var message = e.data;
    CRMasterCommunicationParser.parse(message);
  };


  var onWebsocketClose = function()
  {
    CRDebug.log(3, "Websocket closed");
    _cleanupWebsocket();
    nativeCallWebsocketDidClose();
  };


  var onWebsocketError = function()
  {
    onWebsocketClose();
  };


  var _send = function(message)
  {
    CRDebug.log(4, "Sending message: " + message);
    _websocket.send(message);
  };


  var send = function(messageObject)
  {
    _send(JSON.stringify(messageObject));
  };


  return {
    _connectWebsocket        : _connectWebsocket,
    _softDisconnectWebsocket : _softDisconnectWebsocket,
    send                     : send
  };
})();
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

  if (object.type === "updateStyle")
  {
    window.requestAnimationFrame(function(timestamp) {
      for (var style in object.styles) {
        $(object.element).css(style, object.styles[style]);
      }
    });
    // setTimeout(test(object.element, object.content), 0);
    // $(object.element).html(object.content);
    // object.element = object.element.replace("#", "");
    // document.getElementById(object.element).innerHTML = object.content;
  }

  if (object.type === "beginPath")
  {
    window.requestAnimationFrame(function(timestamp) {
      var context = $(object.element)[0].getContext("2d");
      context.beginPath();
      context.moveTo(object.coords.x, object.coords.y);
    });
  }

  if (object.type === "updatePath")
  {
    window.requestAnimationFrame(function(timestamp) {
      var context = $(object.element)[0].getContext("2d");
      context.lineTo(object.coords.x, object.coords.y);
      context.stroke();
    });
  }

  if (object.type === "endPath")
  {
    window.requestAnimationFrame(function(timestamp) {
      var context = $(object.element)[0].getContext("2d");
      context.closePath();
    });
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
