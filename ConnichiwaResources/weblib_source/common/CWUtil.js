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

    var pos = { x: e[type+"X"], y: e[type+"Y"] };
    if (pos.x === undefined || pos.y === undefined)
    {
      pos = { x: e.originalEvent.targetTouches[0][type+"X"], y: e.originalEvent.targetTouches[0][type+"Y"] };
    }

    return pos;
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


  return {
    parseURL : parseURL,
    getEventLocation : getEventLocation,
    isInt    : isInt,
    isObject : isObject,
    inArray  : inArray
  };
})();