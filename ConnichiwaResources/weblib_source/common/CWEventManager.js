/* global CWDebug */
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
  var _events = {};

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

    if (!_events[event]) _events[event] = [];
    _events[event].push(callback);
    CWDebug.log(3, "Attached callback to " + event);
  };

  /**
   * Triggers the given events, calling all callback functions that have registered for the event.
   *
   * @param {string} event The name of the event to trigger
   *
   * @memberof CWEventManager
   */
  var trigger = function(event)
  {
    CWDebug.log(4, "Triggering event " + event);

    if (!_events[event]) { CWDebug.log(1, "No callbacks registered"); return; }

    //Get all arguments passed to trigger() and remove the event
    var args = Array.prototype.slice.call(arguments);
    args.shift();

    for (var i = 0; i < _events[event].length; i++)
    {
      //TODO
      //This is a dirty hack to see if a requestAnimationFrame
      //around a message callback will prevent crashes
      //We need a cleaner solution in case this works
      var callback = _events[event][i];
      // if (event.indexOf("message") === 0) {
        // window.requestAnimationFrame(function() {
          // callback.apply(null, args);
        // });
      // } else {
        callback.apply(null, args); //calls the callback with arguments args
      // }
    }
  };

  return {
    register : register,
    trigger  : trigger
  };
})();
