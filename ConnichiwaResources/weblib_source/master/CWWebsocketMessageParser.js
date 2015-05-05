/* global Connichiwa, CWEventManager, CWStitchManager, CWDeviceManager, CWDevice, CWDeviceConnectionState, CWDebug, CWModules */
/* global nativeCallRemoteDidConnect */
'use strict';



var CWWebsocketMessageParser = CWWebsocketMessageParser || {};

/**
 * (Available on master device only)
 *
 * Parses a message from the Websocket on the master device and calls the
 *    appropiate sub-parse message. Also see {@link
 *    CWWebsocketMessageParser.parse}
 * @param  {Object} message  The object that represents the JSON message that
 *    was received from the websocket
 * @function
 * @protected
 */
CWWebsocketMessageParser.parseOnMaster = function(message) {
  switch (message._name) {
    case 'remoteinfo'   :  this._parseRemoteInfo(message);  break;
    case '_stitchswipe' :  this._parseStitchSwipe(message); break;
    case '_quitstitch'  :  this._parseQuitStitch(message);  break;
  }

  return true;
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseRemoteInfo = function(message)
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
    CWDebug.log(1, 'TODO');
  }
  
  device._connectionState = CWDevice.ConnectionState.CONNECTED;
  nativeCallRemoteDidConnect(device.getIdentifier());

  //Make sure the remote uses the same logging settings as we do
  device.send('_debuginfo', CWDebug._getDebugInfo());
  
  // AutoLoad files from Connichiwa.autoLoad on the new remote device
  var didConnectCallback = function() { 
    CWEventManager.trigger('deviceConnected', device); 
  };
  var loadOtherFile = function(device, file) {
    //As of now, "other" files are only CSS
    var extension = file.split('.').pop().toLowerCase();
    if (extension === 'css') {
      device.loadCSS(file);
    } 
  };
  
  //We need to separate JS files from other filetypes in Connichiwa.autoLoad
  //The reason is that we want to attach a callback to the last JS file we
  //load, so we are informed when it was loaded. 
  var autoLoadJS    = [];
  var autoLoadOther = [];
  for (var i = 0; i < Connichiwa.autoLoad.length; i++) {
    var file = Connichiwa.autoLoad[i];
    var extension = file.split('.').pop().toLowerCase();

    if (extension === 'js') autoLoadJS.push(file);
    else autoLoadOther.push(file);
  }

  //First, let's load all non-JS files
  for (var i = 0; i < autoLoadOther.length; i++) {
    var file = autoLoadOther[i];
    loadOtherFile(device, file);
  }

  //Now load all JS files and attach the callback to the last one
  //If no JS files are auto-loaded, execute the callback immediately
  if (autoLoadJS.length > 0) {
    for (var i = 0; i < autoLoadJS.length; i++) {
      var script = autoLoadJS[i];
      if (i === (autoLoadJS.length - 1)) {
        device.loadScript(script, didConnectCallback);
      } else {
        device.loadScript(script);
      }
    }
  } else {
    didConnectCallback();
  }
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseStitchSwipe = function(message) {
  CWStitchManager.detectedSwipe(message);
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseQuitStitch = function(message) {
  CWStitchManager.unstitchDevice(message.device);
}.bind(CWWebsocketMessageParser);

CWModules.add('CWWebsocketMessageParser');
