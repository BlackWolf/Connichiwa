/* global CWUtil */
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
      Debug.log("Distance of " + this + " changed to " + _proximity);
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
