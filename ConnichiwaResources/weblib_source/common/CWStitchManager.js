/* global OOP, Connichiwa, CWEventManager, CWSystemInfo */
"use strict";


 
var CWStitchManager = OOP.createSingleton("Connichiwa", "CWStitchManager", {
  "private _isStitched": false,
  "private _deviceTransformation": { x: 0, y: 0, scale: 1.0 },
  "private _gyroDataOnStitch": undefined,


  __constructor: function() {
    Connichiwa.onMessage("wasStitched",   this._onWasStitched);
    Connichiwa.onMessage("wasUnstitched", this._onWasUnstitched);

    CWEventManager.register("stitchswipe",          this._onLocalSwipe);

    CWEventManager.register("gyroscopeUpdate",     this._onGyroUpdate);
    CWEventManager.register("accelerometerUpdate", this._onAccelerometerUpdate);
  },


  _onWasStitched: function(message) {
    this._gyroDataOnStitch = this.package.CWGyroscope.getLastGyroscopeMeasure();
    this._deviceTransformation = message.deviceTransformation;
    this._isStitched = true;

    //TODO register for gyroscopeUpdate instead of in constructor
  },


  _onWasUnstitched: function(message) {
    this._gyroDataOnStitch = undefined;
    this._deviceTransformation = { x: 0, y: 0, scale: 1.0 };
    this._isStitched = false;

    //TODO unregister from gyroscopeUpdate
  },


  _onLocalSwipe: function(swipeData) {
    swipeData.type   = "stitchswipe";
    swipeData.device = Connichiwa.getIdentifier();
    swipeData.width  = CWSystemInfo.viewportWidth();
    swipeData.height = CWSystemInfo.viewportHeight();
    Connichiwa.send(swipeData);
  },


  _onGyroUpdate: function(gyroData) {
    if (this.isStitched() === false) return;

    //Might happen if _onWasStitched is called before the first gyro measure arrived
    if (this._gyroDataOnStitch === undefined) {
      this._gyroDataOnStitch = gyroData;
    }

    //If the device is tilted more than 20º, we back our of the stitch
    //We give a little more room for alpha. Alpha means the device was moved on the
    //table, which is not as bad as actually picking it up.  
    var deltaAlpha = Math.abs(gyroData.alpha - this._gyroDataOnStitch.alpha);
    var deltaBeta  = Math.abs(gyroData.beta  - this._gyroDataOnStitch.beta);
    var deltaGamma = Math.abs(gyroData.gamma - this._gyroDataOnStitch.gamma);
    //Modulo gives us the smallest possible angle (e.g. 1º and 359º gives us 2º)
    deltaAlpha = Math.abs((deltaAlpha + 180) % 360 - 180);
    deltaBeta  = Math.abs((deltaBeta  + 180) % 360 - 180);
    deltaGamma = Math.abs((deltaGamma + 180) % 360 - 180);

    if (deltaAlpha >= 35 || deltaBeta >= 20 || deltaGamma >= 20) {
      this._quitStitch();
    }
  },


  _onAccelerometerUpdate: function(accelData) {
    if (this.isStitched() === false) return;

    var x = Math.abs(accelData.x);
    var y = Math.abs(accelData.y);
    var z = Math.abs(accelData.z + 9.8); //earth's gravitational force ~ -9.8

    //1.0 seems about a good value which doesn't trigger on every little shake,
    //but triggers when the device is actually moved
    if (x >= 1.0 || y >= 1.0 || z >= 1.0) {
      this._quitStitch();
    }
  },


  "private _quitStitch": function() {
    var data = {
      type   : "quitstitch",
      device : Connichiwa.getIdentifier()
    };
    Connichiwa.send(data);
  },


  "public isStitched": function() {
    return this._isStitched;
  },


  "public getDeviceTransformation": function() {
    return this._deviceTransformation;
  },
});
