/* global CWDeviceManager, CWDeviceID, CWDevice */
"use strict";



/**
 * The Connichiwa Communication Protocol Parser (Native Layer).  
 * Here the protocol used to communicate between this library and the native layer is parsed. This communication is done via JSON.
 *
 * **Local ID Information** -- type="localid"  
 * Contains information about the local device. Format:
 * * major -- the major number of this device
 * * minor -- the minor number of this device
 *
 * **Device Detected** -- type="devicedetected"
 * Contains information about a newly detected device. Format:   
 * * major -- The major part of the device ID
 * * minor -- The minor part of the device ID
 * * proximity -- a string describing the distance of this device to the detected device (either "far", "near" or "immediate")
 *
 * **Device Proximity Changed** -- type="deviceproximitychanged"  
 * Contains information about the new proximity of a previously detected device. Format:  
 * * major -- The major part of the device ID
 * * minor -- The minor part of the device ID
 * * proximity -- a string describing the distance of this device to the device (either "far", "near" or "immediate")
 *
 * **Device Lost** -- type="devicelost"  
 * Contains information about a device that went out of range or can not be detected anymore for other reasons. Format:  
 * * major -- The major part of the device ID
 * * minor -- The minor part of the device ID
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
    case "localidentifier":
      CWDeviceManager.setLocalID(object.identifier);
      break;
    case "devicedetected":
      var device = new CWDevice(object.identifier);
      CWDeviceManager.addDevice(device);
      break;
    case "devicedistancechanged":
      CWDeviceManager.updateDeviceDistance(object.identifier, object.distance);
      break;
    case "devicelost":
      CWDeviceManager.removeDevice(object.identifier);
      break;
    case "connectionRequestFailed":
      
    }
  };

  return {
    parse : parse
  };
})();
