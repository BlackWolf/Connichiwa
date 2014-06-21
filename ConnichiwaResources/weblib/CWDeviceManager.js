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
    if (_localIdentifier !== undefined) throw "Local identifier can only be set once";

    _localIdentifier = identifier;
    CWDebug.log("Local identifier set to " + _localIdentifier);
    CWEventManager.trigger("localIdentifierSet", _localIdentifier);
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
    if (_getDeviceWithIdentifier(newDevice.getIdentifier()) !== null) throw "Device with identifier " + newDevice.getIdentifier() + " was added twice";

    _remoteDevices.push(newDevice);
    CWDebug.log("Detected new device: " + newDevice);
    CWEventManager.trigger("deviceDetected", newDevice);
  };


  /**
   * Updates the distance between the local and a remote device
   *
   * @param {string} identifier The identifier of the device that changed
   * @param {double} newDistance The new distance
   *
   * @memberof CWDeviceManager
   */
  var updateDeviceDistance = function(identifier, newDistance)
  {
    var device = _getDeviceWithIdentifier(identifier);
    if (device === null) throw "Tried to update the distance of an undetected device";

    device.updateDistance(newDistance);
    CWDebug.log("Distance of " + this + " changed to " + newDistance);
    CWEventManager.trigger("deviceDistanceChanged", device);
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

    var device = _getDeviceWithIdentifier(identifier);
    if (device === null) throw "Tried to remove a device that doesn't exist";

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
  var _getDeviceWithIdentifier = function(identifier)
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
    setLocalID           : setLocalID,
    addDevice            : addDevice,
    updateDeviceDistance : updateDeviceDistance,
    removeDevice         : removeDevice
  };
})();
