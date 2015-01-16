/* global OOP, Connichiwa, CWEventManager, CWSystemInfo, CWUtil */
"use strict";


 
var CWStitchManager = OOP.createSingleton("Connichiwa", "CWStitchManager", {
  "private _isStitched": false,
  "private _deviceTransformation": undefined,
  "private _gyroDataOnStitch": undefined,

  "public unstitchOnMove": true,
  "public ignoreMoveAxis": [],


  __constructor: function() {
    Connichiwa.on("stitchswipe",         this._onLocalSwipe);
    Connichiwa.on("wasStitched",         this._onWasStitched);
    Connichiwa.on("wasUnstitched",       this._onWasUnstitched);
    Connichiwa.on("gyroscopeUpdate",     this._onGyroUpdate);
    Connichiwa.on("accelerometerUpdate", this._onAccelerometerUpdate);
  },


  _onWasStitched: function(message) {
    this._gyroDataOnStitch = this.package.CWGyroscope.getLastGyroscopeMeasure();
    this._deviceTransformation = message.deviceTransformation;
    this._isStitched = true;

    //TODO register for gyroscopeUpdate instead of in constructor
  },


  _onWasUnstitched: function(message) {
    this._gyroDataOnStitch = undefined;
    this._deviceTransformation = this.DEFAULT_DEVICE_TRANSFORMATION();
    this._isStitched = false;

    //TODO unregister from gyroscopeUpdate
  },


  _onLocalSwipe: function(swipeData) {
    swipeData.device = Connichiwa.getIdentifier();
    swipeData.width  = CWSystemInfo.viewportWidth();
    swipeData.height = CWSystemInfo.viewportHeight();
    Connichiwa.send("master", "_stitchswipe", swipeData);
  },


  _onGyroUpdate: function(gyroData) {
    if (this.isStitched() === false) return;
    if (this.unstitchOnMove === false) return;

    //Might happen if _onWasStitched is called before the first gyro measure arrived
    if (this._gyroDataOnStitch === undefined) {
      this._gyroDataOnStitch = gyroData;
    }
     
    var deltaAlpha = Math.abs(gyroData.alpha - this._gyroDataOnStitch.alpha);
    var deltaBeta  = Math.abs(gyroData.beta  - this._gyroDataOnStitch.beta);
    var deltaGamma = Math.abs(gyroData.gamma - this._gyroDataOnStitch.gamma);

    //Modulo gives us the smallest possible angle (e.g. 1º and 359º gives us 2º)
    deltaAlpha = Math.abs((deltaAlpha + 180) % 360 - 180);
    deltaBeta  = Math.abs((deltaBeta  + 180) % 360 - 180);
    deltaGamma = Math.abs((deltaGamma + 180) % 360 - 180);

    //If the device is tilted more than 20º, we back out of the stitch
    //We give a little more room for alpha. Alpha means the device was moved on the
    //table, which is not as bad as actually picking it up. 
    //Axises in the "ignoreMoveAxis" array are not checked
    if ((CWUtil.inArray("alpha", this.ignoreMoveAxis) === false && deltaAlpha >= 35) ||
        (CWUtil.inArray("beta",  this.ignoreMoveAxis) === false && deltaBeta  >= 20) ||
        (CWUtil.inArray("gamma", this.ignoreMoveAxis) === false && deltaGamma >= 20)) {
      this._quitStitch();
    }
  },


  _onAccelerometerUpdate: function(accelData) {
    if (this.isStitched() === false) return;
    if (this.unstitchOnMove === false) return;


    //Get the accelerometer values normalized
    //z includes earth's gravitational force (~ -9.8), but sometimes is 9.8 and 
    //sometimes -9.8, depending on browser and device, therefore we use its absolute
    //value
    var x = Math.abs(accelData.x);
    var y = Math.abs(accelData.y);
    var z = Math.abs(Math.abs(accelData.z) - 9.81);

    //1.0 seems about a good value which doesn't trigger on every little shake,
    //but triggers when the device is actually moved 
    //Axises in the "ignoreMoveAxis" array are not checked
    if ((CWUtil.inArray("x", this.ignoreMoveAxis) === false && x >= 1.0) || 
        (CWUtil.inArray("y", this.ignoreMoveAxis) === false && y >= 1.0) ||
        (CWUtil.inArray("z", this.ignoreMoveAxis) === false && z >= 1.0)) {
      this._quitStitch();
    }
  },


  "private _quitStitch": function() {
    var data = { device : Connichiwa.getIdentifier() };
    Connichiwa.send("master", "_quitstitch", data);
  },


  "public unstitch": function() {
    this._quitStitch();
  },


  "public isStitched": function() {
    return this._isStitched;
  },


  "public getDeviceTransformation": function() {
    if (this._deviceTransformation === undefined) {
      return this.DEFAULT_DEVICE_TRANSFORMATION();
    }
    
    return this._deviceTransformation;
  },

  "private DEFAULT_DEVICE_TRANSFORMATION": function() {
    return { 
      x        : 0, 
      y        : 0, 
      width    : CWSystemInfo.viewportWidth(), 
      height   : CWSystemInfo.viewportHeight(),
      rotation : 0, 
      scale    : 1.0 
    };
  }
});
