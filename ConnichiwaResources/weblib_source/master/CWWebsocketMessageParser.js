/* global OOP, Connichiwa, CWEventManager, CWDeviceManager, CWDevice, CWDeviceConnectionState, CWDebug */
/* global nativeCallRemoteDidConnect */
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
      CWDebug.log(1, "TODO");
    }
    
    device.connectionState = CWDeviceConnectionState.CONNECTED;
    nativeCallRemoteDidConnect(device.getIdentifier());
    
    var connectedCallback = function() { 
      CWEventManager.trigger("deviceConnected", device); 
    };
    
    if (Connichiwa.autoLoadScripts.length > 0) {
      for (var i = 0; i < Connichiwa.autoLoadScripts.length ; i++) {
        var script = Connichiwa.autoLoadScripts[i];
        if (i === (Connichiwa.autoLoadScripts.length - 1)) {
          device.loadScript(script, connectedCallback);
        } else {
          device.loadScript(script);
        }
      }
    } else {
      connectedCallback();
    }
  },


  _parseStitchSwipe: function(message) {
    this.package.CWStitchManager.detectedSwipe(message);
  },


  _parseQuitStitch: function(message) {
    this.package.CWStitchManager.unstitchDevice(message.device);
  },
});
