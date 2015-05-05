/* global CWDeviceManager, CWNativeBridge, CWWebsocketMessageParser, CWEventManager, CWDebug, CWModules */
/* global nativeCallWebsocketDidOpen */
/* global CONNECTING, OPEN */
'use strict';


var Connichiwa = Connichiwa || {};


/**
 * (Available on master device only)
 * 
 * When the websocket connection fails, this stores the number of retry
 *    attempts
 * @type {Number}
 * @private
 */
Connichiwa._connectionAttempts = 0;


/**
 * (Available on master device only)
 * 
 * Set to true to automatically connect nearby devices. If multiple devices
 *    with autoConnect enabled meet each other, the one that where the
 *    application was launched earlier will become the master device
 * @type {Boolean}
 * @default false
 */
Connichiwa.autoConnect = false;


/**
 * (Available on master device only)
 *
 * An array of URLs to JavaScript or CSS scripts that will be automatically
 *    loaded on any device that is connected from now on. Further, on all
 *    connected devices, the callbacks passed to {@link Connichiwa.onLoad}
 *    will only be invoked after all the scripts in this array have been
 *    loaded
 * @type {Array}
 * @default [ ]
 */
Connichiwa.autoLoad = [];


// PUBLIC API


/**
 * @override
 * @ignore
 */
Connichiwa.getLocalDevice = function() {
  return CWDeviceManager.getLocalDevice();
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa.getIdentifier = function() 
{
  var localDevice = CWDeviceManager.getLocalDevice();
  if (localDevice === undefined) return undefined;

  return localDevice.getIdentifier();
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa.isMaster = function() {
  return true;
}.bind(Connichiwa);


/**
 * (Available on master device only)
 *
 * Returns an array of IPs over which the HTTP and websocket server running on
 *    this device can be reached
 * @return {Array} An array of IPs as strings
 * @function
 * @protected
 */
Connichiwa.getIPs = function() {
  var localDevice = CWDeviceManager.getLocalDevice();
  if (localDevice === undefined) return undefined;

  return localDevice.getIPs();
}.bind(Connichiwa);


/**
 * (Available on master device only)
 *
 * Returns the port where the HTTP server on this device runs on. The
 *    websocket server runs on this port +1
 * @return {Number} The port of the HTTP server on this device
 * @function
 * @protected
 */
Connichiwa.getPort = function() {
  var localDevice = CWDeviceManager.getLocalDevice();
  if (localDevice === undefined) return undefined;

  return localDevice.getPort();
}.bind(Connichiwa);


// WEBSOCKET


/**
 * @override
 * @ignore
 */
Connichiwa._connectWebsocket = function() {
  if (this._websocket !== undefined && (this._websocket.state === CONNECTING || this._websocket.state === OPEN)) {
    return;
  }

  this._cleanupWebsocket();

  CWDebug.log(3, 'Connecting websocket');

  this._websocket           = new WebSocket('ws://127.0.0.1:8001');
  this._websocket.onopen    = this._onWebsocketOpen;
  this._websocket.onmessage = this._onWebsocketMessage;
  this._websocket.onclose   = this._onWebsocketClose;
  this._websocket.onerror   = this._onWebsocketError;

  this._connectionAttempts++;
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketOpen = function() {
  CWDebug.log(3, 'Websocket opened');
  CWNativeBridge.callOnNative('nativeCallWebsocketDidOpen');
  this._connectionAttempts = 0;
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketMessage = function(e) {
  var message = JSON.parse(e.data);

  //Filter messages that were broadcasted by us and do not have the
  //'_broadcastToSource' flag set
  if (message._target === 'broadcast' && 
    message._source === this.getLocalDevice().getIdentifier() && 
    message._broadcastToSource !== true) {
    return;
  }

  CWDebug.log(4, 'Received message: ' + e.data);
  
  //It seems that reacting immediatly to a websocket message
  //sometimes causes crashes in UIWebView. I am unsure why.
  //We use requestAnimationFrame in an attempt to prevent those crashes
  var that = this;
  window.requestAnimationFrame(function() {
    CWWebsocketMessageParser.parse(message);
    CWWebsocketMessageParser.parseOnMaster(message);

    if (message._name) CWEventManager.trigger('message' + message._name, message);
  });
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketClose = function(e) {
  CWDebug.log(3, 'Websocket closed');
  CWDebug.log(3, e.code);
  CWDebug.log(3, e.reason);
  this._cleanupWebsocket();

  if (this._connectionAttempts >= 5)
  {
    //Give up, guess we are fucked
    CWNativeBridge.callOnNative('nativeCallWebsocketDidClose');
    return;
  }

  //We can't allow this blashphemy! Try to reconnect!
  // setTimeout(function() { this._connectWebsocket(); }.bind(this), this._connectionAttempts * 1000);
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketError = function() {
  this._onWebsocketClose();
}.bind(Connichiwa);

CWModules.add('Connichiwa');
