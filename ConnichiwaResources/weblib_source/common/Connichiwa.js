/* global OOP, CWDevice, CWEventManager, CWUtil, CWDebug */
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


  "public onMessage": function(name, callback) {
    this.on("message" + name, callback);
  },


  "public onLoad": function(callback) {
    if (document.readyState === "complete") {
      callback();
    } else {
      Connichiwa.on("ready", callback);
    }
  },


  // DEVICE COMMUNICATION API


  "public insert": function(identifier, target, html) {
    //With two args, we handle them as identifier and html
    //target is assumed as the body
    if (html === undefined) {
      html = target;
      target = "body";
    }

    //target should be a selector but can also be a DOM or jQuery element
    //If so, we try to get it by its ID on the other side
    if (CWUtil.isObject(target)) {
      target = "#"+$(target).attr("id");
    }
    
    //html can be a DOM or jQuery element - if so, send the outerHTML including 
    //all styles
    if (CWUtil.isObject(html) === true) {
      var el = $(html);
      var clone = el.clone();
      clone[0].style.cssText = el[0].style.cssText; //TODO really needed?
      html = clone[0].outerHTML;
    }

    //identifier can also be a CWDevice
    if (CWDevice.prototype.isPrototypeOf(identifier)) {
      identifier = identifier.getIdentifier();
    }

    var message = {
      selector : target,
      html     : html
    };
    this.send(identifier, "_insert", message);
  },

  "public replace": function(identifier, target, html) {
    //With two args, we handle them as identifier and html
    //target is assumed as the body
    if (html === undefined) {
      html = target;
      target = "body";
    }

    this._replace(identifier, target, html, false);
  },

  "public replaceContent": function(identifier, target, html) {
    //With two args, we handle them as identifier and html
    //target is assumed as the body
    if (html === undefined) {
      html = target;
      target = "body";
    }

    this._replace(identifier, target, html, true);
  },

  "private _replace": function(identifier, target, html, contentOnly) {
    //With two args, we handle them as identifier and html
    //target is assumed as the body
    if (html === undefined) {
      html = target;
      target = "body";
    }

    //target should be a selector but can also be a DOM or jQuery element
    //If so, we try to get it by its ID on the other side
    if (CWUtil.isObject(target)) {
      target = "#"+$(target).attr("id");
    }
    
    //html can be a DOM or jQuery element - if so, send the outerHTML including 
    //all styles
    if (CWUtil.isObject(html) === true) {
      var el = $(html);
      var clone = el.clone();
      clone[0].style.cssText = el[0].style.cssText; //TODO really needed?
      html = clone[0].outerHTML;
    }

    //identifier can also be a CWDevice
    if (CWDevice.prototype.isPrototypeOf(identifier)) {
      identifier = identifier.getIdentifier();
    }

    var message = {
      selector    : target,
      html        : html,
      contentOnly : contentOnly,
    };
    this.send(identifier, "_replace", message);
  },


  "public loadScript": function(identifier, url, callback) {
    var message = { url  : url };
    var messageID = this.send(identifier, "_loadscript", message);

    if (callback !== undefined) {
      this.on("__ack_message" + messageID, callback);
    }
  },

  "public loadCSS": function(identifier, url) {
    var message = { url  : url };
    var messageID = this.send(identifier, "_loadcss", message);
  },


  "public send": function(target, name, message) {
    if (message === undefined) {
      message = target;
      target = "master";
    }

    if (CWDevice.prototype.isPrototypeOf(target)) {
      target = target.getIdentifier();
    }

    message._name = name;
    message._source = this.getIdentifier();
    message._target = target;
    return this._sendObject(message);
  },


  "public respond": function(originalMessage, name, responseObject) {
    this.send(originalMessage._source, name, responseObject);
  },


  "public broadcast": function(name, message, sendToSelf) 
  {
    this.send("broadcast", name, message);

    if (sendToSelf === true) {
      this.send(this.getIdentifier(), name, message);
    }
  },


  "package _sendAck": function(message) {
    var ackMessage = { original : message };
    this.send(message._source, "_ack", ackMessage);
  },


  "package _sendObject": function(message)
  {
    if (("_name" in message) === false) {
      console.warn("Tried to send message without _name, ignoring: "+JSON.stringify(message));
      return;
    }

    message._id = CWUtil.randomInt();
    message._name = message._name.toLowerCase();

    var messageString = JSON.stringify(message);
    CWDebug.log(4, "Sending message: " + messageString);
    this._websocket.send(messageString);

    return message._id;
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
