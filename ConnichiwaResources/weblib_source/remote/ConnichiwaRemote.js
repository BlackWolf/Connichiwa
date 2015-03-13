/* global CWEventManager, CWWebsocketMessageParser, CWDevice, CWNativeBridge, CWSystemInfo, CWUtil, CWDebug */
'use strict';



var Connichiwa = Connichiwa || {};



/**
 * (Available on remote devices only)
 *
 * The {@link CWDevice} instance that represents this device
 * @type {CWDevice}
 * @private
 */
Connichiwa._localDevice = undefined;


Connichiwa._softDisconnected = false;


/**
 * (Available on remote devices only)
 *
 * Determines if the websocket connection is currently trying to reconnect
 * @type {Boolean}
 * @private
 */
Connichiwa._isReconnecting = false;


/**
 * @override
 * @ignore
 */
Connichiwa.getLocalDevice = function() {
  return this._localDevice;
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa.getIdentifier = function() {
  return this._localDevice.getIdentifier();
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa.isMaster = function() {
  return false;
}.bind(Connichiwa);


/**
 * (Available on remote devices only)
 *
 * Creates a new {@link CWDevice}, applies the given properties and sets that
 *    CWDevice as the instance representing this device. A locale device can
 *    only be set once. This method will also send the properties of the local
 *    device to the master using a `remoteinfo` message
 * @param {Object} properties The properties of the local device
 * @function
 * @private
 */
Connichiwa._setLocalDevice = function(properties) {
  if (this._localDevice === undefined) {
    properties.isLocal = true;
    this._localDevice = new CWDevice(properties);
  }

  //Let the master know about our new device information
  this.send("master", "remoteinfo", properties);
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._connectWebsocket = function() {
  CWDebug.log(3, "Connecting");
  //If we replace the websocket (or re-connect) we don't want to call onWebsocketClose
  //Therefore, first cleanup, then close
  var oldWebsocket = this._websocket;
  this._cleanupWebsocket();    
  if (oldWebsocket !== undefined) oldWebsocket.close();

  var parsedURL = new CWUtil.parseURL(document.URL);

  this._websocket           = new WebSocket("ws://" + parsedURL.hostname + ":" + (parseInt(parsedURL.port) + 1));
  this._websocket.onopen    = this._onWebsocketOpen;
  this._websocket.onmessage = this._onWebsocketMessage;
  this._websocket.onclose   = this._onWebsocketClose;
  this._websocket.onerror   = this._onWebsocketError;
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketOpen = function() {
  CWDebug.log(3, "Websocket opened");
  this._softDisconnected = false;

  var runsNative = CWNativeBridge.isRunningNative();

  CWNativeBridge.callOnNative("nativeWebsocketDidOpen");

  if (runsNative === false) {
    //If we have no native layer and are reconnecting we now need to refresh the
    //page to reset the remote's state
    if (this._isReconnecting === true) {
      location.reload(true);
      return;
    }

    //We have no native layer that delivers us accurate local device info
    //Therefore, we create as much info as we can ourselves
    var localInfo = {
      identifier : CWUtil.createUUID(),
      launchDate : Date.now() / 1000.0,
      ppi        : CWSystemInfo.PPI()
    };
    this._setLocalDevice(localInfo);
  }
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketMessage = function(e) {
  var message = JSON.parse(e.data);

  //Filter messages that were broadcasted by us and do not have the
  //"_broadcastToSource" flag set
  if (message._target === "broadcast" && 
    message._source === this.getLocalDevice().getIdentifier() && 
    message._broadcastToSource !== true) {
    return;
  }

  CWDebug.log(4, "Received message: " + e.data);

  //It seems that reacting immediatly to a websocket message
  //sometimes causes crashes in Safari. I am unsure why.
  //We use requestAnimationFrame in an attempt to prevent those crashes
  var that = this;
  window.requestAnimationFrame(function() {
    CWWebsocketMessageParser.parse(message);
    CWWebsocketMessageParser.parseOnRemote(message);

    if (message._name) CWEventManager.trigger("message" + message._name, message);
  });
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketClose = function() {
  CWDebug.log(3, "Websocket closed");
  this._cleanupWebsocket();
  // nativeWebsocketDidClose();
  CWNativeBridge.callOnNative("nativeWebsocketDidClose");

  var runsNative = CWNativeBridge.isRunningNative();

  //If we are running natively, the remote webview will be cleared and a connection
  //can be reestablished over Bluetooth. If we are running native-less we
  //try to reconnect to the master
  if (runsNative === false) {
    window.setTimeout(this._tryWebsocketReconnect, 5000);
  }
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketError = function() {
  CWDebug.log(3, "Error");
  this._onWebsocketClose();
}.bind(Connichiwa);


Connichiwa._softDisconnectWebsocket = function() {
  this._softDisconnected = true;
  // nativeSoftDisconnect();
  CWNativeBridge.callOnNative("nativeSoftDisconnect");
}.bind(Connichiwa);


/**
 * Tries to reconnect the websocket connection. If the reconnect fails, this
 *    method will call itself again after an interval and try again. {@link
 *    Connichiwa._isReconnecting} will be true during the reconnect process
 * @function
 * @private
 */
Connichiwa._tryWebsocketReconnect = function() {
  if (this._websocket !== undefined && this._websocket.readyState === WebSocket.OPEN) {
    return;
  }

  if (this._websocket !== undefined && this._websocket.readyState === WebSocket.CONNECTING) {
    window.setTimeout(this._tryWebsocketReconnect(), 1000);
    return;
  }

  this._isReconnecting = true;

  CWDebug.log(3, "Try reconnect");
  this._connectWebsocket();
  window.setTimeout(this._tryWebsocketReconnect, 5000);
}.bind(Connichiwa);
