/* global CWDevice, CWDeviceID, CWEventManager, CWDebug */
"use strict";



/**
 * Manages the local device and all remote devices detected and connected to
 *
 * @namespace CWDeviceManager
 */
var CWDeviceManager = (function()
{
  /**
   * The CWDeviceID of the local device (the device the webserver is running on)
   */
  var _localID;

  /**
   * An array of detected remote devices as CWDevice objects. All detected devices are in here, they are not necessarily connected to or used in any way by this device.
   */
  var _remoteDevices = [];


  /**
   * Sets the ID of the local device under which it is advertised to other devices
   *
   * @param {CWDeviceID} ID The local ID
   *
   * @memberof CWDeviceManager
   */
  var setLocalID = function(ID)
  {
    if (_localID !== undefined) throw "Local ID can only be set once";

    _localID = ID;
    CWDebug.log("Local ID set to " + _localID.toString());
    CWEventManager.trigger("localIDSet", _localID);
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
    if (_getDeviceWithID(newDevice.getID()) !== null) throw "Device with ID " + newDevice.getID() + " was added twice";

    _remoteDevices.push(newDevice);
    CWDebug.log("Detected new device: " + newDevice);
    CWEventManager.trigger("deviceDetected", newDevice);
  };


  /**
   * Updates the distance between the local and a remote device
   *
   * @param {CWDeviceID} ID The ID of the device that changed
   * @param {string} newProximity A string describing the new proximity
   *
   * @memberof CWDeviceManager
   */
  var updateDeviceProximity = function(ID, newProximity)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to update a device";

    var device = _getDeviceWithID(ID);
    if (device === null) throw "Tried to change proximity of an undetected device";

    device.updateProximity(newProximity);
    CWDebug.log("Distance of " + this + " changed to " + newProximity);
    CWEventManager.trigger("deviceProximityChanged", device);
  };


  /**
   * Removes a remote device from the manager
   *
   * @param {CWDeviceID} ID The ID of the device to remove
   *
   * @memberof CWDeviceManager
   */
  var removeDevice = function(ID)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to remove a device";

    var device = _getDeviceWithID(ID);
    if (device === null) throw "Tried to remove a device that doesn't exist";

    var index = _remoteDevices.indexOf(device);
    _remoteDevices.splice(index, 1);
    CWEventManager.trigger("deviceLost", device);
  };


  /**
   * Gets the CWDevice stored under the given ID or null if the device is not stored in this manager
   *
   * @param {CWDeviceID} ID The ID of the device to search for
   * @returns A CWDevice that belongs to the given ID or null if that device cannot be found
   *
   * @memberof CWDeviceManager
   */
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
