"use strict";



var CWUtil = (function()
{
  var isInt = function(value)
  {
    return (value === parseInt(value));
  };


  var isObject = function(obj)
  {
    return (typeof(obj) === "object" && obj !== null);
  };


  var inArray = function(value, array)
  {
    return (array.indexOf(value) > -1);
  };


  return {
    isInt    : isInt,
    isObject : isObject,
    inArray  : inArray
  };
})();
