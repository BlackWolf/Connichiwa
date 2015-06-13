/* global CWDevice, CWDebug, CWModules */
'use strict';



/**
 * (Available on master device only)
 * 
 * This manager keeps track of all devices in the Connichiwa infrastructure.
 *    Devices can be added, removed and requested. Further, this manager keeps
 *    track of the local device of the master.
 * @namespace CWDeviceManager
 */
var CWDeviceManager = CWModules.retrieve('CWDeviceManager');


/**
 * (Available on master device only)
 * 
 * The CWDevice instance that represents the local (master) device, or
 *    undefined if it has not yet been created
 * @type {CWDevice}
 * @private
 */
CWDeviceManager._localDevice = undefined;


/**
 * (Available on master device only)
 * 
 * An array of remote CWDevice objects that represent the currently connected
 *    devices
 * @type {Array}
 * @default [ ]
 * @private
 */
CWDeviceManager._remoteDevices = [];


/**
 * (Available on master device only)
 * 
 * Adds a device to the manager. Everytime a new device is detected or
 *    connects, this method should be called
 * @param {CWDevice} newDevice The newly detected or conected device
 * @return {Boolean} true if the device was added, false otherwise
 * @function
 * @protected
 */
CWDeviceManager.addDevice = function(newDevice) {
  if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw 'Cannot add a non-device';
  if (this.getDeviceWithIdentifier(newDevice.getIdentifier()) !== null) return false;

  CWDebug.log(3, 'Added device: ' + newDevice.getIdentifier());

  this._remoteDevices.push(newDevice);
  return true;
};


/**
 * (Available on master device only)
 * 
 * Removes the given device from the manager. Everytime a device is lost or
 *    disconnects, this method should be called
 * @param  {CWDevice|String} identifier The CWDevice to remove or the device's
 *    identifier
 * @return {Boolean} true if the device was removed, false otherwise
 * @function
 * @protected
 */
CWDeviceManager.removeDevice = function(identifier) {
  if (CWDevice.prototype.isPrototypeOf(identifier) === true) identifier = identifier.getIdentifier();
    
  var device = this.getDeviceWithIdentifier(identifier);
  if (device === null) return false;

  CWDebug.log('Removed device: ' + identifier);

  var index = this._remoteDevices.indexOf(device);
  this._remoteDevices.splice(index, 1);
  
  return true;
};


/**
 * (Available on master device only)
 * 
 * Returns the CWDevice object for a given identifier
 * @param  {String} identifier The identifier of a device
 * @return {?CWDevice} The CWDevice that has the given identifier, or null if
 *    no device matches
 * @function
 */
CWDeviceManager.getDeviceWithIdentifier = function(identifier) {
  if (this._localDevice !== undefined && 
    (identifier === this._localDevice.getIdentifier() || identifier === 'master')) {
    return this._localDevice;
  }
  
  for (var i = 0; i < this._remoteDevices.length; i++)
  {
    var remoteDevice = this._remoteDevices[i];
    if (remoteDevice.getIdentifier() === identifier)
    {
      return remoteDevice;
    }
  }

  return null;
};


/**
 * (Available on master device only)
 *
 * Returns an array of all devices that are connected over HTTP and Websocket 
 * @return {CWDevice} An array of all devices that are currently connected to
 *    the master
 * @function
 */
CWDeviceManager.getConnectedDevices = function() {
  var connectedDevices = [];
  for (var i = 0; i < this._remoteDevices.length; i++)
  {
    var remoteDevice = this._remoteDevices[i];
    if (remoteDevice.isConnected()) connectedDevices.push(remoteDevice);
  }

  return connectedDevices;
};


/**
 * (Available on master device only)
 *
 * Creates the local device of the master. Only one such device can be
 *    created. If a local device already exists, this method will do nothing
 * @param  {Object} properties The local device's properties
 * @return {Bolean} true if the local device was created, otherwise false  
 * @function
 * @protected          
 */
CWDeviceManager.createLocalDevice = function(properties) {
  if (this._localDevice !== undefined) return false;

  properties.isLocal = true;

  this._localDevice = new CWDevice(properties);
  this._localDevice._discoveryState = CWDevice.DiscoveryState.LOST;
  this._localDevice._connectionState = CWDevice.ConnectionState.CONNECTED;

  CWDebug.log(3, 'Created local device: ' + JSON.stringify(properties));

  return true;
};


/**
 * Returns the local device or undefined if it has not yet been created
 * @function
 */
CWDeviceManager.getLocalDevice = function() {
  return this._localDevice;
};
