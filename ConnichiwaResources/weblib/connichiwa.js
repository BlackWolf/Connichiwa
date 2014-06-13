/* global LazyLoad, CWDeviceManager, CWNativeCommunicationParser, CWDebug, CWUtil, CWEventManager */
"use strict";



var ConnichiwaLoader = (function()
{
  var _isReady = false;
  var _readyCallback;


  var triggerReady = function()
  {
    _isReady = true;
    if (_readyCallback !== undefined) _readyCallback();
  };


  var ready = function(callback)
  {
    if (typeof(callback) !== "function") throw "Ready callback must be a function";
    _readyCallback = callback;

    if (_isReady) triggerReady();
  };


  var isReady = function() { return _isReady; };


  return {
    isReady      : isReady,
    triggerReady : triggerReady,
    ready        : ready
  };
})();



//Make Connichiwa available globally (= for the web app)
var Connichiwa;

//Get all Connichiwa files together
LazyLoad.js([
  "/connichiwa/CWDebug.js",
  "/connichiwa/CWUtil.js",
  "/connichiwa/CWEventManager.js",
  "/connichiwa/CWDevice.js",
  "/connichiwa/CWDeviceManager.js",
  "/connichiwa/CWNativeCommunicationParser.js"
], function()
{
  Connichiwa = (function()
  {
    var _websocket = new WebSocket("ws://127.0.0.1:8001");


    ///////////////
    // WEBSOCKET //
    ///////////////


    _websocket.onopen = function()
    {
      CWDebug.log("Websocket opened");
      ConnichiwaLoader.triggerReady();
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


    /////////////////
    // CONNICHIWA //
    ////////////////


    var on = function(event, callback)
    {
      var validEvents = [ "localDeviceSet", "deviceChange" ];
      if (CWUtil.inArray(event, validEvents) === false) throw "Registering for invalid event: " + event;

      CWEventManager.register(event, callback);
    };


    return {
      on : on
    };
  })();
});
