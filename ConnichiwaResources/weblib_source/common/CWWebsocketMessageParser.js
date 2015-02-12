/* global OOP, Connichiwa, CWEventManager, CWDebug */
"use strict";


var CWWebsocketMessageParser = OOP.createSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parse": function(message) {
    switch (message._name) {
      case "_ack"               : this._parseAck(message);               break;
      case "_insert"            : this._parseInsert(message);            break;
      case "_replace"           : this._parseReplace(message);           break;
      case "_loadscript"        : this._parseLoadScript(message);        break;
      case "_loadcss"           : this._parseLoadCSS(message);           break;
      case "_wasstitched"       : this._parseWasStitched(message);       break;
      case "_wasunstitched"     : this._parseWasUnstitched(message);     break;
      case "_gotstitchneighbor" : this._parseGotStitchNeighbor(message); break;
    }

    return true;
  },


  _parseAck: function(message) {
    CWEventManager.trigger("__ack_message" + message.original._id);
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
      CWDebug.err(1, "There was an error loading '" + message.url + "': " + t);
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
  }
});
