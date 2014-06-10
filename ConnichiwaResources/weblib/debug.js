"use strict";

function Debug()
{
  return null;
}

Debug.log = function(message)
{
  console.log("WEBLIB    "+Debug.getDateString()+" -- "+message);
};

Debug.getDateString = function(date)
{
  if (date === undefined) date = new Date();

  var hours = date.getHours();
  hours = (hours.length === 1) ? "0"+hours : hours;

  var minutes = date.getMinutes();
  minutes = (minutes.length === 1) ? "0"+minutes : minutes;

  var seconds = date.getSeconds();
  seconds = (seconds.length === 1) ? "0"+seconds : seconds;

  var milliseconds = date.getMilliseconds();
  milliseconds = (milliseconds.length === 1) ? "00"+milliseconds : milliseconds;
  milliseconds = (milliseconds.length === 2) ? "0"+milliseconds : milliseconds;

  return hours+":"+minutes+":"+seconds+"."+milliseconds;
};
