/* global OOP, CWDebug */
"use strict";



//TODO refactor into common, remote, master parts
//rename to CWNativeBridge or something like that
var CWNativeRemoteCommunication = OOP.createSingleton("Connichiwa", "CWNativeRemoteCommunication", 
{
  _runsNative: false,


  __constructor: function() {
    if (window.RUN_BY_CONNICHIWA_NATIVE === true) {
      this._runsNative = true;
    }
  },


  "public isRunningNative": function() {
    return (this._runsNative === true);
  },


  "public callOnNative": function(methodName) {
    //If we are not running natively, all native method calls are simply ignored
    if (this.isRunningNative() !== true) return;

    //Grab additional arguments passed to this method, but not methodName
    var args = Array.prototype.slice.call(arguments);
    args.shift();

    //Check if the given method is a valid function and invoke it
    //Obviously, this could be used to call any method, but what's the point really?
    var method = window[methodName];
    if (typeof method === "function") {
      method.apply(null, args);
    } else { 
      CWDebug.log(1, "ERROR: Tried to call native method with name " + methodName + ", but it doesn't exist!");
    }
  },


  "public parse": function(message)
  {
    CWDebug.log(4, "Parsing native message (remote): " + message);
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "runsnative":          this._parseRunsNative(object); break;
      case "connectwebsocket":    this._parseConnectWebsocket(object); break;
      case "cwdebug":             this._parseDebug(object); break;
      case "localinfo":           this._parseLocalInfo(object); break;
      case "disconnectwebsocket": this._parseDisconnectWebsocket(object); break;
    }
  },


  _parseRunsNative: function(message) {
    CWDebug.log(1, "RUNS NATIVE SET TO "+JSON.stringify(message));
    this._runsNative = true;
  },


  _parseConnectWebsocket: function(message)
  {
    this.package.Connichiwa._connectWebsocket();
  },


  _parseDebug: function(message)
  {
    CWDebug.enableDebug();
  },


  _parseLocalInfo: function(message) 
  {
    this.package.Connichiwa._setLocalDevice(message);
    //this.package.Connichiwa._setIdentifier(message.identifier);
  },


  _parseDisconnectWebsocket: function(message)
  {
    this.package.Connichiwa._disconnectWebsocket();  
  },
});
