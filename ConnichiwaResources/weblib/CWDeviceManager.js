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
    if (_localIdentifier !== undefined) return false;

    CWDebug.log("Local identifier set to " + _localIdentifier);
    _localIdentifier = identifier;
    
    return true;
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
    if (getDeviceWithIdentifier(newDevice.getIdentifier()) !== null) return;

    _remoteDevices.push(newDevice);
    CWDebug.log("Added new device: " + newDevice);
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

    var device = getDeviceWithIdentifier(identifier);
    if (device === null) return;

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
    setLocalID              : setLocalID,
    addDevice               : addDevice,
    removeDevice            : removeDevice,
    getDeviceWithIdentifier : getDeviceWithIdentifier
  };
})();
