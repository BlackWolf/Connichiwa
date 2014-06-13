/* global CWDevice, CWDeviceID, CWEventManager */
"use strict";



var CWDeviceManager = (function()
{
  var _localDevice;
  var _remoteDevices = [];


  var addDevice = function(newDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw "Cannot add a non-device";

    //Check if the device already exists
    var existingDevice = getDevice(newDevice.getID());
    if (existingDevice !== null) return existingDevice;

    if (newDevice.isRemote() !== true)
    {
      setLocalDevice(newDevice);
    }
    else
    {
      CWDebug.log("New remote device " + newDevice.toString() + " at distance " + newDevice.getProximity());
      _remoteDevices.push(newDevice);
      CWEventManager.trigger("deviceChange", newDevice);
    }

    return true;
  };

  var setLocalDevice = function(localDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(localDevice) === false) throw "Local device must be a device";
    if (_localDevice !== undefined) throw "Local device cannot be set twice";
    if (localDevice.isRemote() !== false) throw "Local device must be local";

    CWDebug.log("Adding local device info: " + localDevice.toString());

    _localDevice = localDevice;
    CWEventManager.trigger("localDeviceSet", _localDevice);
  };


  var setLocalDeviceWithData = function(localDeviceData)
  {
    if (CWUtil.isObject(localDeviceData) === false) localDeviceData = {};

    localDeviceData.isRemote = false;
    var localDevice = CWDevice.fromData(localDeviceData);

    setLocalDevice(localDevice);
  };


  var addOrUpdateDevice = function(deviceData)
  {
    var newDevice = CWDevice.fromData(deviceData);
    var addResult = addDevice(newDevice);

    if (addResult !== true)
    {
      //The beacon data was an update to an existing device
      //addDevice() gives the existing device back to us
      var existingDevice = addResult;
      existingDevice.updateData(deviceData);
    }
  };


  var getDevice = function(id)
  {
    if (CWDeviceID.prototype.isPrototypeOf(id) === false) throw "A DeviceID is needed to search for an existing device";

    for (var i = 0; i < _remoteDevices.length; i++)
    {
      var remoteDevice = _remoteDevices[i];
      if (remoteDevice.getID().equalTo(id))
      {
        return remoteDevice;
      }
    }

    return null;
  };

  return {
    addDevice              : addDevice,
    setLocalDevice         : setLocalDevice,
    setLocalDeviceWithData : setLocalDeviceWithData,
    addOrUpdateDevice      : addOrUpdateDevice,
    getDevice              : getDevice
  };
})();
