/* global OOP, Connichiwa, CWEventManager, CWSystemInfo */
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
    //availWidth/Height do not change when a device is rotated
    //Therefore, we use innerHeight/Width to detect landscape and switch the values
    // var screenWidth  = screen.availWidth;
    // var screenHeight = screen.availHeight;
    // if (window.innerHeight < window.innerWidth) { //landscape orienatation
    //   screenWidth  = screen.availHeight;
    //   screenHeight = screen.availWidth;
    // }

    // CWDebug.log(1, $(window).width()+" and "+$(window).height());
    // CWDebug.log(1, window.outerWidth+" / "+window.outerHeight);
    // CWDebug.log(1, JSON.stringify($("body").offset()));

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

    //If the device was tilted more than 20º in any direction, we back our of the pinch
    //A problem are angles such as 1º and 359º - it's a 2º difference but gives 358º. 
    //Because of that, we use a modulo to get the smallest possible difference    
    var deltaAlpha = Math.abs(gyroData.alpha - this._gyroDataOnPinch.alpha);
    var deltaBeta  = Math.abs(gyroData.beta  - this._gyroDataOnPinch.beta);
    var deltaGamma = Math.abs(gyroData.gamma - this._gyroDataOnPinch.gamma);
    deltaAlpha = Math.abs((deltaAlpha + 180) % 360 - 180);
    deltaBeta  = Math.abs((deltaBeta  + 180) % 360 - 180);
    deltaGamma = Math.abs((deltaGamma + 180) % 360 - 180);

    // CWDebug.log(1, "DELTAS: "+deltaAlpha.toFixed(2)+", "+deltaBeta.toFixed(2)+", "+deltaGamma.toFixed(2));
    if (deltaAlpha >= 20 || deltaBeta >= 20 || deltaGamma >= 20) {
      var data = {
        type   : "quitPinch",
        device : Connichiwa.getIdentifier()
      };
      Connichiwa.send(data);
    }

    //TODO
    //we need to add accelerometer support. Using the gyroscope only works pretty well
    //with something around 20-25 degrees, but you can move devices from one side of
    //a device to another without it being unpinched. This should be captured with the
    //accelerometer. Of course, if we REALLY CAREFULLY move a device we can still trick
    //the system, but whatever
    //TODO furthermore, it might be good to give some more room for deltaAlpha - tilting
    //the device on the table without picking it up is not so bad, except for 45º or more 
    //or something like that
  },


  "public isPinched": function() {
    return this._isPinched;
  },


  "public getDeviceTransformation": function() {
    return this._deviceTransformation;
  },
});
