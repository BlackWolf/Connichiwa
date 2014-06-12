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


  return {
    isInt    : isInt,
    isObject : isObject
  };
})();
