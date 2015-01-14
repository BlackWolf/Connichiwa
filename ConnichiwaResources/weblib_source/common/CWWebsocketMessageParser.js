/* global OOP, Connichiwa, CWEventManager, CWDebug */
"use strict";


var CWWebsocketMessageParser = OOP.createSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parse": function(message) {
    switch (message._name) {
      case "ack"               : this._parseAck(message);               break;
      case "_insert"           : this._parseInsert(message);            break;
      case "_replace"          : this._parseReplace(message);           break;
      case "loadscript"        : this._parseLoadScript(message);        break;
      case "_loadcss"          : this._parseLoadCSS(message);           break;
      case "wasstitched"       : this._parseWasStitched(message);       break;
      case "wasunstitched"     : this._parseWasUnstitched(message);     break;
      case "gotstitchneighbor" : this._parseGotStitchNeighbor(message); break;
      case "remotelog"         : this._parseRemoteLog(message);         break;
    }
  },


  _parseAck: function(message) {
    CWEventManager.trigger("__messageack__id" + message.original._id);
  },

  _parseInsert: function(message) {
    $(message.selector).append(message.html);
  },

  _parseReplace: function(message) {
    if (message.contentOnly === true) {
      $(message.selector).html(message.html);
    } else {
      $(message.selector).replaceWith(message.html);
    }
  },


  _parseLoadScript: function(message) {
    var that = this;
    $.getScript(message.url).done(function() {
      that.package.Connichiwa._sendAck(message);
    }).fail(function(f, s, t) {
      CWDebug.log(1, "There was an error loading '" + message.url + "': " + t);
    });
  },


  _parseLoadCSS: function(message) {
    var cssEntry = document.createElement("link");
    cssEntry.setAttribute("rel", "stylesheet");
    cssEntry.setAttribute("type", "text/css");
    cssEntry.setAttribute("href", message.url);
    $("head").append(cssEntry);
    this.package.Connichiwa._sendAck(message);
  },


  _parseWasStitched: function(message) {
    CWEventManager.trigger("wasStitched", message);
  },

  _parseWasUnstitched: function(message) {
    CWEventManager.trigger("wasUnstitched", message);
  },

  _parseGotStitchNeighbor: function(message) {
    CWEventManager.trigger("gotstitchneighbor", message);
  },

  _parseRemoteLog: function(message) {
    CWDebug.log(message.priority, "(From "+message._source+") "+message.message);
  }
});
