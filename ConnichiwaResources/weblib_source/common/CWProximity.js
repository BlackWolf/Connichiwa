/* global CWModules, CWNativeBridge */
'use strict';


/**
 * Manages the proximity sensor of the device, if present. Requires an iOS
 *    native layer to work. After calling {@link CWProximity.startTracking},
 *    this class sends {@link event:proximityStateChanged} events to your
 *    application that indicate if the proximity sensor of the device is
 *    occluded or not. Note that on iOS, enabling the proximity sensor
 *    automatically turns of the device screen as soon as the sensor is
 *    occluded. To stop tracking call {@link CWProximity.stopTracking}.
 * @namespace CWProximity
 */
var CWProximity = CWModules.retrieve('CWProximity');


/**
 * Enables proximity sensor tracking. Note that on iOS, after calling this
 *    method, the screen will turn of when the proximity sensor is occluded.
 *    After calling this method, your application will receive {@link
 *    event:proximityStateChanged} events whenever the proximity sensor state
 *    changes.
 */
CWProximity.startTracking = function() {
  CWNativeBridge.callOnNative('nativeCallStartProximityTracking');
};


/**
 * Disables proximity sensor tracking. Your application will no longer receive
 *    {@link event:proximityStateChanged} events.
 */
CWProximity.stopTracking = function() {
  CWNativeBridge.callOnNative('nativeCallStopProximityTracking');
};
