/* global Connichiwa, CWSystemInfo, CWUtil, CWEventManager, CWDebug */
/* global nativeCallConnectRemote */
"use strict";



var CWDeviceDiscoveryState = 
{
  DISCOVERED : "discovered",
  LOST       : "lost"
};

var CWDeviceConnectionState =
{
  DISCONNECTED : "disconnected",
  CONNECTING   : "connecting",
  CONNECTED    : "connected"
};



/**
 * An instance of this class describes a remote device that was detected nearby. It furthermore keeps information like the distance of the device and other connection-related information.
 *
 * @namespace CWDevice
 */
function CWDevice(properties)
{
  if (!properties.identifier) throw "Cannot instantiate CWDevice without an identifier";

  this.discoveryState = CWDeviceDiscoveryState.LOST;
  this.connectionState = CWDeviceConnectionState.DISCONNECTED;
  this.distance = -1;
  var _identifier = properties.identifier;
  var _launchDate = Date.now() / 1000.0;
  var _ips = [];
  var _port = undefined;
  var _name = "remote device";
  var _ppi = CWSystemInfo.DEFAULT_PPI();

  if (properties.launchDate) _launchDate = properties.launchDate;
  if (properties.ips) _ips = properties.ips;
  if (properties.port) _port = properties.port;
  if (properties.name) _name = properties.name;
  if (properties.ppi && properties.ppi > 0) _ppi = properties.ppi;
  
  /**
   * Returns the identifier of this device
   *
   * @returns {string} The identifier of this device
   *
   * @method getIdentifier
   * @memberof CWDevice
   */
  this.getIdentifier = function() { return _identifier; };

  this.getLaunchDate = function() { return _launchDate; };

  this.getIPs = function() { return _ips; };

  this.getPort = function() { return _port; };

  this.getName = function() { return _name; };

  this.getPPI = function() { return _ppi; };

  this.isLocal = function() {
    return this.equalTo(Connichiwa.getLocalDevice());
  };
  
  this.isNearby = function()
  {
    return (this.discoveryState === CWDeviceDiscoveryState.DISCOVERED);
  };
  
  this.canBeConnected = function() 
  { 
    return (this.connectionState === CWDeviceConnectionState.DISCONNECTED && 
      this.discoveryState === CWDeviceDiscoveryState.DISCOVERED);
  };
  
  this.isConnected = function()
  {
    return (this.connectionState === CWDeviceConnectionState.CONNECTED);
  };

  return this;
}


// DEVICE COMMUNICATION API


CWDevice.prototype.insert = function(target, html) {
  Connichiwa.insert(this.getIdentifier(), target, html);
};


CWDevice.prototype.replace = function(target, html) {
  Connichiwa.replace(this.getIdentifier(), target, html);
};


CWDevice.prototype.replaceContent = function(target, html) {
  Connichiwa.replaceContent(this.getIdentifier(), target, html);
};


CWDevice.prototype.loadScript = function(url, callback) {
  Connichiwa.loadScript(this.getIdentifier(), url, callback);
};


CWDevice.prototype.loadCSS = function(url) {
  Connichiwa.loadCSS(this.getIdentifier(), url);
};


CWDevice.prototype.send = function(name, message)
{
  Connichiwa.send(this.getIdentifier(), name, message);
};


/**
 * Checks if the given object is equal to this device. Two devices are equal if they describe the same remote device (= their ID is the same). This does not do any pointer comparison.
 *
 * @param {object} object The object to compare this CWDevice to
 * @returns {bool} true if the given object is equal to this CWDevice, otherwise false
 */
CWDevice.prototype.equalTo = function(object)
{
  if (CWDevice.prototype.isPrototypeOf(object) === false) return false;
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
