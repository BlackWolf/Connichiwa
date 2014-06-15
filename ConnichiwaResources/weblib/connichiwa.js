"use strict";



var CWDebug = (function()
{
  var CWDEBUG = false;

  var log = function(message)
  {
    if (CWDEBUG) console.log("WEBLIB    " + _getDateString() + " -- " + message);
  };

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



function CWDeviceID(major, minor) {
  if (CWUtil.isInt(major) === false || CWUtil.isInt(minor) === false) throw "CWDeviceID must contain a valid major and a minor value";

  var _major = major;
  var _minor = minor;

  this.getMajor = function() { return _major; };
  this.getMinor = function() { return _minor; };

  return this;
}


CWDeviceID.prototype.equalTo = function(obj)
{
  if (CWDeviceID.prototype.isPrototypeOf(obj) === false) return false;

  return (this.getMajor() === obj.getMajor() && this.getMinor() === obj.getMinor());
};


CWDeviceID.prototype.toString = function() {
  return "(" + this.getMajor() + "." + this.getMinor() + ")";
};



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

  var _id = id;
  var _proximity = options.proximity;

  this.updateProximity = function(newProximity)
  {
    //TODO check proximity string

    _proximity = newProximity;
  };

  this.getID        = function() { return _id; };
  this.getProximity = function() { return _proximity; };

  return this;
}


CWDevice.prototype.equalTo = function(obj)
{
  if (CWDevice.prototype.isPrototypeOf(obj) === false) return false;

  return this.getID().equalTo(obj.getID());
};


CWDevice.prototype.toString = function() {
  return this.getID().toString();
};
/* global CWDevice, CWDeviceID, CWEventManager, CWDebug */
"use strict";



var CWDeviceManager = (function()
{
  var _localID;
  var _remoteDevices = [];


  var setLocalID = function(ID)
  {
    if (_localID !== undefined) throw "Local ID can only be set once";

    _localID = ID;
    CWDebug.log("Local ID set to " + _localID.toString());
    CWEventManager.trigger("localIDSet", _localID);
  };


  var addDevice = function(newDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw "Cannot add a non-device";
    if (_getDeviceWithID(newDevice.getID()) !== null) throw "Device with ID " + newDevice.getID() + " was added twice";

    _remoteDevices.push(newDevice);
    CWDebug.log("Detected new device: " + newDevice);
    CWEventManager.trigger("deviceDetected", newDevice);
  };


  var updateDeviceProximity = function(ID, newProximity)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to update a device";

    var device = _getDeviceWithID(ID);
    if (device === null) throw "Tried to change proximity of an undetected device";

    device.updateProximity(newProximity);
    CWDebug.log("Distance of " + this + " changed to " + newProximity);
    CWEventManager.trigger("deviceProximityChanged", device);
  };


  var removeDevice = function(ID)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to remove a device";

    var device = _getDeviceWithID(ID);
    if (device === null) throw "Tried to remove a device that doesn't exist";

    var index = _remoteDevices.indexOf(device);
    _remoteDevices.splice(index, 1);
    CWEventManager.trigger("deviceLost", device);
  };


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



var CWEventManager = (function()
{
  var _events = {};

  var register = function(event, callback)
  {
    if (typeof(event) !== "string") throw "Event name must be a string";
    if (typeof(callback) !== "function") throw "Event callback must be a function";

    if (!_events[event]) _events[event] = [];
    _events[event].push(callback);
    CWDebug.log("Attached callback to " + event);
  };

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
/* global CWDeviceManager */
"use strict";



/*****
* The Connichiwa Web Library Communication Protocol (Native Layer)
*
* Here we describe the protocol used to communicate between this library and the native layer. The communication is done via JSON.
*
*
*
* Local ID Information | type="localid"
* Contains information about the local device
* Format: major -- the major number of this device
*         minor -- the minor number of this device
*
*
* iBeacon Detected | type="ibeacon"
* When an iBeacon was detected by the native layer, or iBeacon data changed, it will send us the beacon data.
* Format: major -- The major number of the beacon
*         minor -- The minor number of the beacon
*         proximity -- a string describing the distance to the beacon (either "far", "near", "immediate" or "unknown")
*****/

var CWNativeCommunicationParser = (function()
{
  var parse = function(object)
  {
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
      case "beaconproximitychange":
        CWDeviceManager.updateDeviceProximity(new CWDeviceID(object.major, object.minor), object.proximity);
        break;
      case "lostbeacon":
        CWDeviceManager.removeDevice(new CWDeviceID(object.major, object.minor));
        break;
    }
  };

  return {
    parse : parse
  };
})();
"use strict";



var CWUtil = (function()
{
  var isInt = function(value)
  {
    return (value === parseInt(value));
  };


  var isObject = function(obj)
  {
    return (typeof(obj) === "object" && obj !== null);
  };


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


/*****
* The Connichiwa Web Library Communication Protocol (Webserver)
*
* Here we describe the protocol used to communicate between this library and the local webserver. These describe messages that are not triggered by the native layer. For those messages see CWNativeCommunicationParser. The communication is done via JSON.
*
*
*
* Debug Flag Information | type="debug"
* Contains information about if we run in debug mode or not
* Format: cwdebug -- true if we are debugging, otherwise false
*****/

var CWWebserverCommunicationParser = (function()
{
  var parse = function(object)
  {
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




var Connichiwa = (function()
{
  ///////////////
  // WEBSOCKET //
  ///////////////

  var _websocket = new WebSocket("ws://127.0.0.1:8001");

  _websocket.onopen = function()
  {
    CWDebug.log("Websocket opened");
    CWEventManager.trigger("ready");
  };


  _websocket.onmessage = function(e)
  {
    var message = e.data;

    CWDebug.log("message: " + message);

    var object = JSON.parse(message);
    CWNativeCommunicationParser.parse(object);
  };


  _websocket.onerror = function()
  {
    CWDebug.log("Websocket error");
  };


  _websocket.onclose = function()
  {
    CWDebug.log("Websocket closed");
  };


  /////////////
  // EVENTS //
  ////////////


  var on = function(event, callback)
  {
    var validEvents = [ "ready", "localIDSet", "deviceDetected", "deviceProximityChanged", "deviceLost" ];
    if (CWUtil.inArray(event, validEvents) === false) throw "Registering for invalid event: " + event;

    CWEventManager.register(event, callback);
  };


  return {
    on : on
  };
})();
