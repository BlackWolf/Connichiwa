/* global CWDeviceManager, CWNativeBridge, CWWebsocketMessageParser, CWEventManager, CWUtil, CWSystemInfo, CWDebug, CWModules */
/* global nativeCallWebsocketDidOpen */
/* global CONNECTING, OPEN */
'use strict';


var Connichiwa = CWModules.retrieve('Connichiwa');


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
};


/**
 * @override
 * @ignore
 */
Connichiwa.getIdentifier = function() 
{
  var localDevice = CWDeviceManager.getLocalDevice();
  if (localDevice === undefined) return undefined;

  return localDevice.getIdentifier();
};


/**
 * @override
 * @ignore
 */
Connichiwa.isMaster = function() {
  return true;
};


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
};


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
};


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
};


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketOpen = function() {
  CWDebug.log(3, 'Websocket opened');

  //Create our local info, such as our unique ID
  //This info might be extended by the native layer later
  var localInfo = {
    identifier : CWUtil.createUUID(),
    launchDate : Date.now() / 1000.0,
    ppi        : CWSystemInfo.PPI()
  };
  CWDeviceManager.createLocalDevice(localInfo);

  Connichiwa.send("server", "_master_identification", { identifier: localInfo.identifier });
  // Connichiwa.send("master", "localinfo", localInfo);

  this._connectionAttempts = 0;

  CWNativeBridge.callOnNative('nativeCallWebsocketDidOpen');

  CWEventManager.trigger('ready');
};


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketMessage = function(e) {
  var message = JSON.parse(e.data);

  CWDebug.log(4, 'Received message: ' + e.data);
  
  //It seems that reacting immediatly to a websocket message
  //sometimes causes crashes in UIWebView. I am unsure why.
  //We use requestAnimationFrame in an attempt to prevent those crashes
  var that = this;
  window.requestAnimationFrame(function() {
    var p1 = CWWebsocketMessageParser.parse(message);
    var p2 = CWWebsocketMessageParser.parseOnMaster(message);

    if (message._name) CWEventManager.trigger('message' + message._name, message);

    //The parse methods can return a jQuery promise:
    //If any of them do, we will send back an ack only once the promise resolves
    //If both of them return undefined we immediately send back an ack
    //If any of them explicitly returns false, we don't send back an ack
    //All other return values are not allowed
    if (p1 === false || p2 === false) return;
    
    //Prefer p2 over p1, if both are undefined we return an ack immediately by
    //creating a resolved promise
    var promise = p2;
    if (promise === undefined) promise = p1;
    if (promise === undefined) promise = new $.Deferred().resolve();

    $.when(promise).always(function() {
      Connichiwa._sendAck(message);
    });
  });
};


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
};


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketError = function() {
  this._onWebsocketClose();
};
