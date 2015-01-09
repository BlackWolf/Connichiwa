/* global OOP, CWEventManager */
"use strict";


OOP.extendSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parseOnRemote": function(message) {
    switch (message._name) {
      case "softdisconnect" : this._parseSoftDisconnect(message); break;
    }
  },


  _parseSoftDisconnect: function(message) {
    this.package.Connichiwa._softDisconnectWebsocket();
  },
});
