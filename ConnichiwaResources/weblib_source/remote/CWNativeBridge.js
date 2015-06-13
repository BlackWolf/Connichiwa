/* global Connichiwa, CWDeviceManager, CWEventManager, CWDevice, CWDebug, CWModules */
'use strict';



var CWNativeBridge = CWModules.retrieve('CWNativeBridge');


/**
 * @override
 * @ignore
 */
CWNativeBridge.parse = function(message) {
  CWDebug.log(4, 'Parsing native message (remote): ' + message);
  var object = JSON.parse(message);
  switch (object._name)
  {
    case 'runsnative':          this._parseRunsNative(object); break;
    case 'cwdebug':             this._parseDebug(object); break;
    case 'localinfo':           this._parseLocalInfo(object); break;
    case 'disconnectwebsocket': this._parseDisconnectWebsocket(object); break;
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
  CWEventManager.trigger('ready'); 
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
