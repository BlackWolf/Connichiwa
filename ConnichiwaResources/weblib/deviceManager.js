/* global RemoteDevice */
"use strict";

function DeviceManager()
{
	this.remoteDevices = [];

	return this;
}

DeviceManager.prototype.addDevice = function(newDevice)
{
	this.remoteDevices.push(newDevice);
};

DeviceManager.prototype.updateBeacon = function(beaconData)
{
	var newDevice = new RemoteDevice(beaconData);
	var existingDevice = this.getDevice(newDevice);

	if (existingDevice === null)
	{
		//The beacon we received is a newly discovered device
		this.addDevice(newDevice);
	}
	else
	{
		//The beacon received was an update to an existing device
		existingDevice.updateData(beaconData);
	}
};

DeviceManager.prototype.getDevice = function(beacon)
{
	if (beacon === undefined) return null;

	for (var i=0; i<this.remoteDevices.length; i++)
	{
		var remoteDevice = this.remoteDevices[i];
		if (remoteDevice.equalTo(beacon))
		{
			return remoteDevice;
		}
	}

	return null;
};
