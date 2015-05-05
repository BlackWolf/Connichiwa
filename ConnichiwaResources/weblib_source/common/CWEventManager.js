/* global CWUtil, CWDebug, CWModules */
'use strict';



/**
 * Manages event registration and triggering events throughout Connichiwa.
 *    This includes registration for system events (such as {@link
 *    Connichiwa.deviceDetected}) and registration for custom messages from
 *    other devices. This manager is also used to trigger events, which will
 *    then call every callback that was registered for the event.
 * @namespace  CWEventManager
 * @protected
 */
var CWEventManager = CWEventManager || {};


/**
 * The currently registered callbacks. The keys in this dictionary are event
 *    names, the values are arrays of callbacks registered for the event.
 * @type {Object}
 * @private
 */
CWEventManager._callbacks = {};


/**
 * Registers the given callback for the given event. If an event with the
 *    given name is triggered, the callback will be executed.
 * @param  {String}   event    The name of the event to register for
 * @param  {Function} callback The callback function that will be invoked if
 *    the event is triggered
 * @function
 * @protected
 */
CWEventManager.register = function(event, callback) {
  if (typeof(event) !== 'string') throw 'Event name must be a string';
  if (typeof(callback) !== 'function') throw 'Event callback must be a function';

  event = event.toLowerCase();

  //event can be a space-seperated list of event names
  if (event.indexOf(' ') !== -1) {
    var events = event.split(' ');
    for (var i = 0; i < events.length; i++) {
      CWEventManager.register(events[i], callback);
    }
    return;
  }

  if (!this._callbacks[event]) this._callbacks[event] = [];
  this._callbacks[event].push(callback);
  CWDebug.log(3, 'Attached callback to ' + event);
}.bind(CWEventManager);


/**
 * Triggers an event with the given name. All callback functions that were
 *    registered for that event using {@link CWEventManager.register} will be
 *    invoked. Any additional parameters passed to this function will be
 *    passed to the callbacks. The optional log priority determines the
 *    priority with which debug messages are logged. For events that occur
 *    regularly, this priority should be set to 5.
 * @param  {Number} [logPrio=4] Priority with which trigger-messages will be
 *    logged. Should be set to 5 for events that occur very frequently. Also
 *    see {@link CWDebug.setLogLevel}
 * @param  {String} event   The name of the event to trigger
 * @param  {...Mixed} [var_args] Any additional arguments will be passed to
 *    the callback functions
 * @function
 * @protected
 */
CWEventManager.trigger = function(logPrio, event, var_args) {
  //Get the arguments passed to trigger() without logPrio and event
  var args = Array.prototype.slice.call(arguments);
  if (CWUtil.isString(logPrio) === true) {
    //Only the event was given, default logPrio is used
    event = logPrio;
    logPrio = 4;
    args.shift();
  } else {
    //logPrio and event were given, remove both from args
    args.shift();
    args.shift();
  }

  event = event.toLowerCase();

  if (!this._callbacks[event]) { 
    CWDebug.log(5, 'No callbacks  for ' + event + ' registered'); 
    return; 
  }

  CWDebug.log(logPrio, 'Triggering event ' + event + ' for ' + this._callbacks[event].length + ' callbacks');
  for (var i = 0; i < this._callbacks[event].length; i++)
  {
    var callback = this._callbacks[event][i];
    callback.apply(null, args); //calls the callback with arguments args
  }
}.bind(CWEventManager);

CWModules.add('CWEventManager');
