/* global CWDebug */
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
      window.requestAnimationFrame(function(timestamp) {
        $("body").append(message.content);
      });
    }

    if (message.type === "update")
    {
      window.requestAnimationFrame(function(timestamp) {
        $(message.element).html(message.content);
      });
    }

    if (message.type === "beginPath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(message.element)[0].getContext("2d");
        context.beginPath();
        context.moveTo(message.coords.x, message.coords.y);
      });
    }

    if (message.type === "updatePath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(message.element)[0].getContext("2d");
        context.lineTo(message.coords.x, message.coords.y);
        context.stroke();
      });
    }

    if (message.type === "endPath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(message.element)[0].getContext("2d");
        context.closePath();
      });
    }
    if (message.type === "loadScript")
    {
      $.getScript(message.url, function() {
        //TODO check for AJAX errors n stuff
        var message = {
          type    : "scriptLoaded",
          request : message
        };
        this.package.Connichiwa._sendObject(message);
      });
    }
  },
});
