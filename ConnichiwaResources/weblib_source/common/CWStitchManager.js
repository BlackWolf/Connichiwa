/* global OOP, Connichiwa, CWEventManager, CWSystemInfo, CWUtil */
"use strict";


 
var CWStitchManager = OOP.createSingleton("Connichiwa", "CWStitchManager", {
  "private _isStitched": false,
  "private _deviceTransformation": undefined,
  "private _gyroDataOnStitch": undefined,

  "public unstitchOnMove": true,
  "public ignoreMoveAxis": [],


  __constructor: function() {
    this._deviceTransformation = this.DEFAULT_DEVICE_TRANSFORMATION();

    CWEventManager.register("stitchswipe",         this._onLocalSwipe);
    CWEventManager.register("wasStitched",         this._onWasStitched);
    CWEventManager.register("wasUnstitched",       this._onWasUnstitched);
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
    this._deviceTransformation = this.DEFAULT_DEVICE_TRANSFORMATION();
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

    var x = Math.abs(accelData.x);
    var y = Math.abs(accelData.y);
    var z = Math.abs(accelData.z + 9.8); //earth's gravitational force ~ -9.8

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
    var data = {
      type   : "quitstitch",
      device : Connichiwa.getIdentifier()
    };
    Connichiwa.send(data);
  },


  // "public toMasterCoordinates": function(lcoords) {
  //   var transformation = this.getDeviceTransformation();

  //   var x = lcoords.x;
  //   var y = lcoords.y;
    
  //   if (transformation.rotation === 180) {
  //     x = CWSystemInfo.viewportWidth()  - x;
  //     y = CWSystemInfo.viewportHeight() - y;
  //   }

  //   x += transformation.x;
  //   y += transformation.y;

  //   return { x: x, y: y };
  // },


  "public isStitched": function() {
    return this._isStitched;
  },


  "public getDeviceTransformation": function() {
    return this._deviceTransformation;
  },

  "private DEFAULT_DEVICE_TRANSFORMATION": function() {
    return { 
      x: 0, 
      y: 0, 
      width: CWSystemInfo.viewportWidth(), 
      height: CWSystemInfo.viewportHeight(),
      rotation: 0, 
      scale: 1.0 
    };
  }
});
