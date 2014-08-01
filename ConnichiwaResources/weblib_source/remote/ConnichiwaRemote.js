/* global OOP, CWUtil, CWDebug, CWMasterCommunication, CWEventManager */
/* global nativeCallWebsocketDidOpen, nativeCallWebsocketDidClose, nativeCallSoftDisconnect */
"use strict";


OOP.extendSingleton("Connichiwa", "Connichiwa", {
  "private _parsedURL"        : new CWUtil.parseURL(document.URL),
  "private _softDisconnected" : false,


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


  "package _connectWebsocket": function()
  {
    //If we replace the websocket (or re-connect) we don't want to call onWebsocketClose
    //Therefore, first cleanup, then close
    var oldWebsocket = this._websocket;
    this._cleanupWebsocket();    
    if (oldWebsocket !== undefined) oldWebsocket.close();

    this._websocket           = new WebSocket("ws://" + this._parsedURL.hostname + ":" + (parseInt(this._parsedURL.port) + 1));
    this._websocket.onopen    = this._onWebsocketOpen;
    this._websocket.onmessage = this._onWebsocketMessage;
    this._websocket.onclose   = this._onWebsocketClose;
    this._websocket.onerror   = this._onWebsocketError;
  },


  _softDisconnectWebsocket: function()
  {
    this._softDisconnected = true;
    nativeCallSoftDisconnect();
  },


  _onWebsocketOpen: function()
  {
    CWDebug.log(3, "Websocket opened");
    this._softDisconnected = false;
    nativeCallWebsocketDidOpen();
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
    nativeCallWebsocketDidClose();
  },


  _onWebsocketError: function()
  {
    this._onWebsocketClose();
  }
});

CWEventManager.trigger("ready"); //trigger ready asap on remotes
