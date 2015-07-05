/* global CWEventManager, CWWebsocketMessageParser, CWDevice, CWNativeBridge, CWSystemInfo, CWUtil, CWDebug, CWModules */
'use strict';



var Connichiwa = CWModules.retrieve('Connichiwa');



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
};


/**
 * @override
 * @ignore
 */
Connichiwa.getIdentifier = function() {
  return this._localDevice.getIdentifier();
};


/**
 * @override
 * @ignore
 */
Connichiwa.isMaster = function() {
  return false;
};


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
  properties.isLocal = true;

  if (this._localDevice === undefined) {
    this._localDevice = new CWDevice(properties);
  } else {
    this._localDevice._setProperties(properties);
  }
};


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
};


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketOpen = function() {
  CWDebug.log(3, "Websocket opened");
  this._softDisconnected = false;

  var runsNative = CWNativeBridge.isRunningNative();

  //If we are trying to reconnect and the websocket opened, that means the
  //server became available again. Refresh the page to reset the remote's state
  if (this._isReconnecting === true) {
    location.reload(true);
    return;
  }

  //Create local device
  //This device might be extended by the native layer in the future
  var localInfo = {
    identifier : CWNativeBridge.isRunningNative() ? window._CW_NATIVE.identifier : CWUtil.createUUID(),
    launchDate : Date.now() / 1000.0,
    ppi        : CWSystemInfo.PPI()
  };
  this._setLocalDevice(localInfo);

  Connichiwa.send("server", "_remote_identification", { identifier: localInfo.identifier });

  CWNativeBridge.callOnNative("nativeWebsocketDidOpen");

  //Important: This must be last, as every message before _remote_identification
  //is lost
  this.send("master", "remoteinfo", localInfo, function() {
    CWEventManager.trigger('ready');

    //localDeviceChanged must be after ready, so that code in Connichiwa.onLoad
    //can react to the inital localDevice data
    CWEventManager.trigger('localDeviceChanged', Connichiwa.getLocalDevice());
  });
};


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
    var p1 = CWWebsocketMessageParser.parse(message);
    var p2 = CWWebsocketMessageParser.parseOnRemote(message);

    if (message._name) CWEventManager.trigger("message" + message._name, message);

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
Connichiwa._onWebsocketClose = function() {
  CWDebug.log(3, "Websocket closed");
  this._cleanupWebsocket();
  // nativeWebsocketDidClose();
  CWNativeBridge.callOnNative("nativeWebsocketDidClose");

  var runsNative = CWNativeBridge.isRunningNative();

  //If we are running natively, the remote webview will be cleared and a connection
  //can be reestablished over Bluetooth.
  //If we are running native-less we try to reconnect to the master
  //CAUTION: The close method is also called after a failed reconnect attempt,
  //therefore we need to check if we are already reconnecting
  if (runsNative === false && this._isReconnecting === false) {
    window.setTimeout(this._tryWebsocketReconnect, 2500);
  }
};


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketError = function() {
  CWDebug.log(3, "Error");
  this._onWebsocketClose();
};


Connichiwa._softDisconnectWebsocket = function() {
  this._softDisconnected = true;
  // nativeSoftDisconnect();
  CWNativeBridge.callOnNative("nativeSoftDisconnect");
};


/**
 * Tries to reconnect the websocket connection. If the reconnect fails, this
 *    method will call itself again after an interval and try again. {@link
 *    Connichiwa._isReconnecting} will be true during the reconnect process
 * @function
 * @private
 */
Connichiwa._tryWebsocketReconnect = function() {
  //We have a connection, no need to reconnect
  if (this._websocket !== undefined && this._websocket.readyState === WebSocket.OPEN) {
    return;
  }

  //We are already trying to connect, no need to abort that
  if (this._websocket !== undefined && this._websocket.readyState === WebSocket.CONNECTING) {
    window.setTimeout(this._tryWebsocketReconnect, 1000);
    return;
  }

  this._isReconnecting = true;

  CWDebug.log(3, "Try reconnect");
  this._connectWebsocket();
  window.setTimeout(this._tryWebsocketReconnect, 2500);
};
