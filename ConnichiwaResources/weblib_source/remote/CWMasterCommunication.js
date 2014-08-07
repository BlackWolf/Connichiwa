/* global OOP, Connichiwa, CWEventManager, CWDebug */
"use strict";



var CWMasterCommunication = OOP.createSingleton("Connichiwa", "CWMasterCommunication", 
{
  "public parse": function(message)
  {
    if (message.type === "softdisconnect")
    {
      this.package.Connichiwa._softDisconnectWebsocket();
    }

    if (message.type === "show")
    {
      $("body").append(message.content);
    }

    if (message.type === "update")
    {
      $(message.element).html(message.content);
    }

    if (message.type === "beginPath")
    {
      var context = $(message.element)[0].getContext("2d");
      context.beginPath();
      context.moveTo(message.coords.x, message.coords.y);
    }

    if (message.type === "updatePath")
    {
      var context = $(message.element)[0].getContext("2d");
      context.lineTo(message.coords.x, message.coords.y);
      context.stroke();
    }

    if (message.type === "endPath")
    {
      var context = $(message.element)[0].getContext("2d");
      context.closePath();
    }
    
    if (message.type === "loadScript")
    {
      CWDebug.log(1, "LOADING SCRIPT "+message.url);
      $.getScript(message.url)
        .done(function() {
          CWDebug.log(1, "SCRIPT WAS LOADED");
          //TODO check for AJAX errors n stuff
          var message = {
            type    : "scriptLoaded",
            request : message
          };
          Connichiwa.send(message);
        })
        .fail(function(f, s, t) {
          CWDebug.log(1, "SCRIPT LOAD FAILED HARD: "+t);
        });
    }

    // if (message.type === "wasPinched") {
    //   CWEventManager.trigger("wasPinched", message);
    // }
  },
});
