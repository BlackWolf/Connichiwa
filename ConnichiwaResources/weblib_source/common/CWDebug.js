/* global CWModules */
'use strict';



/**
 *
 * @typedef DebugInfo
 * @type Object
 * @property {Boolean} debug  A boolean that determines if debugging is
 *    enabled or disabled
 * @property {Number} logLevel  A log level, see {@link CWDebug.setLogLevel}
 * @memberOf CWDebug
 */



/**
 * Used for debugging in Connichiwa. Debug messages can be easily enabled or
 *    disabled using {@link CWDebug.setDebug}. The level of logging can be set
 *    using {@link CWDebug.setLogLevel} to control which messages are logged.
 *
 * To log messages, use either the {@link CWDebug.log} or {@link CWDebug.err}
 *    methods.
 *
 * **IMPORTANT**: By default, debug and logLevel are set to the debug and logLevel
 *    of the native application. So if debugging is enabled natively and a
 *    logLevel of 3 is set, your web application will reflect that. You can,
 *    however, change the defaults in {@link Connichiwa.event:onLoad}.
 * @namespace CWDebug
 */
var CWDebug = CWModules.retrieve('CWDebug');


/**
 * Enables or disables debug logging
 * @type {Boolean}
 * @default false
 * @private
 */
CWDebug._debug = false;


/**
 * The current log level, see {@link CWDebug.setLogLevel}
 * @type {Number}
 * @default 0
 * @private
 */
CWDebug._logLevel = 0;


/**
 * Initializes CWDebug
 * @function
 * @private
 */
CWDebug.__constructor = function() {
  //We don't want to run Ractive in debug mode
  //TODO: We might want to think about if Ractive.DEBUG should be set to
  //CWDebug._debug
  Ractive.DEBUG = false;
};


/**
 * Sets the current debug settings with a single object
 * @param {CWDebug.DebugInfo} info The object containing the new debug
 *    information
 * @function
 * @private
 */
CWDebug._setDebugInfo = function(info) {
  if (info.debug)    CWDebug.setDebug(info.debug);
  if (info.logLevel) CWDebug.setLogLevel(info.logLevel);
};


/**
 * Returns an object that represents the current debug information
 * @return {CWDebug.DebugInfo} An object that contains information about the
 *    current debug settings
 * @function
 * @private
 */
CWDebug._getDebugInfo = function() {
  return { debug: this._debug, logLevel: this._logLevel };
};


/**
 * The main logging function. Use this function to log a debug message with
 *    the given log level. If the currently set log level is equal or higher
 *    than the message's level, it will be logged, otherwise it will be
 *    ignored.
 * @param  {Number} level  The log level of the message
 * @param  {String} msg The log message. This message will be logged using
 *    console.log(). If the current page is run on a device using a
 *    Connichiwa-based application, the log will be redirected to the IDE's
 *    log output
 * @function
 */
CWDebug.log = function(level, msg) {
  if (console === undefined) return;

  if (this._debug && level <= this._logLevel) {
    console.log(level + '|' + msg);
  }
};


/**
 * Logs the given message as an error
 * @param  {String} msg The error message that should be logged
 * @function
 */
CWDebug.err = function(msg) {
  if (console === undefined) return;

  if (this._debug) {
    if (console.err)        console.err(msg);
    else if (console.error) console.error(msg);
    else                    console.log("ERROR: "+msg);
  }
};

/**
 * Enables or disables debugging output
 * @param {Boolean} v True if debugging logs should be enabled, otherwise
 *    false
 * @function
 */
CWDebug.setDebug = function(v) {
  this._debug = v;
};

/**
 * Sets the log level. Can be a number from 0 to 5, whereas 0 means that no
 *    logging will occur, and 5 means that everything will be logged. The
 *    higher the logging level, the more "spammy" log messages will be
 *    permitted.
 * @param {Number} v The new log level
 * @function
 */
CWDebug.setLogLevel = function(v) {
  this._logLevel = v;
};
