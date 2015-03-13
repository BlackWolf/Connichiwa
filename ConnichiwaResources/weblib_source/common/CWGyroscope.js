/* global gyro, CWEventManager */
'use strict';



/**
  * @typedef GyroscopeData
  * @type {Object}
  * @property {Number} alpha Gyroscope value on the alpha axis. The alpha axis
  *    changes if the device rotates around the z axis
  * @property {Number} beta Gyroscope value on the beta axis. The beta axis 
  *    changes if the device rotates around the x axis
  * @property {Number} gamma Gyroscope value on the gamma axis. The gamma axis
  *    changes if the device rotates around the y axis
  * @memberOf CWGyroscope
  */


/**
 *
 * @typedef AccelerometerData
 * @type {Object}
 * @property {Number} x Accelerometer value on the x axis
 * @property {Number} y Accelerometer value on the y axis
 * @property {Number} z Accelerometer value on the z axis. This includes the
 *    earth's gravitational force and is therefore 9.81 if the device lays
 *    still. On some browsers and devices it can also be -9.81
 * @memberOf CWGyroscope
 */



/**
 * CWGyroscope encapsulates gyroscope and accelerometer data for use in
 *    Connichiwa. It automatically receives the necessary data with the help
 *    of [gyro.js](http://tomg.co/gyrojs) and forwards the data by sending
 *    {@link event:gyroscopeUpdate} and {@link event:accelerometerUpdate}
 *    events.
 * @namespace CWGyroscope
 */
var CWGyroscope = CWGyroscope || {};


/**
 * Stores the last gyroscope and the last accelerometer measure received. This
 *    combines a {@link CWGyroscope.GyroscopeData} and a {@link
 *    CWGyroscope.AccelerometerData} object
 * @type {Object}
 * @private
 */
CWGyroscope._lastMeasure = undefined;


/**
 * Determines if the alpha and gamma values of the incoming gyroscope data is
 *    flipped
 * @type {Boolean}
 * @private
 */
CWGyroscope._alphaGammaFlipped = false;


/**
 * Should be called on application launch, initalizes the CWGyroscope object
 * @function
 * @private
 */
CWGyroscope.__constructor = function() {
  gyro.frequency = 500;
  gyro.startTracking(this._onUpdate.bind(this));    

  //TODO we should only start tracking if necessary
  //necessary for now means the device has been stitched
  //but how do we best figure that out?
}.bind(CWGyroscope);


/**
 * Called whenever the gyro library fetches new data
 * @param  {Object} o Gyroscope/Accelerometer data passed by the gyro library
 * @fires gyroscopeUpdate
 * @fires accelerometerUpdate
 * @function
 * @private
 */
CWGyroscope._onUpdate = function(o) {
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
    this._lastMeasure.gamma = temp;
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
  CWEventManager.trigger(5, 'gyroscopeUpdate', gyroData);

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
  CWEventManager.trigger(5, 'accelerometerUpdate', accelData);

  //We need to copy the values of o because o will be altered by gyro
  this._lastMeasure = { x: o.x, y: o.y, z: o.z, alpha: alpha, beta: beta, gamma: gamma };
}.bind(CWGyroscope);


/**
 * Returns the newest gyroscope data
 * @return {CWGyroscope.GyroscopeData} The newest gyroscope measurement
 * @function
 */
CWGyroscope.getLastGyroscopeMeasure = function() {
  if (this._lastMeasure === undefined) return undefined;

  return { 
    alpha : this._lastMeasure.alpha, 
    beta  : this._lastMeasure.beta,
    gamma : this._lastMeasure.gamma
  };
}.bind(CWGyroscope);


/**
 * Returns the newest accelerometer data
 * @return {CWGyroscope.AccelerometerData} The newest accelerometer
 *    measurement
 * @function
 */
CWGyroscope.getLastAccelerometerMeasure = function() {
  if (this._lastMeasure === undefined) return undefined;
  
  return {
    x : this._lastMeasure.x,
    y : this._lastMeasure.y,
    z : this._lastMeasure.z
  };
}.bind(CWGyroscope);

//Initalize module. Delayed call to make sure all modules are ready
if (CWGyroscope.__constructor) window.setTimeout(CWGyroscope.__constructor, 0);
