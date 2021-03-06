/* global Connichiwa, CWGyroscope, CWSystemInfo, CWUtil, CWModules */
'use strict';



/**
 * @typedef DeviceTransformation
 * @type {Object}
 * @property {Number} x The x offset of this device in the global coordinate
 *    system
 * @property {Number} y The y offset of this device in the global coordinate
 *    system
 * @property {Number} width The device's viewport width in the global
 *    coordinate system, which can differ from the device's actual viewport
 *    width due to PPI differences between the devices
 * @property {Number} height The device's viewport height in the global
 *    coordinate system, which can differ from the device's actual viewport
 *    height due to PPI differences between the devices
 * @property {Number} rotation The device's rotation relative to the global
 *    coordinate system axis. Connichiwa can only detect 90º rotiations, so
 *    this property is either 0, 90, 180 or 270
 * @property {Number} scale The scale of this device's content. Connichiwa
 *    adjusts the scale of stitched device's to compensate for display PPI
 *    differences. If content is scaled with this scale on every device, it
 *    will appear the same physicial size on all stitched devices
 * @memberOf CWStitchManager
 */



/**
 * This manager handles everything stitch-related. It detects stitch gestures,
 *    calculates the stitched device's device transformation in the global
 *    coordinate system and is also responsible for handling stitch-related
 *    events and detecting unstitches. It also provides methods for accessing
 *    stitch-related information, such as if the device is stitched and the
 *    current device transformation
 * @namespace CWStitchManager
 */
var CWStitchManager = CWModules.retrieve('CWStitchManager');


/**
 * Determines if this device is currently stitched
 * @type {Boolean}
 * @private
 */
CWStitchManager._isStitched = false;


/**
 * This object stores the current device transformation of this device or is
 *    undefined, if the device is not stitched
 * @type {CWStitchManager.DeviceTransformation}
 * @private
 */
CWStitchManager._deviceTransformation = undefined;


/**
 * Remembers the gyroscope data when the device was stitched. Used to
 *    calculate the unstitch on device movement
 * @type {CWGyroscope.GyroscopeData}
 * @private
 */
CWStitchManager._gyroDataOnStitch = undefined;


/**
 * Determines if Connichiwa will automatically unstitch this device if it is
 *    moved
 * @type {Boolean}
 * @default true
 */
CWStitchManager.unstitchOnMove = true;


/**
 * If {@link CWStitchManager.unstitchOnMove} is set to true, this property
 *    determines axis that do **not** cause an unstitch of the device. It is
 *    an array that is either empty (all axis can cause an unstitch) or can
 *    contain one or multiple of the string values "x", "y", "z" (to ignore
 *    accelerometer axis) or "alpha", "beta", "gamma" (to ignore gyroscope
 *    axis)
 * @type {Array}
 * @default  [ ]
 */
CWStitchManager.ignoreMoveAxis = [];


/**
 * Sets up the CWStitchManager object. Must be called on load
 * @function
 * @private
 */
CWStitchManager.__constructor = function() {
  Connichiwa.on('stitchswipe',         this._onLocalSwipe);
  Connichiwa.on('wasStitched',         this._onWasStitched);
  Connichiwa.on('wasUnstitched',       this._onWasUnstitched);
  Connichiwa.on('gyroscopeUpdate',     this._onGyroUpdate);
  Connichiwa.on('accelerometerUpdate', this._onAccelerometerUpdate);
};


/**
 * Called whenever the manager receives a {@link event:wasStitched} message
 * @param  {Object} message The received message
 * @function
 * @private
 */
CWStitchManager._onWasStitched = function(message) {
  this._gyroDataOnStitch = CWGyroscope.getLastGyroscopeMeasure();
  this._deviceTransformation = message.deviceTransformation;
  this._isStitched = true;

  //TODO register for gyroscopeUpdate instead of in constructor
};


