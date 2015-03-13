/* global Connichiwa, CWSystemInfo */
'use strict';




/**
 * Constructs a new device with the given properties. **You should never
 *    constructor a CWDevice yourself**
 * @param {Object} properties The device's reported properties that will be
 *    part of the CWDevice
 * @constructor
 * 
 * @class CWDevice
 * @classdesc Represents a physical device. When the master device detects a
 *    device over Bluetooth, or when a device connects through a webbrowser, a
 *    CWDevice object is constructed. The object is then passed to your
 *    application through an event, for example {@link event:devicedetected}
 *    or {@link event:deviceconnected}. Your application can then use the
 *    CWDevice to get information about the device or to manipulate the
 *    device.
 *
 * When a device is detected over Bluetooth, the {@link event:devicedetected}
 *    event is raised and {@link CWDevice#isNearby} will return `true`. While
 *    the device is in Bluetooth range, {@link event:devicedistancechanged}
 *    events are send whenever the approximated distance of the device
 *    changes. That distance is then available via {@link
 *    CWDevice#getDistance}. When the device disables Bluetooth, moves out of
 *    range or in other ways stops being discoverable over Bluetooth a {@link
 *    event:devicelost} event is raised and {@link CWDevice#isNearby} returns
 *    `false`.
 *
 * In order to manipulate a remote device, it must connect through HTTP to our
 *    application. As long as the device has not done so, {@link
 *    CWDevice#isConnected} will return `false`. You can call {@link
 *    CWDevice#connect} to attempt to establish a connection. If the attempt
 *    is successful, the device is fully connected, a {@link
 *    event:deviceconnected} event is raised and {@link CWDevice#isConnected}
 *    returns `true`. If the device fails to connect, a {@link
 *    event:connectfailed} event is raised.
 *
 * Once a device is connected, it is ready to be used. CWDevice offers a
 *    number of functions to manipulate the device, such as {@link
 *    CWDevice#loadScript} or {@link CWDevice#insert}.
 *
 * A connected device can also receive custom messages. Messages can be sent
 *    to a device using {@link CWDevice#send}. The device can react to such
 *    messages by registering for message events using {@link
 *    Connichiwa.onMessage}.
 *
 * CWDevice further offers a number of information about the device, such as
 *    the unique identifier, name or distance. Note that none of that
 *    information is guaranteed to be present, except {@link
 *    CWDevice#getIdentifier}.
 *
 * **IMPORTANT**: **You should never construct a CWDevice yourself**. CWDevice
 *    objects represent a physical device detected by the Connichiwa framework
 *    and are handed to your application through events such as {@link
 *    event:devicedetected} or {@link event:deviceconnected}. 
 */
function CWDevice(properties)
{
  if (!properties.identifier) {
    throw 'Cannot instantiate CWDevice without an identifier';
  }

  /**
   * A UUID string that uniquely identifies this device
   * @type {String}
   * @private
   */
  this._identifier = properties.identifier;

  /**
   * The current Bluetooth discovery state of the device
   * @type {CWDevice.DiscoveryState}
   * @private
   */
  this._discoveryState = CWDevice.DiscoveryState.LOST;

  /**
   * The current HTTP connection state of the device
   * @type {CWDevice.ConnectionState}
   * @private
   */
  this._connectionState = CWDevice.ConnectionState.DISCONNECTED;

  /**
   * The current approximated distance between this device and the master
   *    device. For devices without Bluetooth or devices where the distance
   *    can not be approximated, this returns -1
   * @type {Number}
   * @private
   */
  this._distance = -1;

  /**
   * The date when this device launched the application
   * @type {Date}
   * @private
   */
  this._launchDate = Date.now() / 1000.0;

  /**
   * An array of IPs this device advertises its applications over
   * @type {Array}
   * @private
   */
  this._ips = [];

  /**
   * The port the device's webserver runs on. undefined when the device does
   *    not run a webserver
   * @type {Number}
   * @private
   */
  this._port = undefined;

  /**
   * The canonical name of the device, or "remote device" if the name is
   *    unknown
   * @type {String}
   * @private
   */
  this._name = 'remote device';

  /**
   * The approximated PPI of the device's display
   * @type {Number}
   * @private
   */
  this._ppi = CWSystemInfo.DEFAULT_PPI;

  if (properties.launchDate) this._launchDate = properties.launchDate;
  if (properties.ips) this._ips = properties.ips;
  if (properties.port) this._port = properties.port;
  if (properties.name) this._name = properties.name;
  if (properties.ppi && properties.ppi > 0) this._ppi = properties.ppi;
}


