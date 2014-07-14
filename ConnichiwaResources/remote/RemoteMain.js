/* global CRDebug, CRURLParser, CRMasterCommunicationParser */
/* global nativeCallWebsocketDidOpen, nativeCallSoftDisconnect, nativeCallWebsocketDidClose */
"use strict";



var Remote = (function() 
{
  var _parsedURL = new CRURLParser(document.URL);
  var _websocket;
  var softDisconnected = false;

  var _connectWebsocket = function()
  {
    //If we replace the websocket (or re-connect) we don't want to call onWebsocketClose
    //Therefore, first cleanup, then close
    var oldWebsocket = _websocket;
    _cleanupWebsocket();    
    if (oldWebsocket !== undefined) oldWebsocket.close();

    _websocket = new WebSocket("ws://" + _parsedURL.hostname + ":" + (parseInt(_parsedURL.port) + 1));
    _websocket.onopen = onWebsocketOpen;
    _websocket.onmessage = onWebsocketMessage;
    _websocket.onclose = onWebsocketClose;
    _websocket.onerror = onWebsocketError;
  };


  var _disconnectWebsocket = function()
  {
    _websocket.close();
  };


  var _softDisconnectWebsocket = function()
  {
    softDisconnected = true;
    nativeCallSoftDisconnect();
  };


  function _cleanupWebsocket()
  {
    if (_websocket !== undefined) 
    {
      _websocket.onopen = undefined;
      _websocket.onmessage = undefined;
      _websocket.onclose = undefined;
      _websocket.onerror = undefined;
      _websocket = undefined;
    }
  }


  var onWebsocketOpen = function()
  {
    CRDebug.log(3, "Websocket opened");
    softDisconnected = false;
    nativeCallWebsocketDidOpen();
  };


  var onWebsocketMessage = function(e)
  {
    var message = e.data;
    CRMasterCommunicationParser.parse(message);
  };


  var onWebsocketClose = function()
  {
    CRDebug.log(3, "Websocket closed");
    _cleanupWebsocket();
    nativeCallWebsocketDidClose();
  };


  var onWebsocketError = function()
  {
    onWebsocketClose();
  };


  var _send = function(message)
  {
    CRDebug.log(4, "Sending message: " + message);
    _websocket.send(message);
  };


  var send = function(messageObject)
  {
    _send(JSON.stringify(messageObject));
  };


  return {
    _connectWebsocket        : _connectWebsocket,
    _softDisconnectWebsocket : _softDisconnectWebsocket,
    send                     : send
  };
})();
