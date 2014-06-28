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



var CWDeviceDiscoveryState = 
{
  DISCOVERED : "discovered",
  LOST       : "lost"
};

var CWDeviceConnectionState =
{
  DISCONNECTED : "disconnected",
  CONNECTING   : "connecting",
  CONNECTED    : "connected"
};



/**
 * An instance of this class describes a remote device that was detected nearby. It furthermore keeps information like the distance of the device and other connection-related information.
 *
 * @namespace CWDevice
 */
function CWDevice(identifier)
{
  this.discoveryState = CWDeviceDiscoveryState.DISCOVERED;
  this.connectionState = CWDeviceConnectionState.DISCONNECTED;
  this.distance = -1;

  /**
   * A string representing a unique identifier of the device
   */
  var _identifier = identifier;

  /**
   * Returns the identifier of this device
   *
   * @returns {string} The identifier of this device
   *
   * @method getIdentifier
   * @memberof CWDevice
   */
  this.getIdentifier = function() { return _identifier; };
  
  this.isNearby = function()
  {
    return (this.discoveryState === CWDeviceDiscoveryState.DISCOVERED);
  };
  
  this.canBeConnected = function() 
  { 
    return (this.connectionState === CWDeviceConnectionState.DISCONNECTED);
  };
  
  this.isConnected = function()
  {
    return (this.connectionState === CWDeviceConnectionState.CONNECTED);
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
  if (CWDevice.prototype.isPrototypeOf(object) === false) return false;
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
   * An array of detected remote devices as CWDevice objects. All detected devices are in here, they are not necessarily connected to or used in any way by this device.
   */
  var _remoteDevices = [];

  /**
   * Adds a new remote device to the manager
   *
   * @param {CWDevice} newDevice The device that should be added to the manager. If the device already exists, nothing will happen.
   * @returns {bool} true if the device was added, otherwise false
   *
   * @memberof CWDeviceManager
   */
  var addDevice = function(newDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw "Cannot add a non-device";
    if (getDeviceWithIdentifier(newDevice.getIdentifier()) !== null) return false;

    _remoteDevices.push(newDevice);
    return true;
  };


  /**
   * Removes a remote device from the manager
   *
   * @param {string|CWDevice} identifier The identifier of the device to remove or a CWDevice. If the device is not stored by this manager, nothing will happen
  *  @returns {bool} true if the device was removed, otherwise false
   *
   * @memberof CWDeviceManager
   */
  var removeDevice = function(identifier)
  {
    if (CWDevice.prototype.isPrototypeOf(identifier) === true) identifier = identifier.getIdentifier();
      
    var device = getDeviceWithIdentifier(identifier);
    if (device === null) return false;

    var index = _remoteDevices.indexOf(device);
    _remoteDevices.splice(index, 1);
    CWEventManager.trigger("deviceLost", device);
    
    return true;
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
      case "connectwebsocket": _parseConnectWebsocket(object); break;
      case "cwdebug": _parseDebug(object); break;
      case "localidentifier": _parseLocalIdentifier(object); break;
      case "devicedetected": _parseDeviceDetected(object); break;
      case "devicedistancechanged": _parseDeviceDistanceChanged(object); break;
      case "devicelost": _parseDeviceLost(object); break;
      case "remoteconnectfailed": _parseRemoteConnectFailed(object); break;
    case "remotedisconnected": _parseRemoteDisconnected(object); break;
    }
  };
  
  
  var _parseConnectWebsocket = function(message)
  {
    Connichiwa._connectWebsocket();
  };
  
  
  var _parseDebug = function(message)
  {
    if (message.cwdebug) CWDebug.enableDebug();
  };
  
  
  var _parseLocalIdentifier = function(message)
  {
    var success = Connichiwa._setIdentifier(message.identifier);
    if (success) CWEventManager.trigger("ready");
  };
  
  
  var _parseDeviceDetected = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    
    //We might re-detect a lost device, so it is possible that the device is already stored
    if (device === null)
    {
      device = new CWDevice(message.identifier);
      CWDeviceManager.addDevice(device);
    }
    else
    {
      device.discoveryState = CWDeviceDiscoveryState.DETECTED;
    }

    CWEventManager.trigger("deviceDetected", device);
  };
  
  
  var _parseDeviceDistanceChanged = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    if (device === null) return;
    
    device.distance = message.distance;
    CWEventManager.trigger("deviceDistanceChanged", device);
  };
  
  
  var _parseDeviceLost = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    device.discoveryState = CWDeviceDiscoveryState.LOST;
    CWEventManager.trigger("deviceLost", device);
  };
  
  
  var _parseRemoteConnectFailed = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    device.connectionState = CWDeviceConnectionState.DISCONNECTED;
    CWEventManager.trigger("connectFailed", device);
  };
  
  
  var _parseRemoteDisconnected = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    if (device === null) return;
      
    device.connectionState = CWDeviceConnectionState.DISCONNECTED;
    CWEventManager.trigger("deviceDisconnected", device);
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
      case "remoteidentifier": _parseRemoteIdentifier(object); break;
    }
  };
  
  
  var _parseRemoteIdentifier = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    if (device === null) return;
    
    device.connectionState = CWDeviceConnectionState.CONNECTED;
    native_remoteDidConnect(device.getIdentifier());
    CWEventManager.trigger("deviceConnected", device);
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
  
  
  var _connectWebsocket = function()
  {
    _websocket = new WebSocket("ws://127.0.0.1:8001");
    
    _websocket.onopen = onWebsocketOpen;
    _websocket.onmessage = onWebsocketMessage;
    _websocket.onclose = onWebsocketClose;
    _websocket.onerror = onWebsocketError;
  };


  /**
   * Called after the websocket connection was successfully established
   *
   * @memberof Connichiwa.Websocket
   */
  var onWebsocketOpen = function()
  {
    native_websocketDidOpen();
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
    alert("error");
    CWDebug.log("Websocket error");
  };


  /**
   * Called when the connection to the webserver was closed
   *
   * @memberof Connichiwa.Websocket
   */
  var onWebsocketClose = function()
  {
    native_websocketDidClose();
    CWDebug.log("Websocket closed");
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
    _websocket.send(JSON.stringify(message));
  };

  return {
    _connectWebsocket : _connectWebsocket,
    _setIdentifier    : _setIdentifier,
    getIdentifier     : getIdentifier,
    on                : on,
    connect           : connect,
    send              : send
  };
})();