//
// STATE
// 

/**
 * Indicates whether the CWDevice instance represents the current device
 * @return {Boolean}  true if the CWDevice is the current device, otherwise
 *    false
 */
CWDevice.prototype.isLocal = function() {
  return this.equalTo(Connichiwa.getLocalDevice());
};


/**
 * Indicates if the device is in Bluetooth range
 * @return {Boolean} true if the device is reachable over Bluetooth, otherwise
 *    false
 */
CWDevice.prototype.isNearby = function() {
  return (this.discoveryState === CWDevice.DiscoveryState.DISCOVERED);
};


/**
 * Indicates if a connection can be established using a Bluetooth handshake.
 *    If this method returns false, a call to {@link CWDevice.connect} will
 *    have no effect.
 * @return {Boolean} true if the device can be connected, otherwise false
 * @private
 */
CWDevice.prototype._canBeConnected = function() { 
  return (this.connectionState === CWDevice.ConnectionState.DISCONNECTED && 
    this.discoveryState === CWDevice.DiscoveryState.DISCOVERED);
};


/**
 * Indicates whether this device is currently connected to the master device
 *    over HTTP and Websocket. The device is only usable as a remote device if
 *    this returns true. Otherwise, calls such as {@link CWDevice#insert} will
 *    have no effect.
 * @return {Boolean} true if the device is fully connected, otherwise false
 */
CWDevice.prototype.isConnected = function() {
  return (this.connectionState === CWDevice.ConnectionState.CONNECTED);
};


//
// DEVICE COMMUNICATION
// 


/**
 * Inserts the given HTML, jQuery element or DOM element into the given target
 *    element on the device. This will have no effect if the device is not
 *    connected.
 * @param  {String|HTMLElement|jQuery} target  The target element(s) on the
 *    device to insert into. This can be either a CSS selector or a DOM or
 *    jQuery element. If it is one of the latter two, this method will search
 *    for an element with the same ID on the remote device.
 * @param  {String|HTMLElement|jQuery} html The HTML that will be inserted
 *    into the device's DOM. Can be either plain HTML as a string or a DOM or
 *    jQuery element, in which case the element will be cloned and send to the
 *    other device.
 */
CWDevice.prototype.insert = function(target, html) {
  Connichiwa.insert(this.getIdentifier(), target, html);
};


/**
 * Replaces the given target element with the given piece of HTML code, jQuery
 *    element or DOM element on the device. Note that this will replace the
 *    entire target node, not only its content. For replacing only a node's
 *    content use {@link CWDevice#replaceContent}. This will have no effect if
 *    the device is not connected.
 * @param  {String|HTMLElement|jQuery} target The target element(s) on the
 *    remote device that will be replaced. This can be either a CSS selector
 *    or a DOM or jQuery element. If it is one of the latter two, this method
 *    will search for an element with the same ID on the remote device.
 * @param  {String|HTMLElement|jQuery} html The HTML that will replace the
 *    target node in the device's DOM. Can be either plain HTML as a string or
 *    a DOM or jQuery element, in which case the element will be cloned and
 *    send to the other device.
 */
CWDevice.prototype.replace = function(target, html) {
  Connichiwa.replace(this.getIdentifier(), target, html);
};


/**
 * Replaces the given target element's content with the given piece of HTML
 *    code, jQuery element or DOM element on the device. Note that this will
 *    replace the node's content, to replace the entire node use {@link
 *    CWDevice#replace} instead. This will have no effect if the device is not
 *    connected.
 * @param  {String|HTMLElement|jQuery} target The target element(s) on the
 *    remote device whos content will be replaced. This can be either a CSS
 *    selector or a DOM or jQuery element. If it is one of the latter two,
 *    this method will search for an element with the same ID on the remote
 *    device.
 * @param  {String|HTMLElement|jQuery} html The HTML that will replace the
 *    target node's content in the device's DOM. Can be either plain HTML as a
 *    string or a DOM or jQuery element, in which case the element will be
 *    cloned and send to the other device.
 */
CWDevice.prototype.replaceContent = function(target, html) {
  Connichiwa.replaceContent(this.getIdentifier(), target, html);
};


/**
 * Loads the JavaScript file at the given URL on the remote device and
 *    executes it. The optional callback will be called after the script was
 *    loaded
 * @param  {String}   url An URL to a valid JavaScript file
 * @param  {Function} [callback] A callback function that will be called after
 *    the JavaScript file was loaded and executed on the remote device
 */
