"use strict";



/**
 * Gives us some nice debug convenience functions
 *
 * @namespace CWDebug
 */
var CWDebug = (function()
{
  /**
   * true if debug mode is on, otherwise false
   */
  var CWDEBUG = false;

  var enableDebug = function()
  {
    CWDEBUG = true;
  };

  /**
   * Logs a message to the console if debug mode is on
   *
   * @param {string} message the message to log
   *
   * @memberof CWDebug
   */
  var log = function(message)
  {
    if (CWDEBUG) console.log("WEBLIB    " + _getDateString() + " -- " + message);
  };

  /**
   * Gets a nicely formatted string of the given date
   *
   * @param {Date} date the date to format into a string. Defaults to the current date.
   * @returns {string} a string describing the date
   *
   * @memberof CWDebug
   */
  var _getDateString = function(date)
  {
    if (date === undefined) date = new Date();

    var hours = date.getHours();
    hours = (hours.length === 1) ? "0" + hours : hours;

    var minutes = date.getMinutes();
    minutes = (minutes.length === 1) ? "0" + minutes : minutes;

    var seconds = date.getSeconds();
    seconds = (seconds.length === 1) ? "0" + seconds : seconds;

    var milliseconds = date.getMilliseconds();
    milliseconds = (milliseconds.length === 1) ? "00" + milliseconds : milliseconds;
    milliseconds = (milliseconds.length === 2) ? "0" + milliseconds : milliseconds;

    return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
  };

  return {
    enableDebug : enableDebug,
    log : log
  };
})();
/* global CWUtil, CWEventManager, CWDebug */
"use strict";



var CWDeviceState = 
{
  DISCOVERED        : "discovered",
  CONNECTING        : "connecting",
  CONNECTED         : "connected",
  CONNECTION_FAILED : "connection_failed",
  DISCONNECTED      : "disconnected",
  LOST              : "lost"
};



/**
 * An instance of this class describes a remote device that was detected nearby. It furthermore keeps information like the distance of the device and other connection-related information.
 *
 * @namespace CWDevice
 */
function CWDevice(identifier, options)
{
  if (CWUtil.isObject(options) === false) options = {};
  var passedOptions = options;
  options = {};

  var defaultOptions = {
    distance : -1,
  };
  $.extend(options, defaultOptions, passedOptions);
  
  this.state = CWDeviceState.DISCOVERED;

  /**
   * A string representing a unique identifier of the device
   */
  var _identifier = identifier;
  
  /**
   * The current distance between the local device and the device represented by this CWDevice instance
   */
  var _distance = options.distance;

  /**
   * Updates the distance between the local device and the device represented by the instance of this class
   *
   * @param {double} value The new distance value in meters
   *
   * @method updateDistance
   * @memberof CWDevice
   */
  this.updateDistance = function(value)
  {
    _distance = value;
  };

  /**
   * Returns the identifier of this device
   *
   * @returns {string} The identifier of this device
   *
   * @method getIdentifier
   * @memberof CWDevice
   */
  this.getIdentifier = function() { return _identifier; };

  /**
   * Returns the current distance between the local device and the device represented by this CWDevice instance, in meters.
   *
   * @returns {double} the distance between the local device and this CWDevice in meters
   *
   * @method getDistance
   * @memberof CWDevice
   */
  this.getDistance = function() { return _distance; };
  
  this.canBeConnected = function() 
  { 
    return this.state !== CWDeviceState.CONNECTED && 
    this.state !== CWDeviceState.CONNECTING && 
    this.state !== CWDeviceState.LOST;
  };
  
  this.isConnected = function()
  {
    return (this.state === CWDeviceState.CONNECTED);
  };

  return this;
}


/**
 * Checks if the given object is equal to this device. Two devices are equal if they describe the same remote device (= their ID is the same). This does not do any pointer comparison.
 *
 * @param {object} object The object to compare this CWDevice to
 * @returns {bool} true if the given object is equal to this CWDevice, otherwise false
 */
CWDevice.prototype.equalTo = function(object)
{
  return this.getIdentifier() === object.getIdentifier();
};


/**
 * Returns a string representation of this CWDevice
 *
 * @returns {string} a string representation of this device
 */
CWDevice.prototype.toString = function() {
  return this.getIdentifier();
};
/* global CWDevice, CWEventManager, CWDebug */
"use strict";



/**
 * Manages the local device and all remote devices detected and connected to
 *
 * @namespace CWDeviceManager
 */
