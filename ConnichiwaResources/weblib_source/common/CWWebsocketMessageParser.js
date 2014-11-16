/* global OOP, Connichiwa, CWEventManager, CWDebug */
"use strict";


var CWWebsocketMessageParser = OOP.createSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parse": function(message) {
    switch (message.type) {
      case "ack"               : this._parseAck(message);               break;
      case "append"            : this._parseAppend(message);            break;
      case "loadscript"        : this._parseLoadScript(message);        break;
      case "wasstitched"       : this._parseWasStitched(message);       break;
      case "wasunstitched"     : this._parseWasUnstitched(message);     break;
      case "gotstitchneighbor" : this._parseGotStitchNeighbor(message); break;
    }
  },


  _parseAck: function(message) {
    CWEventManager.trigger("__messageack__id" + message.original._id);
  },

  _parseAppend: function(message) {
    $("body").append(message.html);
  },

  _parseLoadScript: function(message) {
    var that = this;
    $.getScript(message.url).done(function() {
      that.package.Connichiwa._sendAck(message);
    }).fail(function(f, s, t) {
      CWDebug.log(1, "There was an error loading '" + message.url + "': " + t);
    });
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
