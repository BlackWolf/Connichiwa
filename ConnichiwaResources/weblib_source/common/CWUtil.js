"use strict";



/**
 * A utility class giving us some often needed utility functions.
 *
 * @namespace CWUtil
 */
var CWUtil = (function()
{
  var parseURL = function(url) 
  {
    var parser = document.createElement("a");
    parser.href = url;

    return parser;
  };


  var getEventLocation = function(e, type) 
  {
    if (type === undefined) type = "page";

    var seen = [];
    var pos = { x: e[type + "X"], y: e[type + "Y"] };
    if (pos.x === undefined || pos.y === undefined)
    {
      var touches = (e.originalEvent === undefined) ? e.targetTouches : e.originalEvent.targetTouches;
      pos = { x: touches[0][type + "X"], y: touches[0][type + "Y"] };
    }

    return pos;
  };


  var randomInt = function(min, max) {
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
   * Checks if the given parameter is an Int.
   *
   * @param {object} value A value to check
   * @returns {boolean} true if the given value is an Int, otherwise false
   *
   * @memberof CWUtil
   */
  var isInt = function(value)
  {
    return (value === parseInt(value));
  };


  var isString = function(value) {
    return (typeof(value) === "string");
  };


  /**
   * Checks if the given parameter is an object and not null.
   *
   * @param {object} value A value to check
   * @returns {boolean} true if the given value is an object, otherwise false
   *
   * @memberof CWUtil
   */
  var isObject = function(value)
  {
    return (typeof(value) === "object" && value !== null);
  };


  /**
   * Checks if the given value is in the given array.
   *
   * @param {object} value The value to check
   * @param {array} array The array that the value should be in
   * @returns {boolean} true if value is in array, otherwise false
   *
   * @memberof CWUtil
   */
  var inArray = function(value, array)
  {
    return (array.indexOf(value) > -1);
  };

  //Crazy small code to create UUIDs - cudos to https://gist.github.com/jed/982883
  var createUUID = function(a) { 
    return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,CWUtil.createUUID);
  };


  return {
    parseURL         : parseURL,
    getEventLocation : getEventLocation,
    randomInt        : randomInt,
    isInt            : isInt,
    isString         : isString,
    isObject         : isObject,
    inArray          : inArray,
    createUUID       : createUUID
  };
})();
