/* global OOP, Connichiwa, CWEventManager */
"use strict";


 
var CWPinchManager = OOP.createSingleton("Connichiwa", "CWPinchManager", {
  "private _isPinched": false,
  "private _deviceTransformation": { x: 0, y: 0, scale: 1.0 },
  "private _gyroDataOnPinch": undefined,


  __constructor: function() {
    Connichiwa.onMessage("wasPinched", this._onWasPinched);
    Connichiwa.onMessage("wasUnpinched", this._onWasUnpinched);
    CWEventManager.register("pinchswipe", this._onLocalSwipe);

    CWEventManager.register("gyroscopeUpdate", this._onGyroUpdate);
  },


  _onWasPinched: function(message) {
    this._gyroDataOnPinch = this.package.CWGyroscope.getLastGyroscopeMeasure();
    this._deviceTransformation = message.deviceTransformation;
    this._isPinched = true;

    //TODO register for gyroscopeUpdate instead of in constructor
  },


  _onWasUnpinched: function(message) {
    this._gyroDataOnPinch = undefined;
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

    //Might happen if _onWasPinched is called before the first gyro measure arrived
    if (this._gyroDataOnPinch === undefined) {
      this._gyroDataOnPinch = gyroData;
    }

    var deltaAlpha = Math.abs(gyroData.alpha - this._gyroDataOnPinch.alpha);
    var deltaBeta  = Math.abs(gyroData.beta  - this._gyroDataOnPinch.beta);
    var deltaGamma = Math.abs(gyroData.gamma - this._gyroDataOnPinch.gamma);

    //If the device was rotated more than 25º in any direction, we back
    //out of the current pinch
    if (deltaAlpha >= 25 || deltaBeta >= 25 || deltaGamma >= 25) {
      var data = {
        type   : "quitPinch",
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
