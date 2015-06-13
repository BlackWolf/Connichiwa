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
var CWEventManager = CWModules.retrieve('CWEventManager');


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
  if (CWUtil.isString(event) === false) throw 'Event name must be a string';
  if (CWUtil.isFunction(callback) === false) throw 'Event callback must be a function';

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
 * Removes all callbacks from the given event. No callbacks for that event
 *    will be triggered anymore.
 * @param  {String}   eventName The event name to remove events from.
 * @function
 * @protected
 *//**
 * Removes the given callback from every possible event. The callback will
 *    not be triggered anymore.
 * @param  {Function} callback  The callback to remove. This function will be
 *    removed from every event it has been registered for.
 * @function
 * @protected
 *//**
 * Removes the given callback from the given event. The
 *    callback will not be triggered for that event anymore.
 * @param  {String}   eventName The event to remove the callback from
 * @param  {Function} callback  The callback function to remove
 * @function
 * @protected
 */
CWEventManager.unregister = function(event, callback) {
  //If .unregister() is called within an event callback, we would unregister
  //an event that is currently looped over by .trigger()
  //Therefore, move .unregister() to the next run loop
  var that = this;
  window.setTimeout(function() {
    if (callback === undefined) {
      if (CWUtil.isFunction(event)) {
        //Only callback was given
        callback = event;
        event = undefined;
      }
    }

    if (event !== undefined) {
      event = event.toLowerCase();

      //Event can be a space-seperated list of event names
      if (event.indexOf(' ') !== -1) {
        var events = event.split(' ');
        for (var i = 0; i < events.length; i++) {
          CWEventManager.unregister(events[i], callback);
        }
        return;
      }

      if (callback === undefined) {
        //If only an event was given, we remove all callbacks from this event
        if (event in that._callbacks) {
          that._callbacks[event] = undefined;
          CWDebug.log(3, 'Detached ALL callbacks from ' + event);
        }
        return;
      } else {
        //If an event and a callback were given, only the given callback attached to
        //the given event will be removed
        if (event in that._callbacks) {
          var i = 0;
          $.each(that._callbacks[event], function(index, value) {
            if (value === callback) {
              that._callbacks[event].splice(index, 1);
              i++;
            }
          });
          CWDebug.log(3, 'Detached ' + i + ' callbacks from ' + event);
          return;
        }
      }
    }

    //If only a callback was given, we search through all events and remove all
    //callbacks with the given function
    if (event === undefined && callback !== undefined) {
      $.each(that._callbacks, function(eventName) {
        var i = 0;
        $.each(that._callbacks[eventName], function(index, value) {
          if (value === callback) {
            that._callbacks[eventName].splice(index, 1);
            i++;
          }
        });

        CWDebug.log(3, 'Detached ' + i + ' callbacks from ' + eventName);
      });
    }
  }, 0);
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
