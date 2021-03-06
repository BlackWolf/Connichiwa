/* global Connichiwa, CWDeviceManager, CWEventManager, CWDevice, CWDebug, CWModules */
'use strict';



var CWNativeBridge = CWModules.retrieve('CWNativeBridge');


/**
 * @override
 * @ignore
 */
CWNativeBridge.parse = function(message) {
  var object;
  if (CWUtil.isString(message)) {
    CWDebug.log(4, 'Parsing native message (master): ' + message);
    object = JSON.parse(message);
  } else {
    object = message;
  }

  CWDebug.log(1, "NATIVE PARSE "+object._name);

  switch (object._name)
  {
    case 'runsnative':            this._parseRunsNative(object); break;
    case 'cwdebug':               this._parseDebug(object); break;
    case 'localinfo':             this._parseLocalInfo(object); break;
    case 'disconnectwebsocket':   this._parseDisconnectWebsocket(object); break;
    case 'proximitystatechanged': this._parseProximityStateChanged(object); break;
  }
};


/**
 * (Available on remote devices only)
 *
 * Parses `localinfo` messages. This message contains information about this
 *    device that will be set as the local device information
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires ready
 * @private
 */
CWNativeBridge._parseLocalInfo = function(message)  {
  Connichiwa._setLocalDevice(message);
  CWEventManager.trigger('localDeviceChanged', Connichiwa.getLocalDevice());
  // CWEventManager.trigger('ready'); 
};



/**
 * (Available on remote devices only)
 *
 * Parses `disconnectwebsocket` messages. This message tells the library that
 *    we need to disconnect the websocket. This can happen, for example, when
 *    the device stops being a remote or an error occured.
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @private
 */
CWNativeBridge._parseDisconnectWebsocket = function(message) {
  Connichiwa._disconnectWebsocket();  
};


CWNativeBridge._parseProximityStateChanged = function(message) {
  //
  //TODO: Code duplicated from master, booo
  //
  CWDebug.log(5, 'Proximity State Changed: ' + message.proximityState);
  CWEventManager.trigger('proximityStateChanged', message.proximityState);
};
