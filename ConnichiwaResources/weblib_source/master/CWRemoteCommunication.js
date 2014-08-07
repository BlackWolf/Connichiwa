/* global OOP, Connichiwa, CWPinchManager, CWDebug, CWDeviceManager, CWDeviceConnectionState, CWEventManager */
/* global nativeCallRemoteDidConnect */
"use strict";


/**
 * The Connichiwa Communication Protocol Parser (Remote Device).  
 * Here the protocol used to communicate between this library and a connected remote device is parsed. The communication is done via JSON.
 *
 * **Remote ID Information** -- type="remoteidentifier"  
 * Contains the identifier of a connected remote device. Format:
 * * identifier -- a string identifying the unique ID of the device the weblib runs on
 *
 * @namespace CWRemoteCommunicationParser
 */
var CWRemoteCommunication = OOP.createSingleton("Connichiwa", "CWRemoteCommunication", 
{
  /**
   * Parses a message from the websocket. If the message is none of the messages described by this class, this method will do nothing. Otherwise the message will trigger an appropiate action.
   *
   * @param {string} message The message from the websocket
   *
   * @memberof CWRemoteCommunicationParser
   */
  "public parse": function(message)
  {
    switch (message.type)
    {
      case "remoteinfo" : this._parseRemoteInfo(message); break;
      case "pinchswipe" : this._parsePinchSwipe(message); break;
      case "quitPinch"  : this._parseQuitPinch(message); break;
    }
  },
  
  
  _parseRemoteInfo: function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);

    //If we have a non-native remote no device might exist since
    //no info was sent via BT. If so, create one now.
    if (device === null) {
      device = new CWDevice(message); 
      CWDeviceManager.addDevice(device);
    } else {
      //TODO although unnecessary, for cleanness sake we should probably
      //overwrite any existing device data with the newly received data?
      //If a device exists, that data should be the same as the one we received
      //via BT anyways, so it shouldn't matter
    }
    
    
    device.connectionState = CWDeviceConnectionState.CONNECTED;
    nativeCallRemoteDidConnect(device.getIdentifier());
    
    //For some reason, it seems that triggering this messages sometimes causes the iOS WebThread to crash
    //I THINK this might be related to us sending a message to the remote device in the web app when this event is triggered
    //This does seem strange, though, considering we just received a message over the websocket (so it obviously is initialized and working)
    //As a temporary fix, I try to delay sending this event a little and see if it helps
    // setTimeout(function() { CWEventManager.trigger("deviceConnected", device); }, 1000);
    CWEventManager.trigger("deviceConnected", device);
  },

  _parsePinchSwipe: function(message) {
    this.package.CWPinchManager.detectedSwipe(message);
  },

  _parseQuitPinch: function(message) {
    this.package.CWPinchManager.unpinchDevice(message.device);
  },
});
