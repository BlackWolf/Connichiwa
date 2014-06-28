"use strict";



//Parse URL
var ParsedURL = (function()
{
  var parser = document.createElement("a");
  parser.href = document.URL;
  
  return parser;
})();



var QueryString = (function() 
{
  var _queryString = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    // If first entry with this name
    if (typeof _queryString[pair[0]] === "undefined") 
    {
      _queryString[pair[0]] = pair[1];
    // If second entry with this name
    } 
    else if (typeof _queryString[pair[0]] === "string") 
    {
      var arr = [ _queryString[pair[0]], pair[1] ];
      _queryString[pair[0]] = arr;
      // If third or later entry with this name
    } 
    else 
    {
      _queryString[pair[0]].push(pair[1]);
    }
  }
   
  return _queryString;
})();

var websocket = new WebSocket("ws://" + ParsedURL.hostname + ":" + (parseInt(ParsedURL.port) + 1));

websocket.onopen = function()
{
  var data = { type: "didconnect", identifier: QueryString.identifier };
  websocket.send(JSON.stringify(data));
    native_websocketDidOpen();
};


websocket.onmessage = function(e)
{
  var message = e.data;
  log("message: " + message);
  
  var object = JSON.parse(message);
  
  if (object.type === "show")
  {
    $("body").append(object.content);
  }
  
  if (object.type === "update")
  {
    $(object.element).html(object.content);
  }
};


websocket.onerror = function()
{
    alert("websocket error");
};


websocket.onclose = function()
{
    native_websocketDidClose();
};

function disconnect()
{
  websocket.close();
}


//////////
// MISC //
//////////


function log(message)
{
  console.log(getDateString() + " -- " + message);
}

function getDateString(date)
{
  if (date === undefined) date = new Date();

  var hours = String(date.getHours());
  hours = (hours.length === 1) ? "0" + hours : hours;

  var minutes = String(date.getMinutes());
  minutes = (minutes.length === 1) ? "0" + minutes : minutes;

  var seconds = String(date.getSeconds());
  seconds = (seconds.length === 1) ? "0" + seconds : seconds;

  var milliseconds = String(date.getMilliseconds());
  milliseconds = (milliseconds.length === 1) ? "00" + milliseconds : milliseconds;
  milliseconds = (milliseconds.length === 2) ? "0" + milliseconds : milliseconds;

  return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}
