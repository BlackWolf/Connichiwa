/* global Connichiwa, CWDeviceManager, CWEventManager, CWDevice, CWDebug, CWModules */
'use strict';



var CWNativeBridge = CWNativeBridge || {};


/**
 * @override
 * @ignore
 */
CWNativeBridge.parse = function(message) {
  CWDebug.log(4, 'Parsing native message (master): ' + message);
  var object = JSON.parse(message);
  switch (object._name)
  {
    case 'debuginfo':             this._parseDebugInfo(object); break;
    case 'connectwebsocket':      this._parseConnectWebsocket(object); break;
    case 'localinfo':             this._parseLocalInfo(object); break;
    case 'devicedetected':        this._parseDeviceDetected(object); break;
    case 'devicedistancechanged': this._parseDeviceDistanceChanged(object); break;
    case 'devicelost':            this._parseDeviceLost(object); break;
    case 'remoteconnectfailed':   this._parseRemoteConnectFailed(object); break;
    case 'remotedisconnected':    this._parseRemoteDisconnected(object); break;
    case 'disconnectwebsocket':   this._parseDisconnectWebsocket(object); break;
  }
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `debuginfo` messages. Such information are used to apply the native
 *    layer's debug settings on the JS library
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @private
 */
CWNativeBridge._parseDebugInfo = function(message) {
  CWDebug._setDebugInfo(message);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `connectwebsocket` messages. Such messages are sent when the native
 *    layer is ready to receive websocket connections and we can connect to
 *    the websocket
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @private
 */
CWNativeBridge._parseConnectWebsocket = function(message) {
  Connichiwa._connectWebsocket();
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `localinfo` messages. Such messages contain the information about
 *    this device as determined by the native layer. The message will create
 *    the local device after which the JS library is considered "ready"
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires ready
 * @private
 */
CWNativeBridge._parseLocalInfo = function(message) {
  var success = CWDeviceManager.createLocalDevice(message);
  if (success)
  {
    Connichiwa._sendObject(message); //needed so server recognizes us as local weblib
    CWEventManager.trigger('ready');
  }
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `devicedetected` messages. Such a message is sent by the native
 *    layer if a Bluetooth-enabled Connichiwa device is nearby. This will
 *    create a new CWDevice and report the detection to the application
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires devicedetected
 * @private
 */
CWNativeBridge._parseDeviceDetected = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  
  //We might re-detect a lost device, so it is possible that the device is already stored
  if (device === null)
  {
    device = new CWDevice(message);
    CWDeviceManager.addDevice(device);
  }
  device._discoveryState = CWDevice.DiscoveryState.DISCOVERED;

  CWDebug.log(2, 'Detected device: ' + device.getIdentifier());
  CWEventManager.trigger('deviceDetected', device);

  //If autoconnect is enabled, the device that launched first will 
  //automatically connect to all other devices
  if (Connichiwa.autoConnect === true) {
    var localDevice = CWDeviceManager.getLocalDevice();
    if (localDevice.getLaunchDate() < device.getLaunchDate()) {
      device.connect();
    }
  } 
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `devicedistancechanged` messages. Such a message is sent by the
 *    native layer if the approximated distance between the master and a
 *    detected device changes
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires devicedistancechanged
 * @private
 */
CWNativeBridge._parseDeviceDistanceChanged = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  if (device === null) return;
  
  device.distance = message.distance;
  CWDebug.log(5, 'Updated distance of device ' + device.getIdentifier() + ' to ' + device.distance);
  CWEventManager.trigger('deviceDistanceChanged', device);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `devicelost` messages. Such a message is sent by the native layer if
 *    a previously detected device is lost (for example because it is switched
 *    off, closes the app or goes out of Bluetooth-range)
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires devicelost
 * @private
 */
CWNativeBridge._parseDeviceLost = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  device._discoveryState = CWDevice.DiscoveryState.LOST;

  CWDebug.log(2, 'Lost device: ' + device.getIdentifier());
  CWEventManager.trigger('deviceLost', device);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `remoteconnectfailed` messages. Such a message is sent by the native
 *    layer if the connection attempt to a detected but unconnected device
 *    failed. Such an attempt can fail, for example, if the two devices do not
 *    share a common network and are unable to connect over an ad hoc network
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires connectfailed
 * @private
 */
CWNativeBridge._parseRemoteConnectFailed = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  device._connectionState = CWDevice.ConnectionState.DISCONNECTED;

  CWDebug.log(2, 'Connection to remote device failed: ' + device.getIdentifier());
  CWEventManager.trigger('connectFailed', device);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `remotedisconnected` messages. Such a message is sent by the native
 *    layer if a previously connected remote device has disconnected. A
 *    disconnect can happen for example because the app was closed, the device
 *    was switched off, the device connected to another device but also
 *    because of network failures
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires devicedisconnected
 * @private
 */
CWNativeBridge._parseRemoteDisconnected = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  if (device === null) return;
    
  device._connectionState = CWDevice.ConnectionState.DISCONNECTED;

  CWDebug.log(2, 'Device disconnected: ' + device.getIdentifier());
  CWEventManager.trigger('deviceDisconnected', device);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `remotedisconnected` messages. Such a message is sent by the native
 *    layer whenever the websocket connection to the server should be
 *    disconnected. This can be the case, for example, when the app is
 *    suspended on the device and the server is suspended
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @private
 */
CWNativeBridge._parseDisconnectWebsocket = function(message) {
  Connichiwa._disconnectWebsocket();  
}.bind(CWNativeBridge);

CWModules.add('CWNativeBridge');
