/* global CWEventManager, CWDevice, CWNativeBridge, CWUtil, CWDebug */
'use strict';



/**
 * Connichiwa's main interface. Most of a web applications use of Connichiwa
 *    will go through this interface. It allows the web application to
 *    register for events, send messages, get information about this device
 *    and other devices and more
 * @namespace Connichiwa
 */
var Connichiwa = Connichiwa || {};


/**
 * The websocket connection to the websocket server running on the master
 *    device
 * @type {WebSocket}
 * @private
 */
Connichiwa._websocket = undefined;


/**
 * Returns the {@link CWDevice} instance that represents the current device
 * @return {CWDevice} The {@link CWDevice} instance that represents this
 *    device
 * @function
 */
Connichiwa.getLocalDevice = function() { /* ABSTRACT */ };


/**
 * Returns the unique identifier of this device
 * @return {String} A v4 UUID as a string, uniquely identifies this device
 * @function
 */
Connichiwa.getIdentifier = function() { /* ABSTRACT */ };


/**
 * Determines if the current device is the master device
 * @return {Boolean} true if this device is the master device, otherwise false
 * @function
 */
Connichiwa.isMaster = function() { /* ABSTRACT */ };


/**
 * Connects to the websocket server of the master
 * @function
 * @private
 */
Connichiwa._connectWebsocket = function() { /* ABSTRACT */ };


/**
 * Called when the websocket connection was successfully established
 * @function
 * @private
 */
Connichiwa._onWebsocketOpen = function() { /* ABSTRACT */ };


/**
 * Called whenever a message arrives through the websocket
 * @function
 * @private
 */
Connichiwa._onWebsocketMessage = function(e) { /* ABSTRACT */ };


/**
 * Called when the websocket connection is closed either by the server or by
 *    the client. Can also indicate the server went offline.
 * @function
 * @private
 */
Connichiwa._onWebsocketClose = function(e) { /* ABSTRACT */ };


/**
 * Called when an error occurs on the websocket
 * @function
 * @private
 */
Connichiwa._onWebsocketError = function() { /* ABSTRACT */ };


/**
 * Initializes Connichiwa. Must be called on load.
 * @function
 * @private
 */
Connichiwa.__constructor = function() {
  //If no native layer runs in the background, we have to take care of 
  //establishing a connection ourselves
  if (CWNativeBridge.isRunningNative() !== true) {
    this._connectWebsocket();
  }
}.bind(Connichiwa);


/**
 * Registers a callback for a Connichiwa system event. A number of such events
 *    exist (e.g. {@link event:devicedetected} or {@link
 *    event:deviceconnected}). See the event documentation for details. These
 *    events are triggered by the framework. Registering multiple functions
 *    for the same event will invoke all those functions whenever the event is
 *    triggered
 * @param  {String}   eventName The name of the event to register for. Must
 *    match one of the documented system events, otherwise this method will do
 *    nothing
 * @param  {Function} callback  The callback function that will be invoked
 *    whenever the event is triggered
 * @function
 */
Connichiwa.on = function(eventName, callback) {
  //We can't use the normal event system for the load event, so
  //forward it
  if (eventName === 'load') {
    this.onLoad(callback);
    return;
  } 
  
  CWEventManager.register(eventName, callback);
}.bind(Connichiwa);


/**
 * Register a callback for a custom message. The given callback will be
 *    invoked whenever a custom message with the given name (sent using {@link
 *    Connichiwa.send} or {@link CWDevice#send}) is received on this device.
 *    The received message will be passed to the callback
 * @param  {String}   name     The message to register for. Whenever a message
 *    with this name is received, the callback will be called
 * @param  {Function} callback The callback to invoke when a message with the
 *    given name is received
 * @function
 */
Connichiwa.onMessage = function(name, callback) {
  this.on('message' + name, callback);
}.bind(Connichiwa);


/**
 * Register a callback to be invoked once Connichiwa is ready. The callback
 *    can be sure that the Connichiwa library is fully loaded and initialized.
 *    Also, all scripts passed to {@link Connichiwa.autoLoad} are ensured to
 *    have been loaded. Most Connichiwa-related code should be wrapped by this
 *    function. If this method is called after Connichiwa is ready, the
 *    callback will be invoked on the next run loop.
 * @param  {Function} callback The callback to invoke once Connichiwa is ready 
 * @function
 */
