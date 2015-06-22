/* global Connichiwa, CWDebug, CWModules */
'use strict';



/**
 * This module is responsible for the communication between the JS library and
 *    the native layer. On the master, such communication must exist. On a
 *    remote, it is only possible if a native layer exists.This includes
 *    receiving and reacting to messages from the native layer and also
 *    calling methods on the native layer.
 *
 * TODO details about the communication protocol
 * @namespace CWNativeBridge
 * @protected
 */
var CWNativeBridge = CWModules.retrieve('CWNativeBridge');


/**
 * Determines if this device is run by a native layer. Always true for the
 *    master device
 * @type {Boolean}
 * @private
 */
CWNativeBridge._runsNative = false;


/**
 * Initializes the CWNativeBridge module. Must be called on load.
 * @function
 * @private
 */
CWNativeBridge.__constructor = function() {
  if (window._CW_NATIVE !== undefined) {
    this._runsNative = true;
  } 
};


/**
 * Determines if this device is run by a native layer. Always true for the
 *    master device
 * @return {Boolean} true if a native layer is present, otherwise false
 * @function
 * @protected
 */
CWNativeBridge.isRunningNative = function() {
  return (this._runsNative === true);
};


/**
 * Calls a method with the given name on the native layer. If there is no
 *    native layer or the method does not exist, the call will do nothing
 * @param  {String} methodName The name of the method to call
 * @function
 * @protected
 */
CWNativeBridge.callOnNative = function(methodName) {
  //If we are not running natively, all native method calls are simply ignored
  if (this.isRunningNative() !== true) return;

  //Grab additional arguments passed to this method, but not methodName
  var args = Array.prototype.slice.call(arguments);
  args.shift();

  //Check if the given method is a valid function and invoke it
  //Obviously, this could be used to call any method, but what's the point really?
  var method = window[methodName];
  if (typeof method === 'function') {
    method.apply(null, args);
  } else { 
    CWDebug.log(1, 'ERROR: Tried to call native method with name ' + methodName + ', but it doesn\'t exist!');
  }
};


/**
 * This method is used to parse a message from the native layer. It will then
 *    call the appropiate sub-parse method, if this message is a valid
 *    message. This method should only be called by the native layer and never
 *    by the JS code or the application code.
 * @param  {Object} message The native layer's message
 * @function
 * @protected
 */
CWNativeBridge.parse = function(message) { /* ABSTRACT */ };
