/* global Device */
"use strict";

function DeviceManager()
{
	this.localDevice = undefined;
	this.remoteDevices = [];

	return this;
}


DeviceManager.prototype.addDevice = function(newDevice)
{
	//Check if the device already exists
	var existingDevice = this.getDevice(newDevice.id);
	if (existingDevice !== null) return existingDevice;

	if (newDevice.isRemote !== true)
	{
		this.setLocalDevice(newDevice);
	}
	else
	{
		Debug.log("New remote device "+newDevice.toString()+" at distance "+newDevice.proximity);
		this.remoteDevices.push(newDevice);
	}

	return true;
};


DeviceManager.prototype.setLocalDevice = function(localDevice)
{
	if (localDevice === undefined) throw "Local device cannot be set to undefined";
	if (this.localDevice !== undefined) throw "Local device cannot be set twice";
	if (localDevice.isRemote !== false) throw "Local device must be local";

	Debug.log("Adding local device info: "+localDevice.toString());

	this.localDevice = localDevice;
};


DeviceManager.prototype.initLocalDeviceWithData = function(localData)
{
	var localDevice = Device.fromData(localData);
	localDevice.isRemote = false;
	this.setLocalDevice(localDevice);
};


DeviceManager.prototype.addOrUpdateDevice = function(deviceData)
{
	var newDevice = Device.fromData(deviceData);
	var addResult = this.addDevice(newDevice);

	if (addResult !== true)
	{
		//The beacon data was an update to an existing device
		//addDevice() gives the existing device back to us
		var existingDevice = addResult;
		var oldProximity = existingDevice.proximity;
		existingDevice.updateData(deviceData);

		if (oldProximity !== existingDevice.proximity) {
			Debug.log("Distance of "+existingDevice+" changed to "+existingDevice.proximity);
		}
	}
};


DeviceManager.prototype.getDevice = function(id)
{
	if (id === undefined) return null;

	for (var i=0; i<this.remoteDevices.length; i++)
	{
		var remoteDevice = this.remoteDevices[i];
		if (remoteDevice.id.equalTo(id))
		{
			return remoteDevice;
		}
	}

	return null;
};
