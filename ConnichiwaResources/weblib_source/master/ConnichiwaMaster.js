/* global OOP, CWDebug, CWRemoteCommunication, CWEventManager, CWUtil, CWDeviceManager */
/* global CONNECTING, OPEN */
/* global nativeCallWebsocketDidOpen, nativeCallWebsocketDidClose */
"use strict";


OOP.extendSingleton("Connichiwa", "Connichiwa", {
  "public isMaster"             : true,
  "private _connectionAttempts" : 0,

  // PUBLIC API


  "public send": function(identifier, messageObject) {
    if (identifier === "broadcast") {
      this.broadcast(messageObject);
      return;
    }

    //If we sent a message to ourself, just parse it as if
    //it was sent by a  remote device
    if (messageObject === undefined) {
      messageObject = identifier;
      identifier = undefined;
      messageObject.target = "master";
      messageObject.source = "master";
      CWRemoteCommunication.parse(messageObject);
      return;
    }

    messageObject.source = "master";
    messageObject.target = identifier;
    this._sendObject(messageObject);
  },


  "public broadcast": function(messageObject) 
  {
    messageObject.source = "master";
    messageObject.target = "broadcast";
    this._sendObject(messageObject);
  },
  
  
  "public on": function(event, callback)
  {
    var validEvents = [ 
      "ready", 
      "deviceDetected", 
      "deviceDistanceChanged", 
      "deviceLost",
      "deviceConnected",
      "deviceDisconnected",
      "connectFailed",
      "pinch"
    ];
    
    if (CWUtil.inArray(event, validEvents) === false) throw "Registering for invalid event: " + event;

    CWEventManager.register(event, callback);
  },


  // OVERWRITES
   
  "package _setIdentifier": function(value) 
  {
    if (this._identifier !== undefined) return false;

    this._identifier = value;
    CWDebug.log(2, "Identifier set to " + this._identifier);

    CWDeviceManager.createLocalDevice(this._identifier);

    return true;
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
    CWDebug.log(4, "Received message: " + e.data);
    
    CWRemoteCommunication.parse(message);

    if (message.type) CWEventManager.trigger("message" + message.type, message);
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
