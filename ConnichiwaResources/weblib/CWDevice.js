/* global CWUtil, CWEventManager */
"use strict";



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
    connected : false,
    distance  : -1,
  };
  $.extend(options, defaultOptions, passedOptions);

  /**
   * A string representing a unique identifier of the device
   */
  var _identifier = identifier;

  var _connected = options.connected;
  
  /**
   * The current distance between the local device and the device represented by this CWDevice instance
   */
  var _distance = options.distance;
  
  this.didConnect = function()
  {
    _connected = true;
  };
  
  this.didDisconnect = function()
  {
    _connected = false;
  }

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
  
  this.isConnected = function() { return _connected; };

  /**
   * Returns the current distance between the local device and the device represented by this CWDevice instance, in meters.
   *
   * @returns {double} the distance between the local device and this CWDevice in meters
   *
   * @method getDistance
   * @memberof CWDevice
   */
  this.getDistance = function() { return _distance; };

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
