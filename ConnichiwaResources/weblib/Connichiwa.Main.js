/* global LazyLoad, CWDeviceManager, CWNativeCommunicationParser, CWDebug, CWUtil, CWEventManager */
"use strict";




var Connichiwa = (function()
{
  ///////////////
  // WEBSOCKET //
  ///////////////

  var _websocket = new WebSocket("ws://127.0.0.1:8001");

  _websocket.onopen = function()
  {
    CWDebug.log("Websocket opened");
    CWEventManager.trigger("ready");
  };


  _websocket.onmessage = function(e)
  {
    var message = e.data;

    CWDebug.log("message: " + message);

    var object = JSON.parse(message);
    CWNativeCommunicationParser.parse(object);
  };


  _websocket.onerror = function()
  {
    CWDebug.log("Websocket error");
  };


  _websocket.onclose = function()
  {
    CWDebug.log("Websocket closed");
  };


  /////////////
  // EVENTS //
  ////////////


  var on = function(event, callback)
  {
    var validEvents = [ "ready", "localDeviceSet", "deviceChange" ];
    if (CWUtil.inArray(event, validEvents) === false) throw "Registering for invalid event: " + event;

    CWEventManager.register(event, callback);
  };


  return {
    on : on
  };
})();