Connichiwa.onLoad = function(callback) {
  if (document.readyState === 'complete') {
    //Timeout so the callback is always called asynchronously
    window.setTimeout(callback, 0);
  } else {
    Connichiwa.on('ready', callback);
  }
}.bind(Connichiwa);


// DEVICE COMMUNICATION API


Connichiwa.insert = function(identifier, target, html) {
  //With two args, we handle them as identifier and html
  //target is assumed as the body
  if (html === undefined) {
    html = target;
    target = 'body';
  }

  //target should be a selector but can also be a DOM or jQuery element
  //If so, we try to get it by its ID on the other side
  if (CWUtil.isObject(target)) {
    target = $(target);
    target = '#' + target.attr('id');
  }
  
  //html can be a DOM or jQuery element - if so, send the outerHTML including 
  //all styles
  if (CWUtil.isObject(html) === true) {
    var el = $(html);
    var clone = el.clone();
    clone[0].style.cssText = el[0].style.cssText; //TODO really needed?
    html = clone[0].outerHTML;
  }

  //identifier can also be a CWDevice
  if (CWDevice.prototype.isPrototypeOf(identifier)) {
    identifier = identifier.getIdentifier();
  }

  var message = {
    selector : target,
    html     : html
  };
  this.send(identifier, '_insert', message);
}.bind(Connichiwa);

Connichiwa.replace = function(identifier, target, html) {
  //With two args, we handle them as identifier and html
  //target is assumed as the body
  if (html === undefined) {
    html = target;
    target = 'body';
  }

  this._replace(identifier, target, html, false);
}.bind(Connichiwa);

Connichiwa.replaceContent = function(identifier, target, html) {
  //With two args, we handle them as identifier and html
  //target is assumed as the body
  if (html === undefined) {
    html = target;
    target = 'body';
  }

  this._replace(identifier, target, html, true);
}.bind(Connichiwa);

Connichiwa._replace = function(identifier, target, html, contentOnly) {
  //With two args, we handle them as identifier and html
  //target is assumed as the body
  if (html === undefined) {
    html = target;
    target = 'body';
  }

  //target should be a selector but can also be a DOM or jQuery element
  //If so, we try to get it by its ID on the other side
  if (CWUtil.isObject(target)) {
    target = '#' + $(target).attr('id');
  }
  
  //html can be a DOM or jQuery element - if so, send the outerHTML including 
  //all styles
  if (CWUtil.isObject(html) === true) {
    var el = $(html);
    var clone = el.clone();
    clone[0].style.cssText = el[0].style.cssText; //TODO really needed?
    html = clone[0].outerHTML;
  }

  //identifier can also be a CWDevice
  if (CWDevice.prototype.isPrototypeOf(identifier)) {
    identifier = identifier.getIdentifier();
  }

  var message = {
    selector    : target,
    html        : html,
    contentOnly : contentOnly,
  };
  this.send(identifier, '_replace', message);
}.bind(Connichiwa);


Connichiwa.loadScript = function(identifier, url, callback) {
  var message = { url  : url }.bind(Connichiwa);
  var messageID = this.send(identifier, '_loadscript', message);

  if (callback !== undefined) {
    this.on('__ack_message' + messageID, callback);
  }
}.bind(Connichiwa);

Connichiwa.loadCSS = function(identifier, url) {
  var message = { url  : url };
  var messageID = this.send(identifier, '_loadcss', message);
}.bind(Connichiwa);


Connichiwa.send = function(target, name, message) {
  if (message === undefined) {
    message = target;
    target = 'master';
  }

  if (CWDevice.prototype.isPrototypeOf(target)) {
    target = target.getIdentifier();
  }

  message._name = name;
  message._source = this.getIdentifier();
  message._target = target;
  return this._sendObject(message);
}.bind(Connichiwa);


/**
 * Responds to a given message. This will send the given response to the
 *    device where the given originalMessage originated from
 * @param  {Object} originalMessage The message to respond to
 * @param  {String} name            The message name of the response
 * @param  {Object} responseObject  The message to send to the device where
 *    originalMessage was sent from. Can be any object that is serializable
 *    using `JSON.stringify`
 * @function
 * @protected
 */
Connichiwa.respond = function(originalMessage, name, responseObject) {
  this.send(originalMessage._source, name, responseObject);
}.bind(Connichiwa);


