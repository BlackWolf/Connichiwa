/* global Connichiwa, CWEventManager, CWTemplates, CWDatastore, CWDebug, CWModules */
"use strict";



/**
 * Parses messages from the websocket. All messages received should be handed
 *    to the {@link CWWebsocketMessageParser.parse} method. If the message is
 *    a system message, this method will handle the message appropiately.
 * @namespace  CWWebsocketMessageParser
 * @protected
 */
var CWWebsocketMessageParser = CWWebsocketMessageParser || {};


/**
 * Parses a message from the Websocket and calls the appropiate sub-parse
 *    method based on the `_name` property of the object. If the `_name` is
 *    unknown, this method does nothing.
 * @param  {Object} message  The object that represents the JSON message that
 *    was received from the websocket
 * @function
 * @protected
 */
CWWebsocketMessageParser.parse = function(message) {
  switch (message._name) {
    case "_chunk"             : this._parseChunk(message);             break;
    case "_ack"               : this._parseAck(message);               break;
    case "_insert"            : this._parseInsert(message);            break;
    case "_replace"           : this._parseReplace(message);           break;
    case "_loadscript"        : this._parseLoadScript(message);        break;
    case "_loadcss"           : this._parseLoadCSS(message);           break;
    case "_loadtemplate"      : this._parseLoadTemplate(message);      break;
    case "_inserttemplate"    : this._parseInsertTemplate(message);    break;
    case "_wasstitched"       : this._parseWasStitched(message);       break;
    case "_wasunstitched"     : this._parseWasUnstitched(message);     break;
    case "_gotstitchneighbor" : this._parseGotStitchNeighbor(message); break;
    case "_updatedatastore"   : this._parseUpdateDatastore(message);   break;
  }

  return true;
}.bind(CWWebsocketMessageParser);


/**
 * Parses `_ack` messages. Such messages are sent as acknowledgement for
 *    receiving a message.
 * @param  {Object} message The message from the websocket
 * @fires __ack_message{ID}
 * @function
 * @private
 */
CWWebsocketMessageParser._parseAck = function(message) {
  CWEventManager.trigger("__ack_message" + message.original._id);
}.bind(CWWebsocketMessageParser);


/**
 * Parses `_insert` messages. Such messages contain HTML code that should be
 *    inserted on this device's DOM and a target DOM element to insert into.
 *    On failure, this does nothing.
 * @param  {Object} message The message from the websocket
 * @function
 * @private
 */
CWWebsocketMessageParser._parseInsert = function(message) {
  $(message.selector).append(message.html);
}.bind(CWWebsocketMessageParser);


/**
 * Parses `_replace` messages. Such messages contain HTML code and a DOM
 *    element that should be replaced with the HTML code. On failure, does
 *    nothing.
 * @param  {Object} message The message from the websocket
 * @function
 * @private
 */
CWWebsocketMessageParser._parseReplace = function(message) {
  if (message.contentOnly === true) {
    $(message.selector).html(message.html);
  } else {
    $(message.selector).replaceWith(message.html);
  }
}.bind(CWWebsocketMessageParser);


/**
 * Parses `_loadScript` messages. Such messages contain the path to a
 *    JavaScript on the server side that will be loaded. An acknowledgement
 *    will be sent to the other device after the script loaded.
 * @param  {Object} message The message from the websocket
 * @function
 * @private
 */
CWWebsocketMessageParser._parseLoadScript = function(message) {
  var that = this;
  $.getScript(message.url).done(function() {
    Connichiwa._sendAck(message);
  }).fail(function(f, s, t) {
    CWDebug.err(1, "There was an error loading '" + message.url + "': " + t);
  });
}.bind(CWWebsocketMessageParser);


/**
 * Parses `_loadCSS` messages. Such messages contain HTML the path to a CSS
 *    file on the server side that will be loaded. An acknowledgment will be
 *    sent to the other device after the file loaded.
 * @param  {Object} message The message from the websocket
 * @function
 * @private
 */
CWWebsocketMessageParser._parseLoadCSS = function(message) {
  var cssEntry = document.createElement("link");
  cssEntry.setAttribute("rel", "stylesheet");
  cssEntry.setAttribute("type", "text/css");
  cssEntry.setAttribute("href", message.url);
  $("head").append(cssEntry);
  Connichiwa._sendAck(message);
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseLoadTemplate = function(message) {
  CWTemplates.load(message.paths);
};


CWWebsocketMessageParser._parseInsertTemplate = function(message) {
  CWTemplates.insert(message.templateName, message.target, message.data, function() {
    Connichiwa._sendAck(message);
  });
};


/**
 * Parses `_wasStitched` messages. Such messages are sent when this device was
 *    stitched to another device.
 * @param  {Object} message The message from the websocket
 * @fires wasStitched
 * @function
 * @private
 */
CWWebsocketMessageParser._parseWasStitched = function(message) {
  CWEventManager.trigger("wasStitched", message);
}.bind(CWWebsocketMessageParser);


/**
 * Parses `_wasUnstitched` messages. Such messages are sent when this device
 *    was previously stitched and now loses its stiching.
 * @param  {Object} message The message from the websocket
 * @fires wasUntitched
 * @function
 * @private
 */
CWWebsocketMessageParser._parseWasUnstitched = function(message) {
  CWEventManager.trigger("wasUnstitched", message);
}.bind(CWWebsocketMessageParser);


/**
 * Parses `_gotStitchneighbor` messages. Such messages are sent when this
 *    device was previously stitched and now used by another device to
 *    determine the other devices relative position.
 * @param  {Object} message The message from the websocket
 * @fires gotstitchneighbor
 * @function
 * @private
 */
CWWebsocketMessageParser._parseGotStitchNeighbor = function(message) {
  CWEventManager.trigger("gotstitchneighbor", message);
}.bind(CWWebsocketMessageParser);


/**
 * Parses `_updateDatastore` messages. Such messages are sent when another
 *    device sends us datastore content that needs to be synced to this device
 * @param  {Object} message The message from the websocket
 * @function
 * @private
 */
CWWebsocketMessageParser._parseUpdateDatastore = function(message) {
  //message.data contains datastore collections
  //Walk over every collection
  $.each(message.data, function(collection, collectionContent) {
    CWDatastore._set(collection, collectionContent, false);
    //Walk over every entry of the collection
    //
    // $.each(collectionContent, function(key, value) {
      //TODO this triggers an update event for every single key
      //maybe we can find a nice bulk update way of doing this?
      // CWDatastore._set(collection, key, value, false);
    // });
  });
}.bind(CWWebsocketMessageParser);

CWModules.add('CWWebsocketMessageParser');
