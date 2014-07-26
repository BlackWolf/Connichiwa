/* global OOP, CWEventManager, CWDebug */
"use strict";



var Connichiwa = OOP.createSingleton("Connichiwa", "Connichiwa", {
  "private _identifier" : undefined,
  "private _websocket"  : undefined,


  "public getIdentifier": function() 
  {
    return this._identifier;
  },


  "package _setIdentifier": function(value) 
  {
    if (this._identifier !== undefined) return false;

    this._identifier = value;
    CWDebug.log(2, "Identifier set to " + this._identifier);

    return true;
  },


  "public onMessage": function(type, callback) {
    CWEventManager.register("message" + type, callback);
  },


  "package _disconnectWebsocket": function()
  {
    this._websocket.close();
  },

  // TODO we need to make this package instead of public
  // For now, this is impossible because CWDevice uses it and CWDevice doesn't use OOP
  "public _sendObject": function(messageObject)
  {
    this._send(JSON.stringify(messageObject));
  },


  // TODO we need to make this package instead of public
  // For now, this is impossible because CWDevice uses it and CWDevice doesn't use OOP
  "public _send": function(message) {
    CWDebug.log(4, "Sending message: " + message);
    this._websocket.send(message);
  },


  _cleanupWebsocket: function()
  {
    if (this._websocket !== undefined) 
    {
      this._websocket.onopen    = undefined;
      this._websocket.onmessage = undefined;
      this._websocket.onclose   = undefined;
      this._websocket.onerror   = undefined;
      this._websocket           = undefined;
    }
  },
});
