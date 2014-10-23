/* global OOP, CWEventManager, CWUtil, CWDebug */
"use strict";



var Connichiwa = OOP.createSingleton("Connichiwa", "Connichiwa", {
  "private _websocket" : undefined,


  "public getIdentifier" : function() { /* ABSTRACT */ },
  "public isMaster"      : function() { /* ABSTRACT */ },


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


  "public loadScript": function(identifier, url, callback) {
    var message = {
      type : "loadscript",
      url  : url
    };
    var messageID = this.send(identifier, message);

    if (callback !== undefined) {
      this.on("__messageack__id" + messageID, callback);
    }
  },


  "public send": function(targetIdentifier, messageObject) {
    if (messageObject === undefined) {
      messageObject = targetIdentifier;
      targetIdentifier = "master";
    }

    messageObject.source = this.getIdentifier();
    messageObject.target = targetIdentifier;
    return this._sendObject(messageObject);
  },


  "public respond": function(originalMessage, responseObject) {
    this.send(originalMessage.source, responseObject);
  },


  "public broadcast": function(messageObject) 
  {
    this.send("broadcast", messageObject);
  },


  "package _sendAck": function(messageObject) {
    var ackMessage = {
      type     : "ack",
      original : messageObject
    };
    this.send(messageObject.source, ackMessage);
  },


  "package _sendObject": function(messageObject)
  {
    messageObject._id = CWUtil.randomInt();

    var messageString = JSON.stringify(messageObject);
    CWDebug.log(4, "Sending message: " + messageString);
    this._websocket.send(messageString);

    return messageObject._id;
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
