/* global OOP, CWEventManager, CWUtil, CWDebug */
"use strict";



var Connichiwa = OOP.createSingleton("Connichiwa", "Connichiwa", {
  "private _websocket" : undefined,


  "public getIdentifier" : function() { /* ABSTRACT */ },
  "public isMaster"      : function() { /* ABSTRACT */ },


  "public on": function(eventName, callback) {
    //We can't use the normal event system for the load event, so
    //forward it
    if (eventName === "load") {
      this.onLoad(callback);
      return;
    } 
    
    CWEventManager.register(eventName, callback);
  },


  "public onMessage": function(messageName, callback) {
    this.on("message" + messageName, callback);
  },


  "public onLoad": function(callback) {
    if (document.readyState === 'complete') {
      callback();
    } else {
      $(window).load(callback);
    }
  },


  // DEVICE COMMUNICATION API


  "public append": function(identifier, target, html) {
    //if html is missing, html is target and target is body
    if (html === undefined) {
      html = target;
      target = "body";
    }

    //target should be a selector but can also be a DOM or jQuery element
    //If so, we try to get it by its ID on the other side
    if (CWUtil.isObject(target)) {
      target = $(target).attr("id");
    }
    
    //html can be a DOM or jQuery element - if so, send the outerHTML including 
    //all styles
    if (CWUtil.isObject(html) === true) {
      var el = $(html);
      var clone = el.clone();
      clone[0].style.cssText = el[0].style.cssText; //TODO really needed?
      html = clone[0].outerHTML;
    }

    var message = {
      type           : "append",
      targetSelector : target,
      html           : html
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


  "public broadcast": function(messageObject, sendToSelf) 
  {
    this.send("broadcast", messageObject);

    if (sendToSelf === true) {
      this.send(this.getIdentifier(), messageObject);
    }
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
