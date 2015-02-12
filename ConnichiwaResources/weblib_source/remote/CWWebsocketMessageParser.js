/* global OOP, CWEventManager */
"use strict";


OOP.extendSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parseOnRemote": function(message) {
    switch (message._name) {
      case "_debuginfo"      : this._parseDebugInfo(message); break;
      case "_softdisconnect" : this._parseSoftDisconnect(message); break;
    }
  },


  _parseDebugInfo: function(message) {
    CWDebug.setDebugInfo(message);
  },


  _parseSoftDisconnect: function(message) {
    this.package.Connichiwa._softDisconnectWebsocket();
  },
});
