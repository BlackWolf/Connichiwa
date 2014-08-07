/* global OOP, Connichiwa, CWEventManager */
"use strict";


 
var CWPinchManager = OOP.createSingleton("Connichiwa", "CWPinchManager", {
  "private _isPinched": false,
  "private _deviceTransformation": { x: 0, y: 0, scale: 1.0 },


  __constructor: function() {
    Connichiwa.onMessage("wasPinched", this._onWasPinched);
    Connichiwa.onMessage("wasUnpinched", this._onWasUnpinched);
    CWEventManager.register("pinchswipe", this._onLocalSwipe);

    CWEventManager.register("gyroscopeUpdate", this._onGyroUpdate);
  },


  _onWasPinched: function(message) {
    this._deviceTransformation = message.deviceTransformation;
    this._isPinched = true;

    //TODO register for gyroscopeUpdate instead of in constructor
  },


  _onWasUnpinched: function(message) {
    this._deviceTransformation = { x: 0, y: 0, scale: 1.0 };
    this._isPinched = false;

    //TODO unregister from gyroscopeUpdate
  },


  _onLocalSwipe: function(swipeData) {
    if (this.isPinched()) return;

    //Prepare for the master and send away
    swipeData.type   = "pinchswipe";
    swipeData.device = Connichiwa.getIdentifier();
    swipeData.width  = screen.availWidth;
    swipeData.height = screen.availHeight;
    Connichiwa.send(swipeData);
  },


  _onGyroUpdate: function(gyroData) {
    if (this.isPinched() === false) return;
    
    if (gyroData.beta > 20) {
      var data = {
        type   : "didQuitPinch",
        device : Connichiwa.getIdentifier()
      };
      Connichiwa.send(data);
    }
  },


  "public isPinched": function() {
    return this._isPinched;
  },


  "public getDeviceTransformation": function() {
    return this._deviceTransformation;
  },
});
