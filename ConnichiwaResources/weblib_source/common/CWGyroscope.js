/* global OOP, gyro, CWEventManager, CWDebug */
"use strict";



var CWGyroscope = OOP.createSingleton("Connichiwa", "CWGyroscope", {
  _lastMeasure: undefined,

  __constructor: function() {
    gyro.frequency = 500;

    // var that = this;
    gyro.startTracking(this._onUpdate);
  },

  "private _onUpdate": function(o) {
    if (this._lastMeasure === undefined) this._lastMeasure = o;
    
    //Send gyro update
    var deltaAlpha = o.alpha - this._lastMeasure.alpha;
    var deltaBeta  = o.beta  - this._lastMeasure.beta;
    var deltaGamma = o.gamma - this._lastMeasure.gamma;
    var gyroData = { 
      alpha : o.alpha, 
      beta  : o.beta, 
      gamma : o.gamma,
      delta : {
        alpha : deltaAlpha, 
        beta  : deltaBeta, 
        gamma : deltaGamma
      }
    };
    CWEventManager.trigger("gyroscopeUpdate", gyroData);

    //Send accelerometer update
    var deltaX = o.x - this._lastMeasure.x;
    var deltaY = o.y - this._lastMeasure.y;
    var deltaZ = o.z - this._lastMeasure.z;
    var accelData = { 
      x     : o.x, 
      y     : o.y, 
      z     : o.z,
      delta : {
        x : deltaX, 
        y : deltaY, 
        z : deltaZ
      }
    };
    CWEventManager.trigger("accelerometerUpdate", accelData);

    //We need to copy the values of o because o will be altered by gyro
    this._lastMeasure = { x: o.x, y: o.y, z: o.z, alpha: o.alpha, beta: o.beta, gamma: o.gamma };
  }
});
