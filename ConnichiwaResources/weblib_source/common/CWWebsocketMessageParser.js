/* global OOP, Connichiwa, CWDebug */
"use strict";


var CWWebsocketMessageParser = OOP.createSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parse": function(message) {
    switch (message.type) {
      case "append"     : this._parseAppend(message);     break;
      case "loadscript" : this._parseLoadScript(message); break;
    }
  },

  _parseAppend: function(message) {
    $("body").append(message.html);
  },

  _parseLoadScript: function(message) {
    $.getScript(message.url).done(function() {
      // CWDebug.log(1, "SCRIPT WAS LOADED");
      var replyMessage = {
        type    : "scriptloaded",
        request : message
      };
      Connichiwa.send(message.source, replyMessage);
    }).fail(function(f, s, t) {
      CWDebug.log(1, "There was an error loading '" + message.url + "': " + t);
    });
  }
});
