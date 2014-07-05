/* global Connichiwa, CWDeviceManager, CWDevice, CWDeviceDiscoveryState, CWDeviceConnectionState, CWEventManager, CWDebug */
"use strict";



/**
 * The Connichiwa Communication Protocol Parser (Native Layer).  
 * Here the protocol used to communicate between this library and the native layer is parsed. This communication is done via JSON.
 *
 * **Local ID Information** -- type="localidentifier"  
 * Contains information about the local device. Format:
 * * identifier -- a string identifying the unique ID of the device the weblib runs on
 *
 * **Device Detected** -- type="devicedetected"
 * Contains information about a newly detected device. Format:   
 * * identifier -- the identifier of the newly detected device
 *
 * **Device Proximity Changed** -- type="devicedistancechanged"  
 * Contains information about the new proximity of a previously detected device. Format:  
 * * identifier -- the identifier of the device whose distance changed
 * * distance -- the new distance between this device and the other device, in meters
 *
 * **Device Lost** -- type="devicelost"  
 * Contains information about a device that went out of range or can not be detected anymore for other reasons. Format:  
 * * identifier -- the identifier of the lost device
 *
 * @namespace CWNativeCommunicationParser
 */
var CWNativeCommunicationParser = (function()
{
  /**
   * Parses a message from the websocket. If the message is none of the messages described by this class, this method will do nothing. Otherwise the message will trigger an appropiate action.
   *
   * @param {string} message The message from the websocket
   *
   * @memberof CWNativeCommunicationParser
   */
  var parse = function(message)
  {
    CWDebug.log(4, "Parsing native message: " + message);
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "connectwebsocket": _parseConnectWebsocket(object); break;
      case "cwdebug": _parseDebug(object); break;
      case "localidentifier": _parseLocalIdentifier(object); break;
      case "devicedetected": _parseDeviceDetected(object); break;
      case "devicedistancechanged": _parseDeviceDistanceChanged(object); break;
      case "devicelost": _parseDeviceLost(object); break;
      case "remoteconnectfailed": _parseRemoteConnectFailed(object); break;
      case "remotedisconnected": _parseRemoteDisconnected(object); break;
      case "disconnectwebsocket": _parseDisconnectWebsocket(object); break;
    }
  };
  
  
  var _parseConnectWebsocket = function(message)
  {
    Connichiwa._connectWebsocket();
  };
  
  
  var _parseDebug = function(message)
  {
    if (message.cwdebug) CWDebug.enableDebug();
  };
  
  
  var _parseLocalIdentifier = function(message)
  {
    var success = Connichiwa._setIdentifier(message.identifier);
    if (success)
    {
      Connichiwa._send(JSON.stringify(message)); //needed so server recognizes us as local weblib
      CWEventManager.trigger("ready");
    }
  };
  
  
  var _parseDeviceDetected = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    
    //We might re-detect a lost device, so it is possible that the device is already stored
    if (device === null)
    {
      device = new CWDevice(message);
      CWDeviceManager.addDevice(device);
    }

    device.discoveryState = CWDeviceDiscoveryState.DISCOVERED;

    CWDebug.log(2, "Detected device: " + device.getIdentifier());
    CWEventManager.trigger("deviceDetected", device);
  };
  
  
  var _parseDeviceDistanceChanged = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    if (device === null) return;
    
    device.distance = message.distance;
    CWDebug.log(5, "Updated distance of device " + device.getIdentifier() + " to " + device.distance);
    CWEventManager.trigger("deviceDistanceChanged", device);
  };
  
  
  var _parseDeviceLost = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    device.discoveryState = CWDeviceDiscoveryState.LOST;

    CWDebug.log(2, "Lost device: " + device.getIdentifier());
    CWEventManager.trigger("deviceLost", device);
  };
  
  
  var _parseRemoteConnectFailed = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    device.connectionState = CWDeviceConnectionState.DISCONNECTED;

    CWDebug.log(2, "Connection to remote device failed: " + device.getIdentifier());
    CWEventManager.trigger("connectFailed", device);
  };
  
  
  var _parseRemoteDisconnected = function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    if (device === null) return;
      
    device.connectionState = CWDeviceConnectionState.DISCONNECTED;

    CWDebug.log(2, "Device disconnected: " + device.getIdentifier());
    CWEventManager.trigger("deviceDisconnected", device);
  };
  
  
  var _parseDisconnectWebsocket = function(message)
  {
    Connichiwa._disconnectWebsocket();  
  };

  return {
    parse : parse
  };
})();
