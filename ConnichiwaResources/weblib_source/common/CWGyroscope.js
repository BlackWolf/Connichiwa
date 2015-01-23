/* global OOP, gyro, CWEventManager, CWDebug */
"use strict";



var CWGyroscope = OOP.createSingleton("Connichiwa", "CWGyroscope", {
  _lastMeasure: undefined,
  _alphaGammaFlipped: false,

  __constructor: function() {
  gyro.frequency = 500;
  gyro.startTracking(this._onUpdate);    

    //TODO we should only start tracking if necessary
    //necessary for now means the device has been stitched
    //but how do we best figure that out?
  },

  "private _onUpdate": function(o) {
    if (o.alpha === null || o.beta === null || o.gamma === null ||
      o.x === null || o.y === null || o.z === null) return;

    if (this._lastMeasure === undefined) this._lastMeasure = o;

    // GYROSCOPE

    //Fuck you Microsoft
    //On "some devices" (so far on Surface Pro 2) the alpha and gamma
    //values are flipped for no reason. There is no good way to detect this,
    //only if alpha or gamma are out of their range we know this is the case
    if (o.alpha < 0 || o.gamma > 180) {
      this._alphaGammaFlipped = true;

      //Flip last measure so we don't screw up our delta calculations
      var temp = this._lastMeasure.alpha;
      this._lastMeasure.alpha = this._lastMeasure.gamma;
      this._lastMeasure.gamma - temp;
    }
    
    var alpha = this._alphaGammaFlipped ? o.gamma : o.alpha;
    var beta  = o.beta;
    var gamma = this._alphaGammaFlipped ? o.alpha : o.gamma;

    var deltaAlpha = alpha - this._lastMeasure.alpha;
    var deltaBeta  = beta  - this._lastMeasure.beta;
    var deltaGamma = gamma - this._lastMeasure.gamma;

    var gyroData = { 
      alpha : alpha, 
      beta  : beta, 
      gamma : gamma,
      delta : {
        alpha : deltaAlpha, 
        beta  : deltaBeta, 
        gamma : deltaGamma
      }
    };
    CWEventManager.trigger(5, "gyroscopeUpdate", gyroData);

    // ACCELEROMETER

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
    CWEventManager.trigger(5, "accelerometerUpdate", accelData);

    //We need to copy the values of o because o will be altered by gyro
    this._lastMeasure = { x: o.x, y: o.y, z: o.z, alpha: alpha, beta: beta, gamma: gamma };
  },


  "package getLastGyroscopeMeasure": function() {
    if (this._lastMeasure === undefined) return undefined;

    return { 
      alpha : this._lastMeasure.alpha, 
      beta  : this._lastMeasure.beta,
      gamma : this._lastMeasure.gamma
    };
  },


  "package getLastAccelerometerMeasure": function() {
    if (this._lastMeasure === undefined) return undefined;
    
    return {
      x : this._lastMeasure.x,
      y : this._lastMeasure.y,
      z : this._lastMeasure.z
    };
  }
});