var CWDeviceManager = (function()
{
  /**
   * The identifier of the local device (the device the webserver is running on)
   */
  var _localIdentifier;

  /**
   * An array of detected remote devices as CWDevice objects. All detected devices are in here, they are not necessarily connected to or used in any way by this device.
   */
  var _remoteDevices = [];


  /**
   * Sets the identifier of the local device under which it is advertised to other devices
   *
   * @param {string} identifier The identifier
   *
   * @memberof CWDeviceManager
   */
  var setLocalID = function(identifier)
  {
    if (_localIdentifier !== undefined) return false;

    _localIdentifier = identifier;
    CWDebug.log("Local identifier set to " + _localIdentifier);
    
    return true;
  };


  /**
   * Adds a new remote device to the manager
   *
   * @param {CWDevice} newDevice The newly detected device
   *
   * @memberof CWDeviceManager
   */
  var addDevice = function(newDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw "Cannot add a non-device";
    if (getDeviceWithIdentifier(newDevice.getIdentifier()) !== null) return;

    _remoteDevices.push(newDevice);
    CWDebug.log("Added new device: " + newDevice);
  };


  /**
   * Removes a remote device from the manager
   *
   * @param {string} identifier The identifier of the device to remove
   *
   * @memberof CWDeviceManager
   */
  var removeDevice = function(identifier)
  {

    var device = getDeviceWithIdentifier(identifier);
    if (device === null) return;

    var index = _remoteDevices.indexOf(device);
    _remoteDevices.splice(index, 1);
    CWEventManager.trigger("deviceLost", device);
  };


  /**
   * Gets the CWDevice with the given identifier or null if the device is not stored in this manager
   *
   * @param {string} identifier The identifier of the device to search for
   * @returns A CWDevice that belongs to the given ID or null if that device cannot be found
   *
   * @memberof CWDeviceManager
   */
  var getDeviceWithIdentifier = function(identifier)
  {
    for (var i = 0; i < _remoteDevices.length; i++)
    {
      var remoteDevice = _remoteDevices[i];
      if (remoteDevice.getIdentifier() === identifier)
      {
        return remoteDevice;
      }
    }

    return null;
  };

  return {
    setLocalID              : setLocalID,
    addDevice               : addDevice,
    removeDevice            : removeDevice,
    getDeviceWithIdentifier : getDeviceWithIdentifier
  };
})();
/* global CWDebug */
"use strict";



/**
 * Manages events throughout Connichiwa. Allows all parts of Connichiwa to register for and trigger events.
 *
 * @namespace CWEventManager
 */
var CWEventManager = (function()
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
    CWDebug.log("Attached callback to " + event);
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
/* global CWDeviceManager, CWDeviceID, CWDevice, CWDeviceState, CWEventManager */
"use strict";



/**
 * The Connichiwa Communication Protocol Parser (Native Layer).  
 * Here the protocol used to communicate between this library and the native layer is parsed. This communication is done via JSON.
 *
 * **Local ID Information** -- type="localidentifier"  
 * Contains information about the local device. Format:
 * * identifier -- a string identifying the unique ID of the device the weblib runs on
 *
 * **Device Detected** -- type="devicedetected"
 * Contains information about a newly detected device. Format:   
 * * identifier -- the identifier of the newly detected device
 *
 * **Device Proximity Changed** -- type="devicedistancechanged"  
 * Contains information about the new proximity of a previously detected device. Format:  
 * * identifier -- the identifier of the device whose distance changed
 * * distance -- the new distance between this device and the other device, in meters
 *
 * **Device Lost** -- type="devicelost"  
 * Contains information about a device that went out of range or can not be detected anymore for other reasons. Format:  
 * * identifier -- the identifier of the lost device
 *
 * @namespace CWNativeCommunicationParser
 */
var CWNativeCommunicationParser = (function()
{
  /**
   * Parses a message from the websocket. If the message is none of the messages described by this class, this method will do nothing. Otherwise the message will trigger an appropiate action.
   *
   * @param {string} message The message from the websocket
   *
   * @memberof CWNativeCommunicationParser
   */
  var parse = function(message)
  {
    var object = JSON.parse(message);
    switch (object.type)
    {
    case "cwdebug":
      if (object.cwdebug) CWDebug.enableDebug();
      break;

    case "localidentifier":
      var success = CWDeviceManager.setLocalID(object.identifier);

      if (success) CWEventManager.trigger("ready");
      break;
    case "devicedetected":
      var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
      
      if (device === null)
      {
        device = new CWDevice(object.identifier);
        CWDeviceManager.addDevice(device);
      }
      else
      {
        if (device.state !== CWDeviceState.CONNECTED && device.state !== CWDeviceState.CONNECTING)
        {
          device.state = CWDeviceState.DISCOVERED;
        }
      }

      CWEventManager.trigger("deviceDetected", device);
      break;
    case "devicedistancechanged":
      var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
      if (device === null) return;
      
      device.updateDistance(object.distance);
CWEventManager.trigger("deviceDistanceChanged", device);
      break;
    case "devicelost":
      var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
      if (device.state != CWDeviceState.CONNECTED && device.state != CWDeviceState.CONNECTING)
      {
        device.state = CWDeviceState.LOST;
      }
      CWEventManager.trigger("deviceLost", device);
      break;
    case "remoteconnectfailed":
      var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
      device.state = CWDeviceState.CONNECTING_FAILED;
      CWEventManager.trigger("connectFailed", device);
      break;
    }
  };

  return {
    parse : parse
  };
})();
/* global CWDebug, CWDeviceManager, CWDeviceState, CWEventManager, Connichiwa */
"use strict";


/**
 * The Connichiwa Communication Protocol Parser (Remote Device).  
 * Here the protocol used to communicate between this library and a connected remote device is parsed. The communication is done via JSON.
 *
 * **Remote ID Information** -- type="remoteidentifier"  
 * Contains the identifier of a connected remote device. Format:
 * * identifier -- a string identifying the unique ID of the device the weblib runs on
 *
 * @namespace CWRemoteCommunicationParser
 */
var CWRemoteCommunicationParser = (function()
{
  /**
   * Parses a message from the websocket. If the message is none of the messages described by this class, this method will do nothing. Otherwise the message will trigger an appropiate action.
   *
   * @param {string} message The message from the websocket
   *
   * @memberof CWRemoteCommunicationParser
   */
  var parse = function(message)
  {
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "didconnect":
        var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
        if (device === null) return;
        
        device.state = CWDeviceState.CONNECTED;
        
        native_remoteDidConnect(device.getIdentifier());
        CWEventManager.trigger("deviceConnected", device);
        break;
      case "willdisconnect":
        var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
        if (device === null) return;
          
        device.state = CWDeviceState.DISCONNECTED;
          
        var data = { type: "remoteDisconnected", identifier: object.identifier };
        Connichiwa._send(JSON.stringify(data)); 
        
        CWEventManager.trigger("deviceDisconnected", device);
        break;
    }
  };

  return {
    parse : parse
  };
})();
"use strict";



