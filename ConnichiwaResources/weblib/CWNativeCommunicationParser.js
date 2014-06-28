/* global CWDeviceManager, CWDeviceID, CWDevice, CWDeviceState, CWEventManager */
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
    var object = JSON.parse(message);
    switch (object.type)
    {
    case "cwdebug":
      if (object.cwdebug) CWDebug.enableDebug();
      break;

    case "localidentifier":
      var success = CWDeviceManager.setLocalID(object.identifier);

      if (success) CWEventManager.trigger("ready");
      break;
    case "devicedetected":
      var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
      
      if (device === null)
      {
        device = new CWDevice(object.identifier);
        CWDeviceManager.addDevice(device);
      }
      else
      {
        if (device.state !== CWDeviceState.CONNECTED && device.state !== CWDeviceState.CONNECTING)
        {
          device.state = CWDeviceState.DISCOVERED;
        }
      }

      CWEventManager.trigger("deviceDetected", device);
      break;
    case "devicedistancechanged":
      var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
      if (device === null) return;
      
      device.updateDistance(object.distance);
CWEventManager.trigger("deviceDistanceChanged", device);
      break;
    case "devicelost":
      var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
      if (device.state != CWDeviceState.CONNECTED && device.state != CWDeviceState.CONNECTING)
      {
        device.state = CWDeviceState.LOST;
      }
      CWEventManager.trigger("deviceLost", device);
      break;
    case "remoteconnectfailed":
      var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
      device.state = CWDeviceState.CONNECTING_FAILED;
      CWEventManager.trigger("connectFailed", device);
      break;
    }
  };

  return {
    parse : parse
  };
})();
