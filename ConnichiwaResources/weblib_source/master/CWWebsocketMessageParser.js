/* global OOP, CWEventManager, CWDeviceManager, CWDevice, CWDeviceConnectionState */
"use strict";


OOP.extendSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parseOnMaster": function(message) {
    switch (message.type) {
      case "remoteinfo"  :  this._parseRemoteInfo(message);  break;
      case "stitchswipe" :  this._parseStitchSwipe(message); break;
      case "quitstitch"  :  this._parseQuitStitch(message);  break;
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


  _parseStitchSwipe: function(message) {
    this.package.CWStitchManager.detectedSwipe(message);
  },


  _parseQuitStitch: function(message) {
    this.package.CWStitchManager.unstitchDevice(message.device);
  },
});
