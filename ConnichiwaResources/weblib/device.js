"use strict";

function Device(id, options)
{
  if (id === undefined) throw "Cannot instantiate device without a valid ID";
  if (options === undefined) options = {};

  var passedOptions = options;
  options = {};
  var defaultOptions = {
    proximity: "unknown",
    isRemote: true
  };
  $.extend(options, defaultOptions, passedOptions);

  this.id = id;
  this.proximity = options.proximity;
  this.isRemote = options.isRemote;

  return this;
}


Device.fromData = function(data)
{
  if (data === undefined) throw "Cannot instantiate device without data";

  var major = data.major;
  var minor = data.minor;
  delete data.major;
  delete data.minor;
  var id = new DeviceID(major, minor);

  return new Device(id, data);
};


Device.prototype.updateData = function(newData)
{
  if (newData === undefined) return;

  if (newData.proximity) this.proximity = newData.proximity;
};


Device.prototype.equalTo = function(obj)
{
  if (Device.prototype.isPrototypeOf(obj) === false) return false;

  return this.id.equalTo(obj.id);
};


Device.prototype.toString = function() {
  return this.id.toString();
};



function DeviceID(major, minor) {
  if (major === undefined || minor === undefined) throw "DeviceID must contain a major and a minor";

  this.major = major;
  this.minor = minor;
}

DeviceID.prototype.equalTo = function(obj)
{
  if (DeviceID.prototype.isPrototypeOf(obj) === false) return false;

  return (this.major === obj.major && this.minor === obj.minor);
};

DeviceID.prototype.toString = function() {
  return "("+this.major+"."+this.minor+")";
};
