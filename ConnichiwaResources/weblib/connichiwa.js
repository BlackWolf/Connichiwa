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
    log : log
  };
})();
/* global CWUtil, CWEventManager */
"use strict";



/**
 * An instance of this class described the unique ID of a single device (the local device or a remote device)
 *
 * @param {number} major The major part of the ID
 * @param {number} minor The minor part of the ID
 * @returns {CWDeviceID} a new CWDeviceID instance
 *
 * @namespace CWDeviceID
 */
function CWDeviceID(major, minor) {
  if (CWUtil.isInt(major) === false || CWUtil.isInt(minor) === false) throw "CWDeviceID must contain a valid major and a minor value";

  /**
   * The major part of this ID
   */
  var _major = major;

  /**
   * The minor part of this ID
   */
  var _minor = minor;

  this.getMajor = function() { return _major; };
  this.getMinor = function() { return _minor; };

  return this;
}


/**
 * Checks if this CWDeviceID is equal to another
 *
 * @param {object} object another object
 * @returns {bool} true if the object is a CWDeviceID with the same major and minor part
 *
 * @memberof CWDeviceID
 */
CWDeviceID.prototype.equalTo = function(object)
{
  if (CWDeviceID.prototype.isPrototypeOf(object) === false) return false;

  return (this.getMajor() === object.getMajor() && this.getMinor() === object.getMinor());
};


/**
 * Transforms this ID into a string for output
 *
 * @returns {string} a string describing this ID
 *
 * @memberof CWDeviceID
 */
CWDeviceID.prototype.toString = function() {
  return "(" + this.getMajor() + "." + this.getMinor() + ")";
};



/**
 * An instance of this class describes a remote device that was detected nearby. It furthermore keeps information like the distance of the device and other connection-related information.
 *
 * @namespace CWDevice
 */
function CWDevice(id, options)
{
  if (CWDeviceID.prototype.isPrototypeOf(id) === false)  throw "Cannot create device without a valid CWDeviceID";

  if (CWUtil.isObject(options) === false) options = {};
  var passedOptions = options;
  options = {};

  var defaultOptions = {
    proximity : "unknown",
  };
  $.extend(options, defaultOptions, passedOptions);

  /**
   * The CWDeviceID representing this device's ID
   */
  var _id = id;

  /**
   * The current distance between the local device and the device represented by this CWDevice instance
   */
  var _proximity = options.proximity;

  /**
   * Updates the distance between the local device and the device represented by the instance of this class
   *
   * @param {string} newProximity The new distance as a string
   *
   * @method updateProximity
   * @memberof CWDevice
   */
  this.updateProximity = function(newProximity)
  {
    //TODO check proximity string
    _proximity = newProximity;
  };

  /**
   * Returns the ID of this device
   *
   * @returns {CWDeviceID} the ID of this device
   * @method getID
   * @memberof CWDevice
   */
  this.getID        = function() { return _id; };

  /**
   * Returns the current distance between the local device and the device represented by this CWDevice instance, as a string.
   *
   * @returns {string} a string describing the distance between the local device and this CWDevice
   * @method updateProximity
   * @memberof CWDevice
   */
  this.getProximity = function() { return _proximity; };

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

  return this.getID().equalTo(object.getID());
};


/**
 * Returns a string representation of this CWDevice
 *
 * @returns {string} a string representation of this device
 */
CWDevice.prototype.toString = function() {
  return this.getID().toString();
};
/* global CWDevice, CWDeviceID, CWEventManager, CWDebug */
"use strict";



/**
 * Manages the local device and all remote devices detected and connected to
 *
 * @namespace CWDeviceManager
 */
