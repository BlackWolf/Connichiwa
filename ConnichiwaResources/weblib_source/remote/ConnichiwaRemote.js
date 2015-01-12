/* global OOP, CWWebsocketMessageParser, CWDevice, CWSystemInfo, CWUtil, CWDebug, CWMasterCommunication, CWNativeRemoteCommunication, CWEventManager */
"use strict";


OOP.extendSingleton("Connichiwa", "Connichiwa", {
  "private _localDevice"      : undefined,
  "private _softDisconnected" : false,
  "private _isReconnecting"   : false,


  __constructor: function() {
    //If no native layer runs in the background, we have to take care of 
    //establishing a connection ourselves
    var runsNative = this.package.CWNativeRemoteCommunication.isRunningNative();
    if (runsNative !== true) this._connectWebsocket();
  },


  "public getIdentifier": function() 
  {
    return this._localDevice.getIdentifier();
  },


  "public isMaster": function() {
    return false;
  },


  "package _setLocalDevice": function(properties) {
    if (this._localDevice === undefined) {
      properties.isLocal = true;
      this._localDevice = new CWDevice(properties);
    }

    //Let the master know about our new device information
    this.send("master", "remoteinfo", properties);
  },


  "package _connectWebsocket": function()
  {
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
  },


  _softDisconnectWebsocket: function()
  {
    this._softDisconnected = true;
    // nativeSoftDisconnect();
    CWNativeRemoteCommunication.callOnNative("nativeSoftDisconnect");
  },


  _onWebsocketOpen: function()
  {
    CWDebug.log(3, "Websocket opened");
    this._softDisconnected = false;

    var runsNative = this.package.CWNativeRemoteCommunication.isRunningNative();

    CWNativeRemoteCommunication.callOnNative("nativeWebsocketDidOpen");

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
  },


  _onWebsocketMessage: function(e)
  {
    var message = JSON.parse(e.data);
    CWDebug.log(4, "Received message: " + e.data);

    //It seems that reacting immediatly to a websocket message
    //sometimes causes crashes in Safari. I am unsure why.
    //We use requestAnimationFrame in an attempt to prevent those crashes
    var that = this;
    window.requestAnimationFrame(function() {
      that.package.CWWebsocketMessageParser.parse(message);
      that.package.CWWebsocketMessageParser.parseOnRemote(message);

      if (message._name) CWEventManager.trigger("message" + message._name, message);
    });
  },


  _onWebsocketClose: function()
  {
    CWDebug.log(3, "Websocket closed");
    this._cleanupWebsocket();
    // nativeWebsocketDidClose();
    CWNativeRemoteCommunication.callOnNative("nativeWebsocketDidClose");

    var runsNative = this.package.CWNativeRemoteCommunication.isRunningNative();

    //If we are running natively, the remote webview will be cleared and a connection
    //can be reestablished over Bluetooth. If we are running native-less we
    //try to reconnect to the master
    if (runsNative === false) {
      window.setTimeout(this._tryWebsocketReconnect, 5000);
    }
  },


  _onWebsocketError: function()
  {
    CWDebug.log(3, "Error");
    this._onWebsocketClose();
  },

  _tryWebsocketReconnect: function() {
    if (this._websocket !== undefined && 
       (this._websocket.readyState === WebSocket.OPEN || this._websocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._isReconnecting = true;

    // if (this._websocket !== undefined && this._websocket.readyState === WebSocket.CONNECTING) {
    //   window.setTimeout(this._tryWebsocketReconnect(), 1000);
    //   return;
    // }


    CWDebug.log(3, "Try reconnect");
    this._connectWebsocket();
    // window.setTimeout(this._tryWebsocketReconnect, 5000);
  }
});
