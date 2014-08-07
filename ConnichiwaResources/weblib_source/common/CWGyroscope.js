/* global OOP, gyro, CWEventManager, CWDebug */
"use strict";



var CWGyroscope = OOP.createSingleton("Connichiwa", "CWGyroscope", {
  _lastMeasure: undefined,

  __constructor: function() {
    gyro.frequency = 500;
    gyro.startTracking(this._onUpdate);

    //TODO we should only start tracking if necessary
    //necessary for now means the device has been pinched
    //but how do we best figure that out?
  },

  "private _onUpdate": function(o) {
    if (o.alpha === null || o.beta === null || o.gamma === null ||
      o.x === null || o.y === null || o.z === null) return;

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
