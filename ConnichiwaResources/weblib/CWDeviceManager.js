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
   * An array of detected remote devices as CWDevice objects. All detected devices are in here, they are not necessarily connected to or used in any way by this device.
   */
  var _remoteDevices = [];

  /**
   * Adds a new remote device to the manager
   *
   * @param {CWDevice} newDevice The device that should be added to the manager. If the device already exists, nothing will happen.
   * @returns {bool} true if the device was added, otherwise false
   *
   * @memberof CWDeviceManager
   */
  var addDevice = function(newDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw "Cannot add a non-device";
    if (getDeviceWithIdentifier(newDevice.getIdentifier()) !== null) return false;

    CWDebug.log(3, "Added device: " + newDevice.getIdentifier());
    _remoteDevices.push(newDevice);
    return true;
  };


  /**
   * Removes a remote device from the manager
   *
   * @param {string|CWDevice} identifier The identifier of the device to remove or a CWDevice. If the device is not stored by this manager, nothing will happen
  *  @returns {bool} true if the device was removed, otherwise false
   *
   * @memberof CWDeviceManager
   */
  var removeDevice = function(identifier)
  {
    if (CWDevice.prototype.isPrototypeOf(identifier) === true) identifier = identifier.getIdentifier();
      
    var device = getDeviceWithIdentifier(identifier);
    if (device === null) return false;

    CWDebug.log("Removed device: " + identifier);
    var index = _remoteDevices.indexOf(device);
    _remoteDevices.splice(index, 1);
    
    return true;
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
    addDevice               : addDevice,
    removeDevice            : removeDevice,
    getDeviceWithIdentifier : getDeviceWithIdentifier
  };
})();
