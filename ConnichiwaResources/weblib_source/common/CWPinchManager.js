/* global OOP, Connichiwa, CWEventManager, CWSystemInfo */
"use strict";


 
var CWPinchManager = OOP.createSingleton("Connichiwa", "CWPinchManager", {
  "private _isPinched": false,
  "private _deviceTransformation": { x: 0, y: 0, scale: 1.0 },
  "private _gyroDataOnPinch": undefined,


  __constructor: function() {
    Connichiwa.onMessage("wasPinched",   this._onWasPinched);
    Connichiwa.onMessage("wasUnpinched", this._onWasUnpinched);

    CWEventManager.register("pinchswipe",          this._onLocalSwipe);

    CWEventManager.register("gyroscopeUpdate",     this._onGyroUpdate);
    CWEventManager.register("accelerometerUpdate", this._onAccelerometerUpdate);
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
    swipeData.type   = "pinchswipe";
    swipeData.device = Connichiwa.getIdentifier();
    swipeData.width  = CWSystemInfo.viewportWidth();
    swipeData.height = CWSystemInfo.viewportHeight();
    Connichiwa.send(swipeData);
  },


  _onGyroUpdate: function(gyroData) {
    if (this.isPinched() === false) return;

    //Might happen if _onWasPinched is called before the first gyro measure arrived
    if (this._gyroDataOnPinch === undefined) {
      this._gyroDataOnPinch = gyroData;
    }

    //If the device is tilted more than 20º, we back our of the pinch
    //We give a little more room for alpha. Alpha means the device was tilted on the
    //table, which is not as bad as actually picking it up.  
    var deltaAlpha = Math.abs(gyroData.alpha - this._gyroDataOnPinch.alpha);
    var deltaBeta  = Math.abs(gyroData.beta  - this._gyroDataOnPinch.beta);
    var deltaGamma = Math.abs(gyroData.gamma - this._gyroDataOnPinch.gamma);
    //Modulo gives us the smallest possible angle (e.g. 1º and 359º gives us 2º)
    deltaAlpha = Math.abs((deltaAlpha + 180) % 360 - 180);
    deltaBeta  = Math.abs((deltaBeta  + 180) % 360 - 180);
    deltaGamma = Math.abs((deltaGamma + 180) % 360 - 180);

    if (deltaAlpha >= 35 || deltaBeta >= 20 || deltaGamma >= 20) {
      this._quitPinch();
    }
  },


  _onAccelerometerUpdate: function(accelData) {
    if (this.isPinched() === false) return;

    var x = Math.abs(accelData.x);
    var y = Math.abs(accelData.y);
    var z = Math.abs(accelData.z + 9.8); //earth's gravitational force ~ -9.8

    //1.0 seems about a good value which doesn't trigger on every little shake,
    //but triggers when the device is actually moved
    if (x >= 1.0 || y >= 1.0 || z >= 1.0) {
      this._quitPinch();
    }
  },


  "private _quitPinch": function() {
    var data = {
      type   : "quitPinch",
      device : Connichiwa.getIdentifier()
    };
    Connichiwa.send(data);
  },


  "public isPinched": function() {
    return this._isPinched;
  },


  "public getDeviceTransformation": function() {
    return this._deviceTransformation;
  },
});
