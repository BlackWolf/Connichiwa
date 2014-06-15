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
