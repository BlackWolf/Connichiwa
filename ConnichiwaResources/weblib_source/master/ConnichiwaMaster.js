/* global OOP, CWDebug, CWWebsocketMessageParser, CWEventManager, CWUtil, CWDeviceManager */
/* global CONNECTING, OPEN */
/* global nativeCallWebsocketDidOpen, nativeCallWebsocketDidClose */
"use strict";


OOP.extendSingleton("Connichiwa", "Connichiwa", {
  "private _connectionAttempts" : 0,
  "public autoConnect": false,
  "public autoLoad": [],


  // PUBLIC API
  

  "public getLocalDevice": function() {
    return CWDeviceManager.getLocalDevice();
  },
  

  "public getIdentifier": function() 
  {
    var localDevice = CWDeviceManager.getLocalDevice();
    if (localDevice === undefined) return undefined;

    return localDevice.getIdentifier();
  },
  

  "public isMaster": function() {
    return true;
  },


  "public getIPs": function() {
    var localDevice = CWDeviceManager.getLocalDevice();
    if (localDevice === undefined) return undefined;

    return localDevice.getIPs();
  },

  "public getPort": function() {
    var localDevice = CWDeviceManager.getLocalDevice();
    if (localDevice === undefined) return undefined;

    return localDevice.getPort();
  },


  // WEBSOCKET


  "package _connectWebsocket": function()
  {
    if (this._websocket !== undefined && (this._websocket.state === CONNECTING || this._websocket.state === OPEN)) {
      return;
    }

    this._cleanupWebsocket();

    CWDebug.log(3, "Connecting websocket");

    this._websocket           = new WebSocket("ws://127.0.0.1:8001");
    this._websocket.onopen    = this._onWebsocketOpen;
    this._websocket.onmessage = this._onWebsocketMessage;
    this._websocket.onclose   = this._onWebsocketClose;
    this._websocket.onerror   = this._onWebsocketError;

    this._connectionAttempts++;
  },


  _onWebsocketOpen: function()
  {
    CWDebug.log(3, "Websocket opened");
    nativeCallWebsocketDidOpen();
    this._connectionAttempts = 0;
  },


  _onWebsocketMessage: function(e)
  {
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
    //sometimes causes crashes in UIWebView. I am unsure why.
    //We use requestAnimationFrame in an attempt to prevent those crashes
    var that = this;
    window.requestAnimationFrame(function() {
      that.package.CWWebsocketMessageParser.parse(message);
      that.package.CWWebsocketMessageParser.parseOnMaster(message);

      if (message._name) CWEventManager.trigger("message" + message._name, message);
    });
  },


  _onWebsocketClose: function()
  {
    CWDebug.log(3, "Websocket closed");
    this._cleanupWebsocket();

    if (this._connectionAttempts >= 5)
    {
      //Give up, guess we are fucked
      nativeCallWebsocketDidClose();
      return;
    }

    //We can't allow this blashphemy! Try to reconnect!
    setTimeout(function() { this._connectWebsocket(); }, this._connectionAttempts * 1000);
  },


  _onWebsocketError: function()
  {
    this._onWebsocketClose();
  },
});
