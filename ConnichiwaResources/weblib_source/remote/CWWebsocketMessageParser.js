/* global Connichiwa, CWEventManager, CWDebug, CWModules */
'use strict';


var CWWebsocketMessageParser = CWModules.retrieve('CWWebsocketMessageParser');

/**
 * (Available on remote devices only)
 *
 * Parses a message from the Websocket on the remote device and calls the
 *    appropiate sub-parse message. Also see {@link
 *    CWWebsocketMessageParser.parse}
 * @param  {Object} message  The object that represents the JSON message that
 *    was received from the websocket
 * @function
 * @protected
 */
CWWebsocketMessageParser.parseOnRemote = function(message) {
  var promise;
  switch (message._name) {
    case '_debuginfo'      : promise = this._parseDebugInfo(message); break;
    case '_softdisconnect' : promise = this._parseSoftDisconnect(message); break;
  }

  return promise;
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseDebugInfo = function(message) {
  CWDebug._setDebugInfo(message);
  return new $.Deferred().resolve();
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseSoftDisconnect = function(message) {
  Connichiwa._softDisconnectWebsocket();
  return new $.Deferred().resolve();
}.bind(CWWebsocketMessageParser);

CWModules.add('CWWebsocketMessageParser');
