/* global OOP, CWPinchManager, CWDebug, CWDeviceManager, CWDeviceConnectionState, CWEventManager */
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
      case "remoteidentifier": this._parseRemoteIdentifier(message); break;
      case "pinchswipe": this._parsePinchSwipe(message); break;
    }
  },
  
  
  _parseRemoteIdentifier: function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    if (device === null) {
      device = new CWDevice(message); //TODO change message to something useful
      CWDeviceManager.addDevice(device);
      //TODO
      //a device connected not over BT but directly over the websocket
      //create a CWDevice and store it
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
});
