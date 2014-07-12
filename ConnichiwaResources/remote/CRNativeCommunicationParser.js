/* global Remote, CRDebug */
"use strict";



var CRNativeCommunicationParser = (function()
{
  var parse = function(message)
  {
    CRDebug.log(4, "Parsing native message: " + message);
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "connectwebsocket": _parseConnectWebsocket(object); break;
      case "cwdebug": _parseDebug(object); break;
      case "remoteidentifier": _parseRemoteIdentifier(object); break;
      case "disconnectwebsocket": _parseDisconnectWebsocket(object); break;
    }
  };


  var _parseConnectWebsocket = function(message)
  {
    Remote._connectWebsocket();
  };


  var _parseDebug = function(message)
  {
    CRDebug.enableDebug();
  };


  var _parseRemoteIdentifier = function(message) 
  {
    var data = { type: "remoteidentifier", identifier: message.identifier };
    Remote.send(data);
  };

  var _parseDisconnectWebsocket = function(message)
  {
    Remote._disconnectWebsocket();  
  };

  return {
    parse : parse
  };
})();
