/* global Connichiwa, CWDatastore, CWEventManager, CWStitchManager, CWDeviceManager, CWDevice, CWDeviceConnectionState, CWDebug, CWModules */
/* global nativeCallRemoteDidConnect */
'use strict';



var CWWebsocketMessageParser = CWModules.retrieve('CWWebsocketMessageParser');

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
  //TODO
  //just because we are currently moving from javascriptcore to websockets
  // CWNativeBridge.parse(message);

  var promise;
  switch (message._name) {
    case 'remoteinfo'   :  promise = this._parseRemoteInfo(message);  break;
    case '_stitchswipe' :  promise = this._parseStitchSwipe(message); break;
    case '_quitstitch'  :  promise = this._parseQuitStitch(message);  break;
  }

  return promise;
};


CWWebsocketMessageParser._parseRemoteInfo = function(message) {
  var deferred = new $.Deferred();

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
  CWNativeBridge.callOnNative('nativeCallRemoteDidConnect', device.getIdentifier());
  // nativeCallRemoteDidConnect(device.getIdentifier());
  
  //We want to do 3 things before we trigger the 'deviceConnected' event:
  //* Load the debug info on the other device
  //* Sync the CWDatastore to the other device
  //* Load all files in Connichiwa.autoLoad on the other device
  var didLoadDebug = false;
  var didLoadData  = false;
  var didLoadFiles = false;

  //LOAD DEBUG INFO
  device.send('_debuginfo', CWDebug._getDebugInfo(), function() {
    didLoadDebug = true;
    tryDidConnectCallback();
  });

  var tryDidConnectCallback = function() { 
    if (didLoadDebug === false || didLoadData === false || didLoadFiles === false) return;
    CWEventManager.trigger('deviceConnected', device); 
    deferred.resolve();
  };

  //LOAD DATA
  CWDebug.log(3, 'Syncing entire datastore to connected device');
  CWDatastore._syncStoreToDevice(device.getIdentifier(), function() {
    didLoadData = true;
    tryDidConnectCallback();
  });

  //LOAD AUTOLOAD FILES
  var loadOtherFile = function(device, file) {
    //As of now, "other" files are only CSS
    var extension = file.split('.').pop().toLowerCase();
    if (extension === 'css') {
      device.loadCSS(file);
    } 
  };
  var didLoadFilesCB = function() {
    didLoadFiles = true;
    tryDidConnectCallback();
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
        device.loadScript(script, didLoadFilesCB);
      } else {
        device.loadScript(script);
      }
    }
  } else {
    didLoadFilesCB();
  }

  return deferred;
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseStitchSwipe = function(message) {
  CWStitchManager.detectedSwipe(message);
  return new $.Deferred().resolve();
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseQuitStitch = function(message) {
  CWStitchManager.unstitchDevice(message.device);
  return new $.Deferred().resolve();
}.bind(CWWebsocketMessageParser);

CWModules.add('CWWebsocketMessageParser');
