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
    isRemote  : true
  };
  $.extend(options, defaultOptions, passedOptions);

  var _id = id;
  var _isRemote = options.isRemote;
  var _proximity = options.proximity;

  this.updateData = function(newData)
  {
    if (CWUtil.isObject(newData) === false) return;

    //Proximity
    var oldProximity = _proximity;

    if (newData.proximity) _proximity = newData.proximity;

    if (oldProximity !== _proximity) {
      CWDebug.log("Distance of " + this + " changed to " + _proximity);
      CWEventManager.trigger("deviceChange", this);
    }
  };

  this.getID        = function() { return _id; };
  this.isRemote     = function() { return _isRemote; };
  this.getProximity = function() { return _proximity; };

  return this;
}


CWDevice.fromData = function(data)
{
  if (CWUtil.isObject(data) === false) throw "Cannot instantiate device without data";

  var major = data.major;
  var minor = data.minor;
  delete data.major;
  delete data.minor;
  var id = new CWDeviceID(major, minor);

  return new CWDevice(id, data);
};


CWDevice.prototype.equalTo = function(obj)
{
  if (CWDevice.prototype.isPrototypeOf(obj) === false) return false;

  return this.getID().equalTo(obj.getID());
};


CWDevice.prototype.toString = function() {
  return this.getID().toString();
};
/* global CWDevice, CWDeviceID, CWEventManager */
"use strict";



var CWDeviceManager = (function()
{
  var _localDevice;
  var _remoteDevices = [];


  var addDevice = function(newDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw "Cannot add a non-device";

    //Check if the device already exists
    var existingDevice = getDevice(newDevice.getID());
    if (existingDevice !== null) return existingDevice;

    if (newDevice.isRemote() !== true)
    {
      setLocalDevice(newDevice);
    }
    else
    {
      CWDebug.log("New remote device " + newDevice.toString() + " at distance " + newDevice.getProximity());
      _remoteDevices.push(newDevice);
      CWEventManager.trigger("deviceChange", newDevice);
    }

    return true;
  };

  var setLocalDevice = function(localDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(localDevice) === false) throw "Local device must be a device";
    if (_localDevice !== undefined) throw "Local device cannot be set twice";
    if (localDevice.isRemote() !== false) throw "Local device must be local";

    CWDebug.log("Adding local device info: " + localDevice.toString());

    _localDevice = localDevice;
    CWEventManager.trigger("localDeviceSet", _localDevice);
  };


  var setLocalDeviceWithData = function(localDeviceData)
  {
    if (CWUtil.isObject(localDeviceData) === false) localDeviceData = {};

    localDeviceData.isRemote = false;
    var localDevice = CWDevice.fromData(localDeviceData);

    setLocalDevice(localDevice);
  };


  var addOrUpdateDevice = function(deviceData)
  {
    var newDevice = CWDevice.fromData(deviceData);
    var addResult = addDevice(newDevice);

    if (addResult !== true)
    {
      //The beacon data was an update to an existing device
      //addDevice() gives the existing device back to us
      var existingDevice = addResult;
      existingDevice.updateData(deviceData);
    }
  };


  var getDevice = function(id)
  {
    if (CWDeviceID.prototype.isPrototypeOf(id) === false) throw "A DeviceID is needed to search for an existing device";

    for (var i = 0; i < _remoteDevices.length; i++)
    {
      var remoteDevice = _remoteDevices[i];
      if (remoteDevice.getID().equalTo(id))
      {
        return remoteDevice;
      }
    }

    return null;
  };

  return {
    addDevice              : addDevice,
    setLocalDevice         : setLocalDevice,
    setLocalDeviceWithData : setLocalDeviceWithData,
    addOrUpdateDevice      : addOrUpdateDevice,
    getDevice              : getDevice
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
* Local Device Information | type="localinfo"
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
      case "localinfo":
        CWDeviceManager.setLocalDeviceWithData(object);
        break;
      case "ibeacon":
        CWDeviceManager.addOrUpdateDevice(object);
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
    var validEvents = [ "ready", "localDeviceSet", "deviceChange" ];
    if (CWUtil.inArray(event, validEvents) === false) throw "Registering for invalid event: " + event;

    CWEventManager.register(event, callback);
  };


  return {
    on : on
  };
})();
