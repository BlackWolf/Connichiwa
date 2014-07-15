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
/* global CRDebug */
"use strict";



/**
 * Manages events throughout Connichiwa. Allows all parts of Connichiwa to register for and trigger events.
 *
 * @namespace CWEventManager
 */
var CREventManager = (function()
{
  /**
   * A dictionary where each entry represents a single event. The key is the event name. Each entry of the dictionary is an array of callbacks that should be called when the event is triggered.
   */
  var _events = {};

  /**
   * Registers the given callback function for the given event. When the event is triggered, the callback will be executed.
   *
   * @param {string} event The name of the event
   * @param {function} callback The callback function to call when the event is triggered
   *
   * @memberof CWEventManager
   */
  var register = function(event, callback)
  {
    if (typeof(event) !== "string") throw "Event name must be a string";
    if (typeof(callback) !== "function") throw "Event callback must be a function";

    if (!_events[event]) _events[event] = [];
    _events[event].push(callback);
    CRDebug.log(3, "Attached callback to " + event);
  };

  /**
   * Triggers the given events, calling all callback functions that have registered for the event.
   *
   * @param {string} event The name of the event to trigger
   *
   * @memberof CWEventManager
   */
  var trigger = function(event)
  {
    if (!_events[event]) return;

    //Get all arguments passed to trigger() and remove the event
    var args = Array.prototype.slice.call(arguments);
    args.shift();

    CRDebug.log(5, "Triggering event " + event);
    for (var i = 0; i < _events[event].length; i++)
    {
      var callback = _events[event][i];
      callback.apply(null, args); //calls the callback with arguments args
    }
  };

  return {
    register : register,
    trigger  : trigger
  };
})();
/* global Remote, CRDebug */
"use strict";



var CRMasterCommunicationParser = (function() 
{
  var parse = function(message)
  {
    if (message.type === "softdisconnect")
    {
      Remote._softDisconnectWebsocket();
    }
    if (message.type === "show")
    {
      window.requestAnimationFrame(function(timestamp) {
        $("body").append(message.content);
      });
    }

    if (message.type === "update")
    {
      window.requestAnimationFrame(function(timestamp) {
        $(message.element).html(message.content);
      });
    }

    if (message.type === "beginPath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(message.element)[0].getContext("2d");
        context.beginPath();
        context.moveTo(message.coords.x, message.coords.y);
      });
    }

    if (message.type === "updatePath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(message.element)[0].getContext("2d");
        context.lineTo(message.coords.x, message.coords.y);
        context.stroke();
      });
    }

    if (message.type === "endPath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(message.element)[0].getContext("2d");
        context.closePath();
      });
    }
    if (message.type === "loadScript")
    {
      $.getScript(message.url, function() {
        //TODO check for AJAX errors n stuff
        var message = {
          type    : "scriptLoaded",
          request : message
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
/* global CRDebug, CRURLParser, CRMasterCommunicationParser, CREventManager */
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
    var message = JSON.parse(e.data);
    CRDebug.log(4, "Received message: " + e.data);

    CRMasterCommunicationParser.parse(message);

    if (message.type) CREventManager.trigger("message" + message.type, message);
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


  var onMessage = function(type, callback)
  {
    CREventManager.register("message" + type, callback);
  };


  return {
    _connectWebsocket        : _connectWebsocket,
    _softDisconnectWebsocket : _softDisconnectWebsocket,
    _disconnectWebsocket     : _disconnectWebsocket,
    send                     : send,
    onMessage                : onMessage
  };
})();
