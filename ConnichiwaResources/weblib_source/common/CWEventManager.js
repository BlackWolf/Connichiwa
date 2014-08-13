/* global CWUtil, CWDebug */
"use strict";



/**
 * Manages events throughout Connichiwa. Allows all parts of Connichiwa to register for and trigger events.
 *
 * @namespace CWEventManager
 */
var CWEventManager = (function()
{
  /**
   * A dictionary where each entry represents a single event. The key is the event name. Each entry of the dictionary is an array of callbacks that should be called when the event is triggered.
   */
  var _callbacks = {};

  /**
   * Registers the given callback function for the given event. When the event is triggered, the callback will be executed.
   *
   * @param {string} event The name of the event
   * @param {function} callback The callback function to call when the event is triggered
   *
   * @memberof CWEventManager
   */
  var register = function(event, callback)
  {
    if (typeof(event) !== "string") throw "Event name must be a string";
    if (typeof(callback) !== "function") throw "Event callback must be a function";

    //event can be a space-seperated list of event names
    if (event.indexOf(" ") !== -1) {
      var events = event.split(" ");
      for (var i = 0; i < events.length; i++) {
        CWEventManager.register(events[i], callback);
      }
    }

    if (!_callbacks[event]) _callbacks[event] = [];
    _callbacks[event].push(callback);
    CWDebug.log(3, "Attached callback to " + event);
  };

  /**
   * Triggers the given events, calling all callback functions that have registered for the event.
   *
   * @param {string} event The name of the event to trigger
   *
   * @memberof CWEventManager
   */
  var trigger = function(logPrio, event)
  {
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
    

    if (!_callbacks[event]) { 
      CWDebug.log(5, "No callbacks  for " + event + " registered"); 
      return; 
    }

    CWDebug.log(logPrio, "Triggering event " + event + " for "+_callbacks[event].length + " callbacks");
    for (var i = 0; i < _callbacks[event].length; i++)
    {
      var callback = _callbacks[event][i];
      callback.apply(null, args); //calls the callback with arguments args
    }
  };

  return {
    register : register,
    trigger  : trigger
  };
})();
