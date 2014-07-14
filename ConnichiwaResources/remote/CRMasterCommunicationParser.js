/* global Remote */
"use strict";



var CRMasterCommunicationParser = (function() 
{
  var parse = function(message)
  {
    CRDebug.log(4, "Received message: " + message);
    var object = JSON.parse(message);

    if (object.type === "softdisconnect")
    {
      Remote._softDisconnectWebsocket();
    }
    if (object.type === "show")
    {
      window.requestAnimationFrame(function(timestamp) {
        $("body").append(object.content);
      });
    }

    if (object.type === "update")
    {
      window.requestAnimationFrame(function(timestamp) {
        $(object.element).html(object.content);
      });
    }

    if (object.type === "updateStyle")
    {
      window.requestAnimationFrame(function(timestamp) {
        for (var style in object.styles) {
          $(object.element).css(style, object.styles[style]);
        }
      });
    }

    if (object.type === "beginPath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(object.element)[0].getContext("2d");
        context.beginPath();
        context.moveTo(object.coords.x, object.coords.y);
      });
    }

    if (object.type === "updatePath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(object.element)[0].getContext("2d");
        context.lineTo(object.coords.x, object.coords.y);
        context.stroke();
      });
    }

    if (object.type === "endPath")
    {
      window.requestAnimationFrame(function(timestamp) {
        var context = $(object.element)[0].getContext("2d");
        context.closePath();
      });
    }
    if (object.type === "loadScript")
    {
      $.getScript(object.url, function() {
        //TODO check for AJAX errors n stuff
        var message = {
          type    : "scriptLoaded",
          request : object
        };
        Remote.send(message);
      });
    }
  };

  return {
    parse : parse
  };
})();
