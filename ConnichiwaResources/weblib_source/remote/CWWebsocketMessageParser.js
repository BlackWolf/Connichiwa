/* global OOP, CWEventManager */
"use strict";


OOP.extendSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parseOnRemote": function(message) {
    switch (message.type) {
      case "softdisconnect" : this._parseSoftDisconnect(message); break;
      case "wasstitched"    : this._parseWasStitched(message);    break;
      case "wasunstitched"  : this._parseWasUnstitched(message);  break;
    }
  },


  _parseSoftDisconnect: function(message) {
    this.package.Connichiwa._softDisconnectWebsocket();
  },


  _parseWasStitched: function(message) {
    CWEventManager.trigger("wasStitched", message);
  },


  _parseWasUnstitched: function(message) {
    CWEventManager.trigger("wasUnstitched");
  }
});
