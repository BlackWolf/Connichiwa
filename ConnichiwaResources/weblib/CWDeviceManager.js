/* global CWDevice, CWDeviceID, CWEventManager, CWDebug */
"use strict";



var CWDeviceManager = (function()
{
  var _localID;
  var _remoteDevices = [];


  var setLocalID = function(ID)
  {
    if (_localID !== undefined) throw "Local ID can only be set once";

    _localID = ID;
    CWDebug.log("Local ID set to " + _localID.toString());
    CWEventManager.trigger("localIDSet", _localID);
  };


  var addDevice = function(newDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw "Cannot add a non-device";
    if (_getDeviceWithID(newDevice.getID()) !== null) throw "Device with ID " + newDevice.getID() + " was added twice";

    _remoteDevices.push(newDevice);
    CWDebug.log("Detected new device: " + newDevice);
    CWEventManager.trigger("deviceDetected", newDevice);
  };


  var updateDeviceProximity = function(ID, newProximity)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to update a device";

    var device = _getDeviceWithID(ID);
    if (device === null) throw "Tried to change proximity of an undetected device";

    device.updateProximity(newProximity);
    CWDebug.log("Distance of " + this + " changed to " + newProximity);
    CWEventManager.trigger("deviceProximityChanged", device);
  };


  var removeDevice = function(ID)
  {
    if (CWDeviceID.prototype.isPrototypeOf(ID) === false) throw "A DeviceID is needed to remove a device";

    var device = _getDeviceWithID(ID);
    if (device === null) throw "Tried to remove a device that doesn't exist";

    var index = _remoteDevices.indexOf(device);
    _remoteDevices.splice(index, 1);
    CWEventManager.trigger("deviceLost", device);
  };


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
