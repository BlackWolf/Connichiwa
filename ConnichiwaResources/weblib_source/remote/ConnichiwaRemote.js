/* global OOP, CWSystemInfo, CWUtil, CWDebug, CWMasterCommunication, CWNativeRemoteCommunication, CWEventManager */
/* global runsNative */
"use strict";


OOP.extendSingleton("Connichiwa", "Connichiwa", {
  "private _localDevice"      : undefined,
  "private _softDisconnected" : false,


  __constructor: function() {
    if (window.RUN_BY_CONNICHIWA_NATIVE !== true) {
      this._connectWebsocket();
    }
    CWEventManager.trigger("ready"); //trigger ready asap on remotes
  },


  "public getIdentifier": function() 
  {
    return this._localDevice.getIdentifier();
  },


  "public isMaster": function() {
    return false;
  },


  "public send": function(identifier, messageObject) {
    if (identifier === "broadcast") {
      this.broadcast(messageObject);
      return;
    }

    if (messageObject === undefined) {
      messageObject = identifier;
      identifier = undefined;
      messageObject.source = this.getIdentifier();
      messageObject.target = "master";
      this._sendObject(messageObject);
      return;
    }

    messageObject.source = this.getIdentifier();
    messageObject.target = identifier;
    this._sendObject(messageObject);
  },


  "public broadcast": function(messageObject) 
  {
    messageObject.source = this.getIdentifier();
    messageObject.target = "broadcast";
    this._sendObject(messageObject);
  },


  // "package _setIdentifier": function(value) 
  // {
  //   if (this._identifier !== undefined) return false;

  //   this._identifier = value;
  //   CWDebug.log(2, "Identifier set to " + this._identifier);

  //   //Pass the new identifier to the master device
  //   var data = { type: "remoteidentifier", identifier: this._identifier };
  //   this.send(data);

  //   return true;
  // },


  "package _setLocalDevice": function(properties) {
    if (this._localDevice !== undefined) return;

    this._localDevice = new CWDevice(properties);

    //var data = { type: "remoteinfo", };
    properties.type = "remoteinfo";
    this.send(properties);
  },


  "package _connectWebsocket": function()
  {
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
    if (runsNative === true) {
      // nativeWebsocketDidOpen();
      CWNativeRemoteCommunication.callOnNative("nativeWebsocketDidOpen");
    } else {
      //We have no native layer that delivers us accurate local device info
      //Therefore, we create as much info as we can ourselves
      var localInfo = {
        identifier : CWUtil.createUUID(),
        ppi        : CWSystemInfo.PPI()
      };
      this._setLocalDevice(localInfo);
      // this._setIdentifier(CWUtil.createUUID());
    }
  },


  _onWebsocketMessage: function(e)
  {
    var message = JSON.parse(e.data);
    CWDebug.log(4, "Received message: " + e.data);

    //It seems that reacting immediatly to a websocket message
    //sometimes causes crashes in Safari. I am unsure why.
    //We use requestAnimationFrame in an attempt to prevent those crashes
    window.requestAnimationFrame(function() {
      CWMasterCommunication.parse(message);
      if (message.type) CWEventManager.trigger("message" + message.type, message);
    });
  },


  _onWebsocketClose: function()
  {
    CWDebug.log(3, "Websocket closed");
    this._cleanupWebsocket();
    // nativeWebsocketDidClose();
    CWNativeRemoteCommunication.callOnNative("nativeWebsocketDidClose");
  },


  _onWebsocketError: function()
  {
    this._onWebsocketClose();
  }
});
