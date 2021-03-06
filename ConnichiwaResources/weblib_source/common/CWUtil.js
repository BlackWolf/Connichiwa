/*global CWModules */
'use strict';



/**
 * Utility module providing often-needed utility functions
 * @namespace CWUtil
 */
var CWUtil = CWModules.retrieve('CWUtil');

/**
 * Returns an object that parses the given URL into its parts
 * @param  {String} url  The URL to parse, must be a valid URL
 * @return {URL} A parsed URL object where the different parts of the URL can
 *    be accessed
 * @function
 */
CWUtil.parseURL = function(url) {
  var parser = document.createElement('a');
  parser.href = url;

  return parser;
};


/**
 * Returns the given string, replacing HTML entities with their HTML
 *    counterparts (e.g. `&lt` with `<`)
 * @param  {String} escaped A safe HTML string
 * @return {String} The input string with unescaped HTML entities 
 * @function       
 */
CWUtil.unescape = function(escaped) {
  return escaped.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
};


/**
 * Returns the coordinate of a given mouse event or the first touch in a touch
 *    event
 * @param  {TouchEvent|MouseEvent|jQuery.Event} e     A valid mouse or touch
 *    event or a jQuery event wrapping such an event. Note that events
 *    resulting from a "touchend" are not considered valid, as they do not
 *    contain any touches
 * @param  {String} [type="page"] A string representing the type of locarion
 *    that should be returned. Can be either "page", "client" or "screen". See
 *    [Touch Documentation]{@link
 *    https://developer.mozilla.org/en-US/docs/Web/API/Touch} or [MouseEvent
 *    Documentation]{@link
 *    https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent}
 * @return {Point}  The coordinate of the event
 * @function
 */
CWUtil.getEventLocation = function(e, type) {
  if (type === undefined) type = 'page';

  var seen = [];
  var pos = { x: e[type + 'X'], y: e[type + 'Y'] };
  if (pos.x === undefined || pos.y === undefined)
  {
    var touches = (e.originalEvent === undefined) ? e.targetTouches : e.originalEvent.targetTouches;
    pos = { x: touches[0][type + 'X'], y: touches[0][type + 'Y'] };
  }

  return pos;
};


/**
 * Returns a random integer between min (inclusive) and max (inclusive). If
 *    only one parameter is given, returns a random number between 0 and that
 *    number. If no parameters are given, returns a random number between 0
 *    and Number.MAX_VALUE
 * @param  {Number} [min=0] The smallest possible value that is returned
 * @param  {Number} [max=Number.MAX_VALUE] The largest possible value that is
 *    returned
 * @return {Number} The generated random number between min and max
 * @function
 */
CWUtil.randomInt = function(min, max) {
  //Only one parameter was given, use it as max, 0 as min
  if (max === undefined && min !== undefined) {
    max = min;
    min = 0;
  //No parameter was given, use 0 as min, maxint as max
  } else if (max === undefined && min === undefined) {
    min = 0;
    max = Number.MAX_VALUE;
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
};


/**
 * Checks if the given object is a valid Int
 * @param {Object} value  The object to check
 * @returns {Boolean}  true if the given value is an Int, otherwise false
 * @function
 */
CWUtil.isInt = function(value) {
  return (value === parseInt(value));
};


/**
 * Checks if the given object is a valid String
 * @param  {Object}  value  The object to check
 * @return {Boolean} true if the given value is a String, otherwise false
 * @function
 */
CWUtil.isString = function(value) {
  return (typeof(value) === 'string');
};


/**
 * Checks if the given object is a function
 * @param  {Object}  value The object to check
 * @return {Boolean} true if the given value is a function, otherwise false
 * @function
 */
CWUtil.isFunction = function(value) {
  return (typeof(value) === 'function');
};


/**
 * Checks if the given object is an object and not null.
 * @param {Object} value  The object to check
 * @returns {Boolean}   true if the given object is an object, false otherwise
 *    (e.g. for null, undefined or a primitive type).
 * @function
 */
CWUtil.isObject = function(value) {
  return (typeof(value) === 'object' && value !== null);
};


/**
 * Checks if the given object is an array
 * @param  {Object}  value The object to checl
 * @return {Boolean} true if the given object is an array, otherwise false
 * @function
 */
CWUtil.isArray = function(value) {
  return Array.isArray(value);
};

/**
 * Checks if the given value is in the given array.
 * @param {object} value The value to check
 * @param {array} array The array that the value should be in
 * @returns {boolean} true if value is in array, otherwise false
 * @function
 */
CWUtil.inArray = function(value, array) {
  return (array.indexOf(value) > -1);
};

/**
 * Creates a new random v4 UUID, thanks to {@link
 *    https://gist.github.com/jed/982883}
 * @return {String} A random v4 UUID string
 * @function
 * @protected
 */
CWUtil.createUUID = function(a) { 
  return a?(a ^ Math.random() * 16 >> a / 4).toString(16):([ 1e7 ] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g,CWUtil.createUUID);
};
