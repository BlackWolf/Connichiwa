/* global CWEventManager, CWDebug */
'use strict';


var CWWebsocketMessageParser = CWWebsocketMessageParser || {};

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
  switch (message._name) {
    case "_debuginfo"      : this._parseDebugInfo(message); break;
    case "_softdisconnect" : this._parseSoftDisconnect(message); break;
  }
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseDebugInfo = function(message) {
  CWDebug._setDebugInfo(message);
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseSoftDisconnect = function(message) {
  Connichiwa.package.Connichiwa._softDisconnectWebsocket();
}.bind(CWWebsocketMessageParser);