/**
 * Broadcasts a given message to all other devices (and, if requested, also to
 *    this device). The message will have the given name and therefore trigger
 *    all callback functions that were registered for this name using {@link
 *    Connichiwa.onMessage}
 * @param  {String} name       The name of the message
 * @param  {Object} message    The message content. Can be any object that is
 *    serializable using `JSON.stringify`
 * @param  {Boolean} [sendToSelf=false] Set to true to make sure this message
 *    is also delivered to the device where it is sent from, which will
 *    trigger any registered callbacks for the message
 * @function
 */
Connichiwa.broadcast = function(name, message, sendToSelf) {
  if (sendToSelf) {
    message._broadcastToSource = true;
  }
  
  this.send('broadcast', name, message);
}.bind(Connichiwa);


/**
 * Sends an acknowledgement message (with name `_ack`) back to the device
 *    where the given message originated from. The given message will be
 *    attached to the acknowledgement and sent back as well.
 * @param  {Object} message A valid message object that was received from a
 *    device
 * @function
 * @private
 */
Connichiwa._sendAck = function(message) {
  var ackMessage = { original : message };
  this.send(message._source, '_ack', ackMessage);
}.bind(Connichiwa);


/**
 * The main, internal send method where all message sendings will sooner or
 *    later end up. This will prepare the message object, serialize it and
 *    send it via the websocket. The message must at least have a `_name` key,
 *    otherwise this method will log an error and not send the message
 * @param  {Object} message The message object to send
 * @return {Number} The random ID that was assigned to the message
 * @function
 * @private
 */
Connichiwa._sendObject = function(message) {
  if (('_name' in message) === false) {
    CWDebug.err('Tried to send message without _name, ignoring: ' + JSON.stringify(message));
    return;
  }

  message._id = CWUtil.randomInt(0, 9999999999); 
  message._name = message._name.toLowerCase();

  var messageString = JSON.stringify(message);
  CWDebug.log(4, 'Sending message: ' + messageString);

  //If the message is too long, chunk it in pieces of 2^15 bytes
  //We need to do that because some browser (Safari *cough*) can't
  //really handle messages that are very large.
  //We chunk the messages by framing the message with another message
  // if (messageString.length > 32700) {
  //   var pos = 0;
  //   while (pos < messageString.length) { 
  //     var chunkMessage = {
  //       _id        : CWUtil.randomInt(0, 9999999999),
  //       _name      : "_chunk",
  //       _source    : message._source,
  //       _target    : message._target,
  //       originalID : message._id,
  //       payload    : "",
  //       isFinal    : 0,
  //     };
  //     chunkMessage.payload = messageString.substr(pos, 32700);

  //     var length = JSON.stringify(chunkMessage).length;
  //     var overload = 0;
  //     if (length > 32700) {
  //       overload = length - 32700;
  //       chunkMessage.payload = chunkMessage.payload.substr(0, 32700-overload);
  //     }
  //     chunkMessage.isFinal = (pos+(32700 - overload)>=messageString.length) ? 1 : 0;

  //     CWDebug.log(1, "Sending chunk of size "+JSON.stringify(chunkMessage).length);
  //     //Once again, we need a setTimeout to lower the possibility of a crash on iOS
  //     window.setTimeout(function() { this._websocket.send(JSON.stringify(message)); }.bind(this), 0);

  //     pos += 32700 - overload;
  //     CWDebug.log(1, "Pos is now "+pos+"/"+messageString.length);
  //   }
  // } else {
    //Once again, we need a setTimeout to lower the possibility of a crash on iOS
    this._websocket.send(messageString);
  // }

  return message._id;
}.bind(Connichiwa);



/**
 * Closes the websocket connection
 * @function
 * @private
 */
Connichiwa._disconnectWebsocket = function() {
  this._websocket.close();
}.bind(Connichiwa);


/**
 * Makes sure all websocket events are not called again and sets the websocket
 *    object to `undefined`
 * @function
 * @private
 */
Connichiwa._cleanupWebsocket = function() {
  if (this._websocket !== undefined) {
    this._websocket.onopen    = undefined;
    this._websocket.onmessage = undefined;
    this._websocket.onclose   = undefined;
    this._websocket.onerror   = undefined;
    this._websocket           = undefined;
  }
}.bind(Connichiwa);
