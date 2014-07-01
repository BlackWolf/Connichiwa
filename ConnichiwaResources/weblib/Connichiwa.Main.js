/* global LazyLoad, CWDeviceManager, CWNativeCommunicationParser, CWDebug, CWUtil, CWEventManager, CWWebserverCommunicationParser, CWDevice, CWDeviceState, CWRemoteCommunicationParser */
"use strict";



/**
 * The main class responsible for managing the connection to the webserver and delivering events to the web application.
 * This class is supposed to run on a web view that runs on the same device as the webserver. It is the "server-side" web library that is then responsible for managing remote devices, connections to them and offers an API to manipulate the content of those remote devices.
 *
 * @namespace Connichiwa
 */
var Connichiwa = (function()
{

  /**
  * @namespace Connichiwa.Websocket
  * @memberof Connichiwa
  */

  /**
   * The websocket connection to the webserver
   *
   * @memberof Connichiwa.Websocket
   */
  var _websocket;

  var _websocketConnectionAttempts = 0;
  
  
  var _connectWebsocket = function()
  {
    if (_websocket !== undefined && (_websocket.state === CONNECTING || _websocket.state === OPEN)) return;

    _cleanupWebsocket();

    console.log("Trying to establish websocket connection");
    _websocket = new WebSocket("ws://127.0.0.1:8001");
    _websocket.onopen = onWebsocketOpen;
    _websocket.onmessage = onWebsocketMessage;
    _websocket.onclose = onWebsocketClose;
    _websocket.onerror = onWebsocketError;

    _websocketConnectionAttempts++;
  };


  /**
   * Called after the websocket connection was successfully established
   *
   * @memberof Connichiwa.Websocket
   */
  var onWebsocketOpen = function()
  {
    native_websocketDidOpen();
    _websocketConnectionAttempts = 0;
    CWDebug.log("Websocket opened");
  };


  /**
   * Called when a messages arrives from the webserver
   *
   * @memberof Connichiwa.Websocket
   */
  var onWebsocketMessage = function(e)
  {
    var message = e.data;
    CWDebug.log("message: " + message);
    
    CWRemoteCommunicationParser.parse(message);
  };


  /**
   * Called when the connection to the webserver errors
   *
   * @memberof Connichiwa.Websocket
   */
  var onWebsocketError = function()
  {
    CWDebug.log("Websocket error");
    onWebsocketClose();
  };


  /**
   * Called when the connection to the webserver was closed
   *
   * @memberof Connichiwa.Websocket
   */
  var onWebsocketClose = function()
  {
    CWDebug.log("Websocket closed");
    _cleanupWebsocket();

    if (_websocketConnectionAttempts >= 5)
    {
      //Give up, guess we are fucked
      native_websocketDidClose();
      return;
    }

    //We can't allow this blashphemy! Try to reconnect!
    setTimeout(function() { _connectWebsocket(); }, _websocketConnectionAttempts*1000);
  };


  var _cleanupWebsocket = function()
  {
    if (_websocket !== undefined) 
    {
      _websocket.onopen = undefined;
      _websocket.onmessage = undefined;
      _websocket.onclose = undefined;
      _websocket.onerror = undefined;
      _websocket = undefined;
    }
  };



var _send = function(message)
  {
    _websocket.send(message);
  };


  /**
  * @namespace Connichiwa.Misc
  * @memberof Connichiwa
  */
  
  
  var _identifier;
  
  
  var _setIdentifier = function(value)
  {
    if (_identifier !== undefined) return false;
      
    _identifier = value;
    CWDebug.log("Local identifier set to " + _identifier);
    
    return true;
  };
  
  
  var getIdentifier = function() { return _identifier; }

  /**
  * @namespace Connichiwa.Events
  * @memberof Connichiwa
  */


  /**
   * Allows the web application to register for connichiwa-related events. The given callback is executed when the given event occurs.
   *
   * @param {string} event The name of the event to register for.
   * @param {function} callback The callback function to call when the event is triggered
   *
   * @memberof Connichiwa.Events
    */
  var on = function(event, callback)
  {
    var validEvents = [ 
      "ready", 
      "deviceDetected", 
      "deviceDistanceChanged", 
      "deviceLost",
      "deviceConnected",
      "deviceDisconnected",
      "connectFailed"
    ];
    
    if (CWUtil.inArray(event, validEvents) === false) throw "Registering for invalid event: " + event;

    CWEventManager.register(event, callback);
  };
  
  
  var connect = function(device)
  {
    if (CWDevice.prototype.isPrototypeOf(device) === false) throw "Need a CWDevice to connect to";
    
    if (device.canBeConnected() === false) return;
    
    device.connectionState = CWDeviceConnectionState.CONNECTING;
    native_connectRemote(device.getIdentifier());
  };
  
  var send = function(device, message)
  {
    message.target = device.getIdentifier();
    CWDebug.log("CONNICHIWA.SEND "+JSON.stringify(message));
    _websocket.send(JSON.stringify(message));
  };

  return {
    _connectWebsocket    : _connectWebsocket,
    _send                : _send,
    _setIdentifier       : _setIdentifier,
    getIdentifier        : getIdentifier,
    on                   : on,
    connect              : connect,
    send                 : send
  };
})();
