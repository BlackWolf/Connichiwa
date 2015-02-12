"use strict";



/**
 * Gives us some nice debug convenience functions
 *
 * @namespace CWDebug
 */
var CWDebug = (function()
{
  /**
   * true if debug mode is on, otherwise false
   */
  var debug = true;

  var enableDebug = function() {
    debug = true;
  };


  var disableDebug = function() {
    debug = false;
  };

  /**
   * Logs a message to the console if debug mode is on
   *
   * @param {int} priority The priority of the message. Messages with lower priority are printed at lower debug states.
   * @param {string} message the message to log
   *
   * @memberof CWDebug
   */
  var log = function(priority, message)
  {
    // if (priority > 3) return;
    if (debug) console.log(priority + "|" + message);
  };

  var err = function(priority, message) {
    if (debug) console.err(priority + "|" + message);
  };

  return {
    enableDebug  : enableDebug,
    disableDebug : disableDebug,
    log          : log,
    err          : err
  };
})();
