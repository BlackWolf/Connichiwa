/* global OOP, CWEventManager, CWUtil, CWDebug */
"use strict";



var Connichiwa = OOP.createSingleton("Connichiwa", "Connichiwa", {
  "private _websocket" : undefined,


  "public getIdentifier" : function()                          { /* ABSTRACT */ },
  "public isMaster"      : function()                          { /* ABSTRACT */ },


  "public on": function(eventName, callback) {
    CWEventManager.register(eventName, callback);
  },


  "public onMessage": function(messageName, callback) {
    this.on("message" + messageName, callback);
  },


  // DEVICE COMMUNICATION API


  "public append": function(identifier, html) {
    //html can also be a DOM or jQuery element
    if (CWUtil.isObject(html) === true) {
      var el = $(html);
      var clone = el.clone();
      clone[0].style.cssText = el[0].style.cssText; //TODO really needed?
      html = clone[0].outerHTML;
    }

    var message = {
      type : "append",
      html : html
    };
    this.send(identifier, message);
  },


  "public loadScript": function(identifier, url) {
    var message = {
      type : "loadscript",
      url  : url
    };
    this.send(identifier, message);
  },


  "public send": function(targetIdentifier, messageObject) {
    if (messageObject === undefined) {
      messageObject = targetIdentifier;
      targetIdentifier = "master";
    }

    messageObject.source = this.getIdentifier();
    messageObject.target = targetIdentifier;
    this._sendObject(messageObject);
  },


  "public broadcast": function(messageObject) 
  {
    this.send("broadcast", messageObject);
  },


  "package _sendObject": function(messageObject)
  {
    this._send(JSON.stringify(messageObject));
  },


  "package _send": function(message) {
    CWDebug.log(4, "Sending message: " + message);
    this._websocket.send(message);
  },


  "package _disconnectWebsocket": function()
  {
    this._websocket.close();
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