CWDevice.prototype.loadScript = function(url, callback) {
  Connichiwa.loadScript(this.getIdentifier(), url, callback);
};


/**
 * Loads the CSS file at the given URL on the remote device and inserts it
 *    into the DOM.
 * @param  {String}   url An URL to a valid CSS file
 */
CWDevice.prototype.loadCSS = function(url) {
  Connichiwa.loadCSS(this.getIdentifier(), url);
};


/**
 * Sends a custom message with the given name to the device. The message
 *    itself must be an object that can be serialized using JSON.stringify.
 *    Also note that the message may not contain keys beginning with an
 *    underscore, as these are reserved by Connichiwa. The message will be
 *    sent to the device using a websocket connection and will trigger a
 *    message event with the given name on the other device. The remote device
 *    can react to messages using {@link Connichiwa.onMessage}.
 * @param  {String} name The message's name. A message event with this name
 *    will be triggered on the remote device.
 * @param  {Object} message An object that can be serialized using
 *    JSON.stringify. The object may not contain keys starting with an
 *    underscore. The message will be passed to the message event on the
 *    remote device.
 */
CWDevice.prototype.send = function(name, message) {
  Connichiwa.send(this.getIdentifier(), name, message);
};


/**
 * Checks if the given object is equal to this device. Two devices are equal
 *    if they describe the same physical device.
 * @param  {Object} object The object to check
 * @return {Boolean} true if the object describes the same device as this
 *    CWDevice, otherwise false
 */
CWDevice.prototype.equalTo = function(object) {
  if (CWDevice.prototype.isPrototypeOf(object) === false) return false;
  return this.getIdentifier() === object.getIdentifier();
};


/**
 * Returns a unique string representation of this device
 * @returns {String} The string representation of this device
 */
CWDevice.prototype.toString = function() {
  return this.getIdentifier();
};

/**
 * Returns the unique identifier of the device, which is a v4 UUID
 * @return {String} The unique identifier of the device
 */
CWDevice.prototype.getIdentifier = function() { 
  return this._identifier; 
};


/**
 * Returns the approximated distance between the master device and this device
 * @return {Number} The approximated distance or `-1` when the distance is not
 *    avialable
 */
CWDevice.prototype.getDistance = function() {
  return this._distance;
};


/**
 * Returns the date the device launched the web application
 * @return {Date} The Date the device launched the web application
 * @protected
 */
CWDevice.prototype.getLaunchDate = function() { 
  return this._launchDate; 
};


/**
 * Returns an array of possible IPs this device advertises the web application
 *    over
 * @return {Array} An array of IPs, each entry is a possible IP where the
 *    device's webserver is reachable
 * @protected
 */
CWDevice.prototype.getIPs = function() { 
  return this._ips; 
};


/**
 * Returns the port the device's webserver runs on
 * @return {Number} The port the device's webserver runs on or undefined when
 *    the port is unknown or the device does not run a webserver
 * @protected
 */
CWDevice.prototype.getPort = function() { 
  return this._port; 
};


/**
 * Returns the canonical name of the device
 * @return {String} The canonical name of the device or "remote device" if the
 *    name is unknown
 */
CWDevice.prototype.getName = function() { 
  return this._name; 
};


/**
 * Returns the approximated PPI of the device's display
 * @return {Number} The approximated PPI of the device's display. Depending on
 *    the available information about the device, this can be exact or just an
 *    approximation
 */
CWDevice.prototype.getPPI = function() { 
  return this._ppi; 
};

/**
 * Specifies the Bluetooth discovery state between a CWDevice and the master
 *    device
 * @enum String
 * @readOnly
 * @private
 */
CWDevice.DiscoveryState = {
  /**
   * Specifies the master device has discovered the CWDevice over Bluetooth
   * @type {String}
   */
  DISCOVERED: 'discovered',
  /**
   * Specifies the master device cannot find the CWDevice over Bluetooth
   * @type {String}
   */
  LOST: 'lost'
};


/**
 * Specifies the connection state between a CWDevice and the master device
 * @enum String
 * @readOnly
 * @private
 */
CWDevice.ConnectionState = {
  /**
   * Specifies the CWDevice has disconnected from the master
   * @type {String}
   */
  DISCONNECTED: 'disconnected',
  /**
   * Specifies the CWDevice is currently establishing a connection to the
   *    master
   * @type {String}
   */
  CONNECTING: 'connecting',
  /**
   * Specifies the CWDevice is successfully connected to the master and can
   *    receive messages.
   * @type {String}
   */
  CONNECTED: 'connected'
};
