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
  var _websocket = new WebSocket("ws://127.0.0.1:8001");


  /**
   * Called after the websocket connection was successfully established
   *
   * @memberof Connichiwa.Websocket
   */
  _websocket.onopen = function()
  {
    CWDebug.log("Websocket opened");
    CWEventManager.trigger("ready");
  };


  /**
   * Called when a messages arrives from the webserver
   *
   * @memberof Connichiwa.Websocket
   */
  _websocket.onmessage = function(e)
  {
    var message = e.data;
    CWDebug.log("message: " + message);
    
    CWWebserverCommunicationParser.parse(message);
    CWNativeCommunicationParser.parse(message);
    CWRemoteCommunicationParser.parse(message);
  };


  /**
   * Called when the connection to the webserver errors
   *
   * @memberof Connichiwa.Websocket
   */
  _websocket.onerror = function()
  {
    alert("error");
    CWDebug.log("Websocket error");
  };


  /**
   * Called when the connection to the webserver was closed
   *
   * @memberof Connichiwa.Websocket
   */
  _websocket.onclose = function()
  {
    CWDebug.log("Websocket closed");
  };
  
  
  var _send = function(message)
  {
    _websocket.send(message);
  };


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
      "localIdentifierSet", 
      "deviceDetected", 
      "deviceDistanceChanged", 
      "deviceLost",
      "deviceConnected",
      "deviceDisconnected",
      "connectionRequestFailed"
    ];
    
    if (CWUtil.inArray(event, validEvents) === false) throw "Registering for invalid event: " + event;

    CWEventManager.register(event, callback);
  };
  
  
  var connect = function(device)
  {
    if (CWDevice.prototype.isPrototypeOf(device) === false) throw "Need a CWDevice to connect to";
    
    if (device.canBeConnected() === false) return;
    
    device.state = CWDeviceState.CONNECTING;
    var data = { type: "connectionRequest", identifier: device.getIdentifier() };
    _send(JSON.stringify(data));
  };
  
  var send = function(device, message)
  {
    message.target = "remote";
    message.targetIdentifier = device.getIdentifier();
    _send(JSON.stringify(message));
  };

  return {
    _send   : _send,
    on      : on,
    connect : connect,
    send    : send
  };
})();