/**
 * A utility class giving us some often needed utility functions.
 *
 * @namespace CWUtil
 */
var CWUtil = (function()
{
  /**
   * Checks if the given parameter is an Int.
   *
   * @param {object} value A value to check
   * @returns {boolean} true if the given value is an Int, otherwise false
   *
   * @memberof CWUtil
   */
  var isInt = function(value)
  {
    return (value === parseInt(value));
  };


  /**
   * Checks if the given parameter is an object and not null.
   *
   * @param {object} value A value to check
   * @returns {boolean} true if the given value is an object, otherwise false
   *
   * @memberof CWUtil
   */
  var isObject = function(value)
  {
    return (typeof(value) === "object" && value !== null);
  };


  /**
   * Checks if the given value is in the given array.
   *
   * @param {object} value The value to check
   * @param {array} array The array that the value should be in
   * @returns {boolean} true if value is in array, otherwise false
   *
   * @memberof CWUtil
   */
  var inArray = function(value, array)
  {
    return (array.indexOf(value) > -1);
  };


  return {
    isInt    : isInt,
    isObject : isObject,
    inArray  : inArray
  };
})();
/* global CWDebug */
"use strict";


/**
 * The Connichiwa Communication Protocol Parser (Webserver).  
 * Here the protocol used to communicate between this library and the webserver is parsed. Although all websocket messages are (obvisouly) send by the webserver, this class parses messages that are triggered by the webserver itself and not relayed through the webserver. The communication is done via JSON.
 *
 * **Debug Flag Information** -- type="debug"  
 * Contains a flag telling us if we run in debug mode or not. Format:
 * * cwdebug -- true if we are debugging, otherwise false
 *
 * @namespace CWWebserverCommunicationParser
 */
var CWWebserverCommunicationParser = (function()
{
  /**
   * Parses a message from the websocket. If the message is none of the messages described by this class, this method will do nothing. Otherwise the message will trigger an appropiate action.
   *
   * @param {string} message The message from the websocket
   *
   * @memberof CWWebserverCommunicationParser
   */
  var parse = function(message)
  {
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "debug":
        CWDebug.CWDEBUG = Boolean(object.cwdebug);
        break;
    }
  };

  return {
    parse : parse
  };
})();
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
    native_websocketDidOpen();
    CWDebug.log("Websocket opened");
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
    
    //CWWebserverCommunicationParser.parse(message);
    //CWNativeCommunicationParser.parse(message);
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
    native_websocketDidClose();
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
    
    device.state = CWDeviceState.CONNECTING;

    // var data = { type: "connectionRequest", identifier: device.getIdentifier() };
    //_send(JSON.stringify(data));
    native_connectRemote(device.getIdentifier());
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
