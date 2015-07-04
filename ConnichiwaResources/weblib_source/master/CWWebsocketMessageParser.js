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

  var tryDidConnectCallback = function() {
    if (didLoadDebug === false || didLoadData === false || didLoadFiles === false) return;
    CWEventManager.trigger('deviceConnected', device);
    deferred.resolve();
  };

  //LOAD DEBUG INFO
  device.send('_debuginfo', CWDebug._getDebugInfo(), function() {
    didLoadDebug = true;
    tryDidConnectCallback();
  });

  //LOAD DATA
  CWDebug.log(3, 'Syncing entire datastore to connected device');
  CWDatastore._syncStoreToDevice(device.getIdentifier(), function() {
    didLoadData = true;
    tryDidConnectCallback();
  });

  //LOAD AUTOLOAD FILES
  var requestedFiles = 0;
  var resolvedFiles = 0;
  var doneRequesting = false;

  var fileWasResolved = function() {
    resolvedFiles++;

    if (doneRequesting && requestedFiles === resolvedFiles) {
      didLoadFiles = true;
      tryDidConnectCallback();
    }
  };

  for (var i = 0; i < Connichiwa.autoLoad.length; i++) {
    var file = Connichiwa.autoLoad[i];
    var extension = file.split('.').pop().toLowerCase();

    if (extension === "css") {
      device.loadCSS(file, fileWasResolved);
      requestedFiles++;
    }

    if (extension === "js") {
      device.loadScript(file, fileWasResolved);
      requestedFiles++;
    }
  }
  doneRequesting = true;

  return deferred;
};


CWWebsocketMessageParser._parseStitchSwipe = function(message) {
  CWStitchManager.detectedSwipe(message);
  return new $.Deferred().resolve();
};


CWWebsocketMessageParser._parseQuitStitch = function(message) {
  CWStitchManager.unstitchDevice(message.device);
  return new $.Deferred().resolve();
};
