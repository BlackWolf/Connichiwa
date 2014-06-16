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