var CWDeviceManager = (function()
{
  /**
   * The CWDeviceID of the local device (the device the webserver is running on)
   */
  var _localID;

  /**
   * An array of detected remote devices as CWDevice objects. All detected devices are in here, they are not necessarily connected to or used in any way by this device.
   */
  var _remoteDevices = [];


  /**
   * Sets the ID of the local device under which it is advertised to other devices
   *
   * @param {CWDeviceID} ID The local ID
   *
   * @memberof CWDeviceManager
   */
  var setLocalID = function(ID)
  {
    if (_localID !== undefined) throw "Local ID can only be set once";

    _localID = ID;
    CWDebug.log("Local ID set to " + _localID.toString());
    CWEventManager.trigger("localIDSet", _localID);
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
    if (_getDeviceWithID(newDevice.getID()) !== null) throw "Device with ID " + newDevice.getID() + " was added twice";

    _remoteDevices.push(newDevice);
    CWDebug.log("Detected new device: " + newDevice);
    CWEventManager.trigger("deviceDetected", newDevice);
  };


  /**
   * Updates the distance between the local and a remote device
   *
   * @param {CWDeviceID} ID The ID of the device that changed
   * @param {string} newProximity A string describing the new proximity
   *
   * @memberof CWDeviceManager
   */
  var updateDeviceProximity = function(ID, newProximity)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to update a device";

    var device = _getDeviceWithID(ID);
    if (device === null) throw "Tried to change proximity of an undetected device";

    device.updateProximity(newProximity);
    CWDebug.log("Distance of " + this + " changed to " + newProximity);
    CWEventManager.trigger("deviceProximityChanged", device);
  };


  /**
   * Removes a remote device from the manager
   *
   * @param {CWDeviceID} ID The ID of the device to remove
   *
   * @memberof CWDeviceManager
   */
  var removeDevice = function(ID)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to remove a device";

    var device = _getDeviceWithID(ID);
    if (device === null) throw "Tried to remove a device that doesn't exist";

    var index = _remoteDevices.indexOf(device);
    _remoteDevices.splice(index, 1);
    CWEventManager.trigger("deviceLost", device);
  };


  /**
   * Gets the CWDevice stored under the given ID or null if the device is not stored in this manager
   *
   * @param {CWDeviceID} ID The ID of the device to search for
   * @returns A CWDevice that belongs to the given ID or null if that device cannot be found
   *
   * @memberof CWDeviceManager
   */
  var _getDeviceWithID = function(ID)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to search for an existing device";

    for (var i = 0; i < _remoteDevices.length; i++)
    {
      var remoteDevice = _remoteDevices[i];
      if (remoteDevice.getID().equalTo(ID))
      {
        return remoteDevice;
      }
    }

    return null;
  };

  return {
    setLocalID            : setLocalID,
    addDevice             : addDevice,
    updateDeviceProximity : updateDeviceProximity,
    removeDevice          : removeDevice
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
/* global CWDeviceManager, CWDeviceID, CWDevice */
"use strict";



/**
 * The Connichiwa Communication Protocol Parser (Native Layer).  
 * Here the protocol used to communicate between this library and the native layer is parsed. This communication is done via JSON.
 *
 * **Local ID Information** -- type="localid"  
 * Contains information about the local device. Format:
 * * major -- the major number of this device
 * * minor -- the minor number of this device
 *
 * **Device Detected** -- type="newdevice"   
 * Contains information about a newly detected device. Format:   
 * * major -- The major part of the device ID
 * * minor -- The minor part of the device ID
 * * proximity -- a string describing the distance of this device to the detected device (either "far", "near" or "immediate")
 *
 * **Device Proximity Changed** -- type="deviceproximitychanged"  
 * Contains information about the new proximity of a previously detected device. Format:  
 * * major -- The major part of the device ID
 * * minor -- The minor part of the device ID
 * * proximity -- a string describing the distance of this device to the device (either "far", "near" or "immediate")
 *
 * **Device Lost** -- type="devicelost"  
 * Contains information about a device that went out of range or can not be detected anymore for other reasons. Format:  
 * * major -- The major part of the device ID
 * * minor -- The minor part of the device ID
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
      case "localid":
        var ID = new CWDeviceID(object.major, object.minor);
        CWDeviceManager.setLocalID(ID);
        break;
      case "newbeacon":
        var device = new CWDevice(new CWDeviceID(object.major, object.minor), { proximity: object.proximity });
        CWDeviceManager.addDevice(device);
        break;
      case "deviceproximitychanged":
        CWDeviceManager.updateDeviceProximity(new CWDeviceID(object.major, object.minor), object.proximity);
        break;
      case "devicelost":
        CWDeviceManager.removeDevice(new CWDeviceID(object.major, object.minor));
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
/* global LazyLoad, CWDeviceManager, CWNativeCommunicationParser, CWDebug, CWUtil, CWEventManager */
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
    
    CWNativeCommunicationParser.parse(message);
    CWWebserverCommunicationParser.parse(message);
  };


  /**
   * Called when the connection to the webserver errors
   *
   * @memberof Connichiwa.Websocket
   */
  _websocket.onerror = function()
  {
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
      "localIDSet", 
      "deviceDetected", 
      "deviceProximityChanged", 
      "deviceLost" 
    ];
    
    if (CWUtil.inArray(event, validEvents) === false) throw "Registering for invalid event: " + event;

    CWEventManager.register(event, callback);
  };


  return {
    on : on
  };
})();