/**
 * Called whenever the manager receives a {@link event:wasUnstitched} message
 * @param  {Object} message The received message
 * @function
 * @private
 */
CWStitchManager._onWasUnstitched = function(message) {
  this._gyroDataOnStitch = undefined;
  this._deviceTransformation = this.getDefaultDeviceTransformation();
  this._isStitched = false;

  //TODO unregister from gyroscopeUpdate
};


/**
 * Called whenever the manager receives a {@link event:stitchswipe} message
 * @param  {Object} swipeData The received message
 * @function
 * @private
 */
CWStitchManager._onLocalSwipe = function(swipeData) {
  swipeData.device = Connichiwa.getIdentifier();
  swipeData.width  = CWSystemInfo.viewportWidth();
  swipeData.height = CWSystemInfo.viewportHeight();
  Connichiwa.send('master', '_stitchswipe', swipeData);
};


/**
 * Called whenever the manager receives a new {@link event:gyroscopeUpdate}
 *    event
 * @param  {CWGyroscope.GyroscopeData} gyroData The new gyroscope measures
 * @function
 * @private
 */
CWStitchManager._onGyroUpdate = function(gyroData) {
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
  if ((CWUtil.inArray('alpha', this.ignoreMoveAxis) === false && deltaAlpha >= 35) ||
      (CWUtil.inArray('beta',  this.ignoreMoveAxis) === false && deltaBeta  >= 20) ||
      (CWUtil.inArray('gamma', this.ignoreMoveAxis) === false && deltaGamma >= 20)) {
    this._quitStitch();
  }
};


/**
 * Called whenever the manager receives a new {@link
 *    event:accelerometerUpdate} event
 * @param  {CWGyroscope.AccelerometerData} accelData The new accelerometer
 *    measures
 * @function
 * @private
 */
CWStitchManager._onAccelerometerUpdate = function(accelData) {
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
  if ((CWUtil.inArray('x', this.ignoreMoveAxis) === false && x >= 1.0) || 
      (CWUtil.inArray('y', this.ignoreMoveAxis) === false && y >= 1.0) ||
      (CWUtil.inArray('z', this.ignoreMoveAxis) === false && z >= 1.0)) {
    this._quitStitch();
  }
};


/**
 * Called whenever the manager wishes to quit the current stitching
 * @function
 * @private
 */
CWStitchManager._quitStitch = function() {
  var data = { device : Connichiwa.getIdentifier() };
  Connichiwa.send('master', '_quitstitch', data);
};


/**
 * Unstitches this device or does nothing if the device is not stitched. Note
 *    that the unstitch is done asynchronously. If you rely on the device
 *    being unstitched, wait for the {@link event:wasunstitched} event to be
 *    fired.
 * @function
 */
CWStitchManager.unstitch = function() {
  this._quitStitch();
};


/**
 * Determines if the device is currently stitched
 * @return {Boolean} true if the device is currently stitched, otherwise false
 * @function
 */
CWStitchManager.isStitched = function() {
  return this._isStitched;
};


/**
 * Returns this device's current device transformation, which is this device's
 *    position, rotation and size in the global coordinate system
 * @return {CWStitchManager.DeviceTransformation} The current device
 *    transformation
 * @function
 */
CWStitchManager.getLocalDeviceTransformation = function() {
  if (this._deviceTransformation === undefined) {
    return this.getDefaultDeviceTransformation();
  }
  
  return this._deviceTransformation;
};


/**
 * Retrieves the default device transformation that represents a non-stitched
 *    device
 * @return {CWStitchManager.DeviceTransformation} The default device
 *    transformation
 * @function
 * @protected
 */
CWStitchManager.getDefaultDeviceTransformation = function() {
  return {
    x        : 0, 
    y        : 0, 
    width    : CWSystemInfo.viewportWidth(), 
    height   : CWSystemInfo.viewportHeight(),
    rotation : 0, 
    scale    : 1.0 
  };
};
