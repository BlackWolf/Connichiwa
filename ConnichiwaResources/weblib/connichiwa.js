/* global CWNativeBridge */
'use strict';

var CWModules = {};

CWModules._modules = [];
CWModules._didInit = false;

CWModules.add = function(module) {
  if (this._modules.indexOf(module) !== -1) return;

  this._modules.push(module);
}.bind(CWModules);

CWModules.init = function() {
  if (this._didInit) throw 'Cannot initialize modules twice';

  //We need to setTimeout the initialization to make sure that everything
  //is set up
  var that = this;
  window.setTimeout(function() {
    for (var i = 0; i < that._modules.length; i++) {
      var module = that._modules[i];
      console.log('Initializing module ' + module + '...');
      if (window[module].__constructor) window[module].__constructor();
    }  

    CWNativeBridge.callOnNative("nativeCallLibraryDidLoad");
  }, 0);

  this._didInit = true;
}.bind(CWModules);
/* global Connichiwa, CWEventManager, CWUtil, CWDebug */
'use strict';


/**
 * Cross-device data store in Connichiwa
 *
 * CWDatastore allows you to create *collections* of data and store arbitrary
 *    key-value pairs in these collections. Data stored in the CWDatastore is
 *    synchronized across all your devices. This provides you with a quick way
 *    of sharing data between all your devices.
 *
 * Storing data is simply done through {@link CWDatastore.set}, which will
 *    trigger a sync of the newly stored data to all your devices. The data
 *    can then be retrieved on any device using {@link CWDatastore.get}.
 *
 * CWDatastore also takes care of synchronizing the datastore to newly
 *    connected devices.
 *
 * Please note that data is sent to other devices using `JSON.stringify()`.
 *    Therefore you should only store data that can be serialized by this
 *    method. For example, you can **not** store functions in the data store.
 * @namespace CWDatastore
 */
var CWDatastore = CWDatastore || {};

/**
 * The datastores stored data :-)
 * @type {Object}
 * @private
 */
CWDatastore._data = {};


/**
 * Initializes CWDatastore, such as registering for events
 * @function
 * @private
 */
CWDatastore.__constructor = function() {
  //When a new device connects, we sync the entire data store to it so it
  //has all the latest data. 
  Connichiwa.on('deviceconnected', function(device) {
    CWDebug.log(3, 'Syncing entire datastore to connected device');
    CWDatastore._syncStoreToDevice(device.getIdentifier());
  });
}.bind(CWDatastore);


/**
 * Stores or updates the given key/value pairs in the given collection
 * @param {String} [collection] The collection to write to. If no collection
 *    is provided, a default collection will be used. Collection names may not
 *    start with an underscore.
 * @param {Object} dict An object containing key/value pairs. All of these
 *    will be stored in the given collection. Existing entries will be
 *    overwritten.
 * @function
 *//**
 * Stores or updates the given key/value pair in the given collection
 * @param {String} [collection] The collection to write to. If no collection
 *    is provided, a default collection will be used. Collection names may not
 *    start with an underscore.
 * @param {String} key The key under which the value will be stored in
 *    the collection
 * @param {Object} value The value to store. Must be an object or value
 *    that can be converted to JSON. May not be a function or `undefined`.
 * @function
 */
CWDatastore.set = function(collection, key, value) {
  //2 args: collection was omitted
  //exception: (collection, dictionary) - here, value was omitted
  // if (value === undefined && CWUtil.isObject(key) === false) {
  //   value = key;
  //   key = collection;
  //   collection = undefined;
  // }
  // 
  if (value === undefined) {
    value = key;
    key = collection;
    collection = '_default';
  }

  this._set(collection, key, value, true, false);
}.bind(CWDatastore);


CWDatastore.setMultiple = function(collection, dict) {
  if (dict === undefined) {
    //Args: dict
    dict = collection;
    collection = '_default';
  }

  CWDatastore._set(collection, dict, undefined, true, true);
}.bind(CWDatastore);


/**
 * Stores or updates the given key/value pair in the given collection. The
 *    `sync` parameter allows to suppress syncing to other devices.
 * @param {String} [collection] The collection to write to. If no collection
 *    is provided, a default collection will be used. Collection names may not
 *    start with an underscore.
 * @param {Object} dict An object containing key/value pairs. All of these
 *    will be stored in the given collection. Existing entries will be
 *    overwritten.
 * @param {Boolean} sync=true Determines whether the newly stored value is
 *    synced to other devices. Should almost always be `true`, the only
 *    exception is if we store a value that we received from another device
 *    (to prevent a sync loop)
 * @function
 * @private
 *//**
 * Stores or updates the given key/value pair in the given collection. The
 *    `sync` parameter allows to suppress syncing to other devices.
 * @param {String} [collection] The collection to write to. If no collection
 *    is provided, a default collection will be used. Collection names may not
 *    start with an underscore.
 * @param {String} key The key under which the value will be stored in the
 *    collection
 * @param {Object} value The value to store. Must be an object or value that
 *    can be converted to JSON. May not be a function or `undefined`.
 * @param {Boolean} sync Determines whether the newly stored value is
 *    synced to other devices. Should almost always be `true`, the only
 *    exception is if we store a value that we received from another device
 *    (to prevent a sync loop)
 * @function
 * @protected
 */
CWDatastore._set = function(collection, key, value, sync, isDict) {  
  //Create collection if it doesn't exist
  if ((collection in this._data) === false) {
    this._data[collection] = {};
  }

  //Create a dictionary of the changes we need to make to the datastore
  var keyValues;
  if (isDict) {
    keyValues = key;
  } else {
    //User provided key and new value
    keyValues = {};
    keyValues[key] = value; 
  }

  var that = this;
  var reportedChanges = {};
  $.each(keyValues, function(keyToSet, valueToSet) {
    if (CWUtil.isFunction(valueToSet)) {
      CWDebug.err('Attempted to store function in CWDatastore (collection: ' + collection + ', key: ' + key + '). This is invalid and will be ignored.');
      return true;
    }
    var oldValue = that._data[collection][keyToSet];
    that._data[collection][keyToSet] = valueToSet;
    reportedChanges[keyToSet] = {old: oldValue, new: valueToSet};
  });

  //Synchronize all changes between devices
  //The only reason to surpress this is when we received an update from another
  //device (to prevent an update loop)
  if (sync) {
    this._syncEntrys(collection, Object.keys(reportedChanges));
  }

  var reportedCollection = (collection === '_default') ? undefined : collection;
  CWEventManager.trigger('_datastorechanged', reportedCollection, reportedChanges);
}.bind(CWDatastore);


/**
 * Retrieves the current value of the given key in the given collection
 * @param  {String} [collection] The collection to retrieve from. If omitted,
 *    will retrieve from the default collection.
 * @param  {String} key The key to retrieve
 * @return {Object} The current value of the given key in the given
 *    collection. If the collection does not exist or the key does not exist
 *    in that collection, returns `undefined`.
 * @function 
 */
CWDatastore.get = function(collection, key) {
  //If only 1 argument was given, colletion was omitted and defaults to _default
  if (key === undefined) {
    key = collection;
    collection = '_default';
  }

  if (collection in this._data === false || 
    key in this._data[collection] === false) {
    return undefined;
  }

  return this._data[collection][key];
}.bind(CWDatastore);


/**
 * Retrieves a copy of a collection
 * @param  {String} [collection] The collection to retrieve. If omitted,
 *    returns the default collection.
 * @return {Object} An object of key/value pairs, each representing one entry
 *    in the collection. This is a copy of the original data.
 * @function
 */
CWDatastore.getCollection = function(collection) {
  return this._getCollection(collection, true);
}.bind(CWDatastore);


/**
 * Retrieves a collection from the store. The optional `returnCopy` parameter
 *    determines if a copy is returned.
 * @param  {String} collection The collection to retrieve. If omitted, returns
 *    the default collection.
 * @param  {Boolean} [returnCopy=true] Determines if a copy of the collection
 *    is returned. Usually, only copies should be returned, as returning the
 *    original collection allows code to write directly to the collection
 *    without using {@link CWDatastore.set}. Only set this to `false` if you
 *    are absolutely sure that you use the collection read-only.
 * @return {Object} An object of key/value pairs, each representing one entry
 *    in the collection. 
 * @function
 * @private
 */
CWDatastore._getCollection = function(collection, returnCopy) {
  if (collection === undefined) collection = '_default';
  if (returnCopy === undefined) returnCopy = true;

  //Create collection if it doesn't exist
  if ((collection in this._data) === false) {
    this._data[collection] = {};
  }

  if (returnCopy === false) return this._data[collection]
  return $.extend(true, {}, this._data[collection]);
}.bind(CWDatastore);


/**
 * Syncs the entries represented by the given keys in the given collection to
 *    all other currently connected devices.
 * @param  {String} [collection] The collection where the entry is stored. If
 *    omitted, will use the default collection.
 * @param  {Array} keys An array of keys. Each key will be retrieved from the
 *    given collection and synchronized. If a key cannot be found in the given
 *    collection, it is ignored.
 * @function
 * @private
 *//**
 * Syncs the entry represented by the given key in the given collection to all
 *    other currently connected devices.
 * @param  {String} [collection] The collection where the entry is stored. If
 *    omitted, will use the default collection.
 * @param  {String} key They key to retrieve from the collection. If the key
 *    does not exist in the collection, this method will do nothing.
 * @function
 * @private
 */
CWDatastore._syncEntrys = function(collection, keys) {
  var syncData = {};
  syncData[collection] = {};

  //keys can be an array of keys. If it isnt, make it an array of one key
  if (CWUtil.isArray(keys) === false) keys = [ keys ];
  
  //Walk over the keys to sync, get their current value and write it to the
  //data that will be sent to other devices
  var that = this;
  $.each(keys, function(index, key) {
    var value = that.get(collection, key);
    if (value !== undefined) {
      syncData[collection][key] = value;
    }
  }); 

  Connichiwa.broadcast('_updatedatastore', { data: syncData });
}.bind(CWDatastore);

/**
 * Syncs the entire data store (all collections) to another device. This
 *    method potentially produces a large websocket message **and should be
 *    used with CAUTION!**
 * @param  {String} target A unique device identifies as returned by {@link
 *    CWDevice#getIdentifier}
 * @function
 * @protected
 */
CWDatastore._syncStoreToDevice = function(target) {
  Connichiwa.send(target, '_updatedatastore', { data: this._data });
}.bind(CWDatastore);
/* global CWModules */
'use strict';



/**
 *
 * @typedef DebugInfo
 * @type Object
 * @property {Boolean} debug  A boolean that determines if debugging is
 *    enabled or disabled
 * @property {Number} logLevel  A log level, see {@link CWDebug.setLogLevel}
 * @memberOf CWDebug
 */



/**
 * Used for debugging in Connichiwa. Debug messages can be easily enabled or
 *    disabled using {@link CWDebug.setDebug}. The level of logging can be set
 *    using {@link CWDebug.setLogLevel} to control which messages are logged.
 *
 * To log messages, use either the {@link CWDebug.log} or {@link CWDebug.err}
 *    methods.
 *
 * **IMPORTANT**: By default, debug and logLevel are set to the debug and logLevel
 *    of the native application. So if debugging is enabled natively and a
 *    logLevel of 3 is set, your web application will reflect that. You can,
 *    however, change the defaults in {@link Connichiwa.event:onLoad}.
 * @namespace CWDebug
 */
var CWDebug = CWDebug || {};


/**
 * Enables or disables debug logging
 * @type {Boolean}
 * @default [taken from native application]
 * @private
 */
CWDebug._debug = false;


/**
 * The current log level, see {@link CWDebug.setLogLevel}
 * @type {Number}
 * @default [taken from native application]
 * @private
 */
CWDebug._logLevel = 0;


/**
 * Initializes CWDebug
 * @function
 * @private
 */
CWDebug.__constructor = function() {
  //We don't want to run Ractive in debug mode
  //TODO: We might want to think about if Ractive.DEBUG should be set to
  //CWDebug._debug
  Ractive.DEBUG = false;
}.bind(CWDebug);


/**
 * Sets the current debug settings with a single object
 * @param {CWDebug.DebugInfo} info The object containing the new debug
 *    information
 * @function
 * @private
 */
CWDebug._setDebugInfo = function(info) {
  if (info.debug)    CWDebug.setDebug(info.debug);
  if (info.logLevel) CWDebug.setLogLevel(info.logLevel);
}.bind(CWDebug);


/**
 * Returns an object that represents the current debug information
 * @return {CWDebug.DebugInfo} An object that contains information about the
 *    current debug settings
 * @function
 * @private
 */
CWDebug._getDebugInfo = function() {
  return { debug: this._debug, logLevel: this._logLevel };
}.bind(CWDebug);


/**
 * The main logging function. Use this function to log a debug message with
 *    the given log level. If the currently set log level is equal or higher
 *    than the message's level, it will be logged, otherwise it will be
 *    ignored.
 * @param  {Number} level  The log level of the message
 * @param  {String} msg The log message. This message will be logged using
 *    console.log(). If the current page is run on a device using a
 *    Connichiwa-based application, the log will be redirected to the IDE's
 *    log output
 * @function
 */
CWDebug.log = function(level, msg) {
  if (this._debug && level <= this._logLevel) {
    console.log(level + '|' + msg);
  }
}.bind(CWDebug);


/**
 * Logs the given message as an error
 * @param  {String} msg The error message that should be logged
 * @function
 */
CWDebug.err = function(msg) {
  if (this._debug) {
    console.err(msg);
  }
}.bind(CWDebug);

/**
 * Enables or disables debugging output
 * @param {Boolean} v True if debugging logs should be enabled, otherwise
 *    false
 * @function
 */
CWDebug.setDebug = function(v) {
  this._debug = v;
}.bind(CWDebug);

/**
 * Sets the log level. Can be a number from 0 to 5, whereas 0 means that no
 *    logging will occur, and 5 means that everything will be logged. The
 *    higher the logging level, the more "spammy" log messages will be
 *    permitted.
 * @param {Number} v The new log level
 * @function
 */
CWDebug.setLogLevel = function(v) {
  this._logLevel = v;
}.bind(CWDebug);

CWModules.add('CWDebug');
/* global Connichiwa, CWSystemInfo, CWUtil */
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
   * @protected
   */
  this._discoveryState = CWDevice.DiscoveryState.LOST;

  /**
   * The current HTTP connection state of the device
   * @type {CWDevice.ConnectionState}
   * @protected
   */
  this._connectionState = CWDevice.ConnectionState.DISCONNECTED;

  /**
   * The current approximated distance between this device and the master
   *    device. For devices without Bluetooth or devices where the distance
   *    can not be approximated, this returns -1
   * @type {Number}
   * @protected
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
  return (this._discoveryState === CWDevice.DiscoveryState.DISCOVERED);
};


/**
 * Indicates if a connection can be established using a Bluetooth handshake.
 *    If this method returns false, a call to {@link CWDevice.connect} will
 *    have no effect.
 * @return {Boolean} true if the device can be connected, otherwise false
 * @private
 */
CWDevice.prototype._canBeConnected = function() { 
  return (this._connectionState === CWDevice.ConnectionState.DISCONNECTED && 
    this._discoveryState === CWDevice.DiscoveryState.DISCOVERED);
};


/**
 * Indicates whether this device is currently connected to the master device
 *    over HTTP and Websocket. The device is only usable as a remote device if
 *    this returns true. Otherwise, calls such as {@link CWDevice#insert} will
 *    have no effect.
 * @return {Boolean} true if the device is fully connected, otherwise false
 */
CWDevice.prototype.isConnected = function() {
  return (this._connectionState === CWDevice.ConnectionState.CONNECTED);
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
  //With two args, we handle them as identifier and html
  //target is then assumed as the body
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

  var message = {
    selector : target,
    html     : html
  };
  this.send('_insert', message);
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
  this._replace(target, html, false);
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
  this._replace(target, html, true);
};


/**
 * Internal replace method, both {@link CWDevice#replace} and {@link
 *    CWDevice#replaceContent} forward to this method which does the actual
 *    replacement
 * @param  {String|HTMLElement|jQuery} target The target element(s) on the
 *    remote device whos content will be replaced. This can be either a CSS
 *    selector or a DOM or jQuery element. If it is one of the latter two,
 *    this method will search for an element with the same ID on the remote
 *    device.
 * @param  {String|HTMLElement|jQuery} html The HTML that will replace the
 *    target node's content in the device's DOM. Can be either plain HTML as a
 *    string or a DOM or jQuery element, in which case the element will be
 *    cloned and send to the other device.
 * @param  {Boolean} contentOnly If set to false, the entire target node(s)
 *    will be replaced, otherwise only the node's contents will be replaced
 * @private
 */
CWDevice.prototype._replace = function(target, html, contentOnly) {
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

  var message = {
    selector    : target,
    html        : html,
    contentOnly : contentOnly,
  };
  this.send('_replace', message);
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
  var message = { url : url };
  var messageID = this.send('_loadscript', message);

  if (callback !== undefined) {
    Connichiwa.on('__ack_message' + messageID, callback);
  }
};


/**
 * Loads the CSS file at the given URL on the remote device and inserts it
 *    into the DOM.
 * @param  {String}   url An URL to a valid CSS file
 */
CWDevice.prototype.loadCSS = function(url) {
  var message = { url  : url };
  this.send('_loadcss', message);
};


/**
 * Loads one or more files containing templates. Templates that have been
 *    loaded can then be inserted into the devices DOM using {@link
 *    CWDevice#insertTemplate}.
 * @param  {String|Array} paths The path to a template file or an array of
 *    paths. If one or more paths are invalid, that particular load will fail,
 *    but all other paths will still be loaded.
 * @function
 */
CWDevice.prototype.loadTemplates = function(paths) {
  var message = { paths: paths };
  this.send('_loadtemplate', message);
};


/**
 * Inserts the template with the given name into the remote device's DOM. The
 *    template will be inserted into the DOM object(s) with the given target
 *    selector and the template's data will be set to the given data object.
 *    An optional callback will be called after the template was inserted.
 *
 * Before a template can be inserted on a remote device, the file that
 *    contains the template **must** be loaded using {@link
 *    CWDevice#loadTemplates}.
 * @param  {String}   templateName The name of the template to load. The file
 *    that contains a template with this name must be loaded using {@link
 *    CWDevice#loadTemplates} before calling this method.
 * @param  {String}   target       A jQuery selector that points to a valid
 *    DOM object on the remote device (e.g. 'body'). The template will be
 *    inserted into this DOM element.
 * @param  {Object}   data         An arbitrary object of key-value pairs that
 *    will be handed to the template as the template's data. E.g. if the
 *    template contains an expression {{title}}, this expression will be
 *    replaced with the value of the 'title' entry in this object.
 * @param  {Function} callback     An optional callback function. This
 *    callback will be called after the template was inserted into the remote
 *    DOM. This means that within this callback, you can be sure the content
 *    of the template exists in the remote DOM.
 */
CWDevice.prototype.insertTemplate = function(templateName, target, data, callback) {
  var message = { templateName: templateName, target: target, data: data };
  var messageID = this.send('_inserttemplate', message);

  if (callback !== undefined) {
    Connichiwa.on('__ack_message' + messageID, callback);
  }
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
  message._name = name;
  message._source = Connichiwa.getIdentifier();
  message._target = this.getIdentifier();
  return Connichiwa._sendObject(message);
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
/* global CWUtil, CWDebug, CWModules */
'use strict';



/**
 * Manages event registration and triggering events throughout Connichiwa.
 *    This includes registration for system events (such as {@link
 *    Connichiwa.deviceDetected}) and registration for custom messages from
 *    other devices. This manager is also used to trigger events, which will
 *    then call every callback that was registered for the event.
 * @namespace  CWEventManager
 * @protected
 */
var CWEventManager = CWEventManager || {};


/**
 * The currently registered callbacks. The keys in this dictionary are event
 *    names, the values are arrays of callbacks registered for the event.
 * @type {Object}
 * @private
 */
CWEventManager._callbacks = {};


/**
 * Registers the given callback for the given event. If an event with the
 *    given name is triggered, the callback will be executed.
 * @param  {String}   event    The name of the event to register for
 * @param  {Function} callback The callback function that will be invoked if
 *    the event is triggered
 * @function
 * @protected
 */
CWEventManager.register = function(event, callback) {
  if (CWUtil.isString(event) === false) throw 'Event name must be a string';
  if (CWUtil.isFunction(callback) === false) throw 'Event callback must be a function';

  event = event.toLowerCase();

  //event can be a space-seperated list of event names
  if (event.indexOf(' ') !== -1) {
    var events = event.split(' ');
    for (var i = 0; i < events.length; i++) {
      CWEventManager.register(events[i], callback);
    }
    return;
  }

  if (!this._callbacks[event]) this._callbacks[event] = [];
  this._callbacks[event].push(callback);
  CWDebug.log(3, 'Attached callback to ' + event);
}.bind(CWEventManager);


/**
 * Triggers an event with the given name. All callback functions that were
 *    registered for that event using {@link CWEventManager.register} will be
 *    invoked. Any additional parameters passed to this function will be
 *    passed to the callbacks. The optional log priority determines the
 *    priority with which debug messages are logged. For events that occur
 *    regularly, this priority should be set to 5.
 * @param  {Number} [logPrio=4] Priority with which trigger-messages will be
 *    logged. Should be set to 5 for events that occur very frequently. Also
 *    see {@link CWDebug.setLogLevel}
 * @param  {String} event   The name of the event to trigger
 * @param  {...Mixed} [var_args] Any additional arguments will be passed to
 *    the callback functions
 * @function
 * @protected
 */
CWEventManager.trigger = function(logPrio, event, var_args) {
  //Get the arguments passed to trigger() without logPrio and event
  var args = Array.prototype.slice.call(arguments);
  if (CWUtil.isString(logPrio) === true) {
    //Only the event was given, default logPrio is used
    event = logPrio;
    logPrio = 4;
    args.shift();
  } else {
    //logPrio and event were given, remove both from args
    args.shift();
    args.shift();
  }

  event = event.toLowerCase();

  if (!this._callbacks[event]) { 
    CWDebug.log(5, 'No callbacks  for ' + event + ' registered'); 
    return; 
  }

  CWDebug.log(logPrio, 'Triggering event ' + event + ' for ' + this._callbacks[event].length + ' callbacks');
  for (var i = 0; i < this._callbacks[event].length; i++)
  {
    var callback = this._callbacks[event][i];
    callback.apply(null, args); //calls the callback with arguments args
  }
}.bind(CWEventManager);

CWModules.add('CWEventManager');
/* global CWEventManager, CWVector, CWUtil, CWDebug, CWModules */
'use strict';



/**
 * CWGestures is responsible for capturing gestures on DOM elements and
 *    passing the detected gestures on to other parts of the library. Right
 *    now, this is used to detect the pinch gesture used in device stitching
 * @namespace CWGestures
 * @private
 */
var CWGestures = CWGestures || {};


/**
 * The start location of the current touch
 * @type {Point}
 * @private
 */
CWGestures._touchStart = undefined;


/**
 * The last location of the current touch
 * @type {Point}
 * @private
 */
CWGestures._touchLast = undefined;


/**
 * The vector between the last touch location ({@link CWGestures._touchLast})
 *    and the touch before that. undefined if only one touch arrived so far
 * @type {CWVector}
 * @private
 */
CWGestures._touchLastVector = undefined;


/**
 * Determines if the current gesture qualifies for a potential swipe
 * @type {Boolean}
 * @private
 */
CWGestures._touchCheckable = false;

/**
 * If a direction change occurs during a swipe, the original swipe direction is
 *    stored in this property
 * @type {CWVector}
 * @private
 */
CWGestures._touchAngleReferenceVector = undefined;


/**
 * The number of touches that occured after a poential direction change
 * @type {Number}
 * @private
 */
CWGestures._touchAngleChangedCount = 0;


/**
 * Initializes the CWGestures object, should be called on application launch
 * @function
 * @private
 */
CWGestures.__constructor = function() {
  var that = this;
  $(document).ready(function() {
    that._captureOn($('body'));
  });
}.bind(CWGestures);


/**
 * Called when a touchstart or mousedown occurs on one of the monitored 
 * elements
 * @param  {Event} e The touch or mouse event that triggered the function
 * @function
 * @private
 */
CWGestures._onDown = function(e) {
  this._touchStart = CWUtil.getEventLocation(e, 'client');
}.bind(CWGestures);


/**
 * Called when a touchmove or mousemove occurs on one of the monitored 
 * elements
 * @param  {Event} e The touch or mouse event that triggered the function
 * @function
 * @private
 */
CWGestures._onMove = function(e) {
  if (this._touchStart === undefined) return;

  var newTouch = CWUtil.getEventLocation(e, 'client');

  //Just checking the swipe vector in _onEnd is not enough: If the finger 
  //changes direction and then returns the original direction, this would be
  //detected as a valid swipe. Therefore, we monitor for direction changes in
  //this method and cancel a swipe on a direction change.
  //Unfortunately, touches can "jitter", so we need to make sure that
  //small (or very short) direction changes don't cancel the swipe. Therefore, 
  //the original swipe direction is stored in _touchAngleReferenceVector and 
  //successive touches are checked against that vector. If the user resumes the
  //original direction within 3 touches, the swipe is still considered valid.
  //
  //Furthermore, we add some noise reduction by making sure the last finger 
  //vector has a minimum length of 2 and the entire swipe is at least 5 pixels 
  //in length
  if (this._touchLast !== undefined) {
    var totalTouchVector = new CWVector(this._touchStart, newTouch);
    var newTouchVector   = new CWVector(this._touchLast,  newTouch);

    this._touchCheckable = (this._touchCheckable || totalTouchVector.length() > 5);
    if (this._touchCheckable && newTouchVector.length() > 1) {

      //A previous touch was a direction change, compare with the saved
      //reference vector by calculating their angle
      if (this._touchAngleReferenceVector !== undefined) {
        var referenceTouchAngle = newTouchVector.angleBetween(this._touchAngleReferenceVector);
        if (referenceTouchAngle > 20) {
        // if (referenceTouchAngle > 30) {
          this._touchAngleChangedCount++;

          //This is a security measure against "jitter": Only if 3 successive
          //touches are a direction change do we invalidate the swipe
          if (this._touchAngleChangedCount === 3) {
            this._touchStart = undefined;
            this._touchLast  = undefined;
            return;
          }
        } else {
          this._touchAngleReferenceVector = undefined;
          this._touchAngleChangedCount = 0;
        }

      //Compare the current finger vector to the last finger vector and see
      //if the direction has changed by calculating their angle
      } else {
        if (this._touchLastVector !== undefined) {
          var newTouchAngle = newTouchVector.angleBetween(this._touchLastVector);
          if (newTouchAngle > 20) {
          // if (newTouchAngle > 30) {
            this._touchAngleReferenceVector = this._touchLastVector;
            this._touchAngleChangedCount = 1;
          }
        }
      }
    }

    if (newTouchVector.length() > 0) this._touchLastVector = newTouchVector;
  } 

  this._touchLast = newTouch;
}.bind(CWGestures);


/**
 * Called when a touchend or mouseup occurs on one of the monitored 
 * elements
 * @param  {Event} e The touch or mouse event that triggered the function
 * @function
 * @private
 */
CWGestures._onUp = function(e) {
  var swipeStart = this._touchStart;
  var swipeEnd   = this._touchLast;

  this._touchStart                = undefined;
  this._touchLast                 = undefined;
  this._touchLastVector           = undefined;
  this._touchCheckable            = false;
  this._touchAngleReferenceVector = undefined;
  this._touchAngleChangedCount    = 0;

  if (swipeStart === undefined || swipeEnd === undefined) return;

  var deltaX = swipeEnd.x - swipeStart.x;
  var deltaY = swipeEnd.y - swipeStart.y;

  //The swipe must have a minimum length to make sure its not a tap
  var swipeLength = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
  if (swipeLength <= 10) {
    CWDebug.log(3, 'Swipe REJECTED because it was too short (' + swipeLength + ')');
    return;
  }

  //Check the direction of the swipe
  //For example, if a swipe to the right is performed at y=10 we need this to
  //recognize this swipe as a right-swipe instead of a top-swipe
  //We check the deltaX to deltaY ratio to determine the direction
  //For very short swipes, this ratio can be worse because short swipes tend
  //to be less straight. For very short swipes we almost don't care anymore
  var xyRatio = 0.25;
  if (swipeLength < 100) xyRatio = 0.35; //short swipes tend to be less straight
  if (swipeLength < 50)  xyRatio = 0.4;
  if (swipeLength < 40)  xyRatio = 0.45;
  if (swipeLength < 15)  xyRatio = 0.8; //doesn't matter that much anymore
  // var xyRatio = 0.65;
  // if (swipeLength < 100) xyRatio = 0.75; //short swipes tend to be less straight
  // if (swipeLength < 50)  xyRatio = 0.85;
  // if (swipeLength < 40)  xyRatio = 0.95;
  // if (swipeLength < 15)  xyRatio = 0.95; //doesn't matter that much anymore

  var direction = "invalid";
  if (Math.abs(deltaY) < (Math.abs(deltaX) * xyRatio)) {
    if (deltaX > 0) direction = "right";
    if (deltaX < 0) direction = "left";
  }
  if (Math.abs(deltaX) < (Math.abs(deltaY) * xyRatio)) {
    if (deltaY > 0) direction = "down";
    if (deltaY < 0) direction = "up";
  }

  //Check if the touch ended at a device edge
  //Lucky us, touch coordinates incorporate rubber banding - this means that a swipe down with rubber banding
  //will give us smaller values than it should, because the gray top area is subtracted
  //Luckily, window.innerHeight incorporates rubber banding as well, so we can calculate the missing pixels
  var rubberBanding = $(window).height() - window.innerHeight;
  swipeEnd.y += rubberBanding;
  var endsAtTopEdge    = (swipeEnd.y <= 50);
  var endsAtLeftEdge   = (swipeEnd.x <= 50);
  var endsAtBottomEdge = (swipeEnd.y >= ($(window).height() - 50));
  var endsAtRightEdge  = (swipeEnd.x >= ($(window).width()  - 50));
  // var endsAtTopEdge    = (swipeEnd.y <= 100);
  // var endsAtLeftEdge   = (swipeEnd.x <= 100);
  // var endsAtBottomEdge = (swipeEnd.y >= ($(window).height() - 100));
  // var endsAtRightEdge  = (swipeEnd.x >= ($(window).width()  - 100));

  var edge = "invalid";
  if (endsAtTopEdge    && direction === "up")    edge = "top";
  if (endsAtLeftEdge   && direction === "left")  edge = "left";
  if (endsAtBottomEdge && direction === "down")  edge = "bottom";
  if (endsAtRightEdge  && direction === "right") edge = "right";

  if (edge === "invalid") {
    CWDebug.log(3, "Swipe REJECTED. Ending: x - " + swipeEnd.x + "/" + ($(window).width() - 50) + ", y - " + swipeEnd.y + "/" + ($(window).height() - 50) + ". Direction: " + direction + ". Edge endings: " + endsAtTopEdge + ", " + endsAtRightEdge + ", " + endsAtBottomEdge + ", " + endsAtLeftEdge);
    return;
  }

  //Make sure the data really ends at an edge, even if rubber banding occured or the user lifted the finger 
  //slightly before the edge of the device
  if (edge === "top")    swipeEnd.y = 0;
  if (edge === "left")   swipeEnd.x = 0;
  if (edge === "bottom") swipeEnd.y = $(window).height();
  if (edge === "right")  swipeEnd.x = $(window).width();      

  var swipeData = {
    edge : edge,
    x    : swipeEnd.x,
    y    : swipeEnd.y
  };
  CWEventManager.trigger("stitchswipe", swipeData);
}.bind(CWGestures);


/**
 * Installs the necessary event handlers on the given DOM or jQuery element to
 *    capture gestures on that element
 * @param  {HTMLElement|jQuery} el The element that should be monitored for
 *    gestures
 * @function
 * @private
 */
CWGestures._captureOn = function(el) {
  if (el instanceof jQuery) el = el.get(0);

  //el.on("mousedown this._touchStart", this._onDown);
  el.addEventListener("mousedown",  this._onDown, true);
  el.addEventListener("touchstart", this._onDown, true);

  //el.on("mousemove touchmove", this._onMove);
  el.addEventListener("mousemove", this._onMove, true);
  el.addEventListener("touchmove", this._onMove, true);

  //el.on("mouseup touchend", this._onUp);
  el.addEventListener("mouseup",  this._onUp, true);
  el.addEventListener("touchend", this._onUp, true);
}.bind(CWGestures);

//Initalize module. Delayed call to make sure all modules are ready
if (CWGestures.__constructor) window.setTimeout(CWGestures.__constructor, 0);

CWModules.add('CWGestures');
/* global gyro, CWEventManager, CWModules */
'use strict';



/**
  * @typedef GyroscopeData
  * @type {Object}
  * @property {Number} alpha Gyroscope value on the alpha axis. The alpha axis
  *    changes if the device rotates around the z axis
  * @property {Number} beta Gyroscope value on the beta axis. The beta axis 
  *    changes if the device rotates around the x axis
  * @property {Number} gamma Gyroscope value on the gamma axis. The gamma axis
  *    changes if the device rotates around the y axis
  * @memberOf CWGyroscope
  */


/**
 *
 * @typedef AccelerometerData
 * @type {Object}
 * @property {Number} x Accelerometer value on the x axis
 * @property {Number} y Accelerometer value on the y axis
 * @property {Number} z Accelerometer value on the z axis. This includes the
 *    earth's gravitational force and is therefore 9.81 if the device lays
 *    still. On some browsers and devices it can also be -9.81
 * @memberOf CWGyroscope
 */



/**
 * CWGyroscope encapsulates gyroscope and accelerometer data for use in
 *    Connichiwa. It automatically receives the necessary data with the help
 *    of [gyro.js](http://tomg.co/gyrojs) and forwards the data by sending
 *    {@link event:gyroscopeUpdate} and {@link event:accelerometerUpdate}
 *    events.
 * @namespace CWGyroscope
 */
var CWGyroscope = CWGyroscope || {};


/**
 * Stores the last gyroscope and the last accelerometer measure received. This
 *    combines a {@link CWGyroscope.GyroscopeData} and a {@link
 *    CWGyroscope.AccelerometerData} object
 * @type {Object}
 * @private
 */
CWGyroscope._lastMeasure = undefined;


/**
 * Determines if the alpha and gamma values of the incoming gyroscope data is
 *    flipped
 * @type {Boolean}
 * @private
 */
CWGyroscope._alphaGammaFlipped = false;


/**
 * Should be called on application launch, initalizes the CWGyroscope object
 * @function
 * @private
 */
CWGyroscope.__constructor = function() {
  gyro.frequency = 500;
  gyro.startTracking(this._onUpdate.bind(this));    

  //TODO we should only start tracking if necessary
  //necessary for now means the device has been stitched
  //but how do we best figure that out?
}.bind(CWGyroscope);


/**
 * Called whenever the gyro library fetches new data
 * @param  {Object} o Gyroscope/Accelerometer data passed by the gyro library
 * @fires gyroscopeUpdate
 * @fires accelerometerUpdate
 * @function
 * @private
 */
CWGyroscope._onUpdate = function(o) {
  if (o.alpha === null || o.beta === null || o.gamma === null ||
    o.x === null || o.y === null || o.z === null) return;

  if (this._lastMeasure === undefined) this._lastMeasure = o;

  // GYROSCOPE

  //Fuck you Microsoft
  //On "some devices" (so far on Surface Pro 2) the alpha and gamma
  //values are flipped for no reason. There is no good way to detect this,
  //only if alpha or gamma are out of their range we know this is the case
  if (o.alpha < 0 || o.gamma > 180) {
    this._alphaGammaFlipped = true;

    //Flip last measure so we don't screw up our delta calculations
    var temp = this._lastMeasure.alpha;
    this._lastMeasure.alpha = this._lastMeasure.gamma;
    this._lastMeasure.gamma = temp;
  }
  
  var alpha = this._alphaGammaFlipped ? o.gamma : o.alpha;
  var beta  = o.beta;
  var gamma = this._alphaGammaFlipped ? o.alpha : o.gamma;

  var deltaAlpha = alpha - this._lastMeasure.alpha;
  var deltaBeta  = beta  - this._lastMeasure.beta;
  var deltaGamma = gamma - this._lastMeasure.gamma;

  var gyroData = { 
    alpha : alpha, 
    beta  : beta, 
    gamma : gamma,
    delta : {
      alpha : deltaAlpha, 
      beta  : deltaBeta, 
      gamma : deltaGamma
    }
  };
  CWEventManager.trigger(5, 'gyroscopeUpdate', gyroData);

  // ACCELEROMETER

  var deltaX = o.x - this._lastMeasure.x;
  var deltaY = o.y - this._lastMeasure.y;
  var deltaZ = o.z - this._lastMeasure.z;
  var accelData = { 
    x     : o.x, 
    y     : o.y, 
    z     : o.z,
    delta : {
      x : deltaX, 
      y : deltaY, 
      z : deltaZ
    }
  };
  CWEventManager.trigger(5, 'accelerometerUpdate', accelData);

  //We need to copy the values of o because o will be altered by gyro
  this._lastMeasure = { x: o.x, y: o.y, z: o.z, alpha: alpha, beta: beta, gamma: gamma };
}.bind(CWGyroscope);


/**
 * Returns the newest gyroscope data
 * @return {CWGyroscope.GyroscopeData} The newest gyroscope measurement
 * @function
 */
CWGyroscope.getLastGyroscopeMeasure = function() {
  if (this._lastMeasure === undefined) return undefined;

  return { 
    alpha : this._lastMeasure.alpha, 
    beta  : this._lastMeasure.beta,
    gamma : this._lastMeasure.gamma
  };
}.bind(CWGyroscope);


/**
 * Returns the newest accelerometer data
 * @return {CWGyroscope.AccelerometerData} The newest accelerometer
 *    measurement
 * @function
 */
CWGyroscope.getLastAccelerometerMeasure = function() {
  if (this._lastMeasure === undefined) return undefined;
  
  return {
    x : this._lastMeasure.x,
    y : this._lastMeasure.y,
    z : this._lastMeasure.z
  };
}.bind(CWGyroscope);

CWModules.add('CWGyroscope');
/* global CWEventManager, CWStitchManager */
'use strict';



/**
 *
  *
  * @typedef Location
  * @type Object
  * @property {Number} x The x coordinate of the point or rectangle, or
  *    undefined for a size
  * @property {Number} y The y coordinate of the point or rectangle, or
  *    undefined for a size
  * @property {Number} width The width of the size or rectangle, or
  *    undefined for a point
  * @property {Number} height The height of the size or rectangle, or
  *    undefined for a point
  * @memberOf CWLocation
 */



/**
 * Constructs a new CWLocation that represents a rectangle, positioned at the
 *    given x/y coordinates and of size width/height.
 *
 * To represent only a point or a size, use the convenience functions {@link
 *    CWLocation.fromPoint} and {@link CWLocation.fromSize}.
 * @param {Number}  x       The x position of the rectangle
 * @param {Number}  y       The y position of the rectangle
 * @param {Number}  width   The width of the rectangle
 * @param {Number}  height  The height of the rectangle
 * @param {Boolean} [isLocal=true] If set to true, x, y, width and height are
 *    given in the local coordinate system of the device. This is the case
 *    most of the time, for example when retrieving the position and size of a
 *    DOM element. Set this to false in case you pass global coordinates to
 *    the constructor (for example from another CWLocation object).
 * @constructor
 *
 * @class 
 * @classdesc
 * A CWLocation can be used to exchange points, sizes and rectangles between
 *    stitched devices (for more information about stitching, see {@link
 *    CWStitchManager}). A CWLocation will represent the same *physical*
 *    location on every device.
 *
 * ![Local and Global Coordinate Systems in CWLocation](cwlocation1.jpg)
 *    **Figure 1**: Local and Global coordinate system in Connichiwa
 *
 * As seen in figure 1, every device has its own local coordinate system where
 *    `0,0` is the top left corner of the device. In fact, this coordinate
 *    system is the same coordinate system used by CSS, for example when using
 *    `position: fixed`. Connichiwa additionally introduces a *global
 *    coordinate system*, which is a shared coordinate system for all stitched
 *    devices. As you can see, this coordinate system spans across *all*
 *    devices and is therefore perfect for sharing positions between devices.
 *
 * Imagine a scenario, where you want to show an element (in this case a
 *    colored div) across multiple devices:
 *
 * ![Rectangle across two devices](cwlocation2.jpg) **Figure 2**: A rectangle
 *    across two devices. CWLocation helps in positioning this element
 *    correctly across both devices.
 *
 * As it can be seen in Figure 2, the global coordinate system used by
 *    CWLocation can act as a bridge between the two local coordinate systems 
 *    (green and blue). The green device can create a CWLocation that represents
 *    the element. It will use its local coordinates for that:
 *
 * ```
 * var location = new CWLocation(672, 256, 192, 256)
 * ```
 *    
 *    The CWLocation object can now be shared with the blue device using 
 *    {@link CWLocation#toString} and {@link CWLocation.fromString}). The blue
 *    device can then get the element's position *relative to its own
 *    coordinate system*:
 *
 * ```
 * var location = CWLocation.fromString(locationSentByGreen);
 * var localCoordinates = location.getLocal(); 
 * ```
 *    
 *    The local position and size can then be set using CSS.
 *
 * As it can be seen in the previous example, CWLocation will also compensate
 *    for different device rotations. This means that, even though the green 
 *    and blue devices have different device rotations, the local coordinates
 *    retrieved on the blue device will still be correct.
 *
 * Further, CWLocation also compensates for PPI differences. If
 *    the green and blue device have different display PPI, using CWLocation
 *    will ensure that the element still has the same *physical* size on both
 *    devices and therefore appears as a single entity.
 *
 * **Example**: Create a div and position it across two devices. For a more
 *    complete example of stitching and using CWLocation, see the tutorials.
 *    
 * ```
 * //Create a new DOM element 
 * var rect = $('<div></div>'); 
 * rect.attr("id", "therect");
 * rect.css({
 *     position        : "absolute", 
 *     top             : "200px", 
 *     right           : "100px", 
 *     width           : "200px",
 *     height          : "200px", 
 *     backgroundColor : "red" 
 * }); 
 * $("body").append(rect);
 *
 * //Also add the rectangle to another device
 * //We assume we remembered another device as a CWDevice object 
 * anotherDevice.insert(rect);
 *
 * //Create a CWLocation that represents the rectangle, and send it to another device
 * var location = new CWLocation(
 *     rect.offset().left, 
 *     rect.offset().top, 
 *     rect.width(), 
 *     rect.height()
 * );
 * anotherDevice.send("rectlocation", {location: location.toString()});
 *
 * //
 * // ... ON ANOTHER DEVICE ...
 * //
 *
 * Connichiwa.onMessage("rectlocation", function(message) {
 *     //Create the CWLocation from the location that was sent to us
 *     var location = CWLocation.fromString(message.location);
 *
 *     //Retrieve the local coordinates and apply them
 *     $("#therect").css({
 *         top    : location.getLocalY(),
 *         left   : location.getLocalX(),
 *         width  : location.getLocalWidth(),
 *         height : location.getLocalHeight()
 *     });
 *
 *     //Lastly, in case of rotation, we need to apply that to the element
 *     $("#therect").css("transform", "rotate(" + CWStitchManager.getDeviceTransformation().rotation + ")");
 * });
 * ```
 */
function CWLocation(x, y, width, height, isLocal) {
  if (isLocal === undefined) isLocal = true;

  /**
   * The global x coordinate of the location, or undefined
   * @type {Number}
   * @private
   */
  this._x = undefined;

  /**
   * The global y coordinate of the location, or undefined
   * @type {Number}
   * @private
   */
  this._y = undefined;

  /**
   * The global width of the location, or undefined
   * @type {Number}
   * @private
   */
  this._width = undefined;

  /**
   * The global height of the location, or undefined
   * @type {Number}
   * @private
   */
  this._height = undefined;
  
  if (isLocal === true) {
    var global = CWLocation._toGlobal(x, y, width, height);
    this._x      = global.x;
    this._y      = global.y;
    this._width  = global.width;
    this._height = global.height;
  } else {
    //By default, we assume the location to be global coordinates
    this._x      = x;
    this._y      = y;
    this._width  = width;
    this._height = height;
  }

  //When this device is stitched or unstitched, we adjust the values to the
  //new device transformation so that the local coordinates stay the same
  //This is done so that content shown on this device does not change location 
  //or size on a stitch or unstitch
  CWEventManager.register('wasUnstitched', function(message) {
    this._x -= message.deviceTransformation.x;
    this._y -= message.deviceTransformation.y;

    this._x *= message.deviceTransformation.scale;
    this._y *= message.deviceTransformation.scale;
    this._width *= message.deviceTransformation.scale;
    this._height *= message.deviceTransformation.scale;
  }.bind(this));

  CWEventManager.register('wasStitched', function(message) {
    this._x /= message.deviceTransformation.scale;
    this._y /= message.deviceTransformation.scale;
    this._width /= message.deviceTransformation.scale;
    this._height /= message.deviceTransformation.scale;

    this._x += message.deviceTransformation.x;
    this._y += message.deviceTransformation.y;
  }.bind(this));
}


/**
 * Returns an object containing the current global coordinates
 * @return {CWLocation.Location} The global coordinates
 */
CWLocation.prototype.getGlobal = function() {
  return { 
    x: this._x, 
    y: this._y, 
    width: this._width, 
    height: this._height
  };
};


/**
 * Returns this CWLocation in the device's local coordinate system
 * @return {CWLocation.Location} The local coordinates
 */
CWLocation.prototype.getLocal = function() {
  return CWLocation._toLocal(this._x, this._y, this._width, this._height);
};


/**
 * Returns the global x coordinate
 * @return {Number} The global x coordinate of the point or rectangle, or
 *    undefined for a size
 */
CWLocation.prototype.getGlobalX = function() { 
  return this._x; 
};


/**
 * Returns the global y coordinate
 * @return {Number} The global y coordinate of the point or rectangle, or
 *    undefined for a size
 */
CWLocation.prototype.getGlobalY = function() { 
  return this._y; 
};


/**
 * Returns the global width
 * @return {Number} The global width of the size or rectangle, or
 *    undefined for a point
 */
CWLocation.prototype.getGlobalWidth = function() { 
  return this._width; 
};


/**
 * Returns the global height
 * @return {Number} The global height of the size or rectangle, or
 *    undefined for a point
 */
CWLocation.prototype.getGlobalHeight = function() { 
  return this._height; 
};


/**
 * Returns the local x coordinate
 * @return {Number} The local x coordinate of the point or rectangle, or
 *    undefined for a size
 */
CWLocation.prototype.getLocalX = function() { 
  return this.getLocal().x; 
};


/**
 * Returns the local y coordinate
 * @return {Number} The local y coordinate of the point or rectangle, or
 *    undefined for a size
 */
CWLocation.prototype.getLocalY = function() { 
  return this.getLocal().y; 
};


/**
 * Returns the local width
 * @return {Number} The local width of the size or rectangle, or
 *    undefined for a point
 */
CWLocation.prototype.getLocalWidth = function() { 
  return this.getLocal().width; 
};


/**
 * Returns the local height
 * @return {Number} The local height of the size or rectangle, or
 *    undefined for a point
 */
CWLocation.prototype.getLocalHeight = function() { 
  return this.getLocal().height; 
};


/**
 * Sets the global coordinates of this location to the given x, y, width and
 *    height.
 * @param {Number} x      The new global x coordinate
 * @param {Number} y      The new global y coordinate
 * @param {Number} width  The new global width
 * @param {Number} height The new global height
 */
CWLocation.prototype.setGlobal = function(x, y, width, height) {
  if (x      !== undefined) this._x      = x;
  if (y      !== undefined) this._y      = y;
  if (width  !== undefined) this._width  = width;
  if (height !== undefined) this._height = height;
};


/**
 * Sets the local coordinates of this location to the given x, y, width and
 *    height.
 * @param {Number} x      The new local x coordinate
 * @param {Number} y      The new local y coordinate
 * @param {Number} width  The new local width
 * @param {Number} height The new local height
 */
CWLocation.prototype.setLocal = function(x, y, width, height) {
  var global = CWLocation._toGlobal(x, y, width, height);
  this._x      = global.x;
  this._y      = global.y;
  this._width  = global.width;
  this._height = global.height;
};


/**
 * Sets the global x coordinate of this location to the given value
 * @param {Number} v The new global x coordinate
 */
CWLocation.prototype.setGlobalX = function(v) { 
  this.setGlobal(v, this._y, this._width, this._height); 
};


/**
 * Sets the global y coordinate of this location to the given value
 * @param {Number} v The new global y coordinate
 */
CWLocation.prototype.setGlobalY = function(v) { 
  this.setGlobal(this._x, v, this._width, this._height); 
};


/**
 * Sets the global width of this location to the given value
 * @param {Number} v The new global width
 */
CWLocation.prototype.setGlobalWidth = function(v) { 
  this.setGlobal(this._x, this._y, v, this._height); 
};


/**
 * Sets the global height of this location to the given value
 * @param {Number} v The new global height
 */
CWLocation.prototype.setGlobalHeight = function(v) { 
  this.setGlobal(this._x, this._y, this._width, v); 
};


/**
 * Sets the local x coordinate of this location to the given value
 * @param {Number} v The new local x coordinate
 */
CWLocation.prototype.setLocalX = function(v) {
  var local = this.getLocal();
  this.setLocal(v, local.y, local.width, local.height);
};


/**
 * Sets the local y coordinate of this location to the given value
 * @param {Number} v The new local y coordinate
 */
CWLocation.prototype.setLocalY = function(v) {
  var local = this.getLocal();
  this.setLocal(local.x, v, local.width, local.height);
};


/**
 * Sets the local width of this location to the given value
 * @param {Number} v The new local width
 */
CWLocation.prototype.setLocalWidth = function(v) {
  var local = this.getLocal();
  this.setLocal(local.x, local.y, v, local.height);
};


/**
 * Sets the local height of this location to the given value
 * @param {Number} v The new local height
 */
CWLocation.prototype.setLocalHeight = function(v) {
  var local = this.getLocal();
  this.setLocal(local.x, local.y, local.width, v);
};


/**
 * Serializes this location into a string. To construct a CWLocation object
 *    from a string, see {@link CWLocation.fromString}
 * @return {String} The string representation of this CWLocation
 */
CWLocation.prototype.toString = function() {
  return JSON.stringify(this.getGlobal());
};


/**
 * Returns a copy of this object
 * @return {CWLocation} A new CWLocation object that represents the same
 *    point, size or rectangle as this object
 */
CWLocation.prototype.copy = function() {
  return CWLocation.fromString(this.toString());
};


/**
 * Convenience function to convert the given x, y, width and height into
 *    global coordinates without constructing a new CWLocation object
 * @param  {Number} x      A local x coordinate or undefined
 * @param  {Number} y      A local y coordinate or undefined
 * @param  {Number} width  A local width or undefined
 * @param  {Number} height A local height or undefined
 * @return {Location}      An object containing global coordinates
 * @private
 */
CWLocation._toGlobal = function(x, y, width, height) {
  if (x === undefined) x = 0;
  if (y === undefined) y = 0;
  if (width  === undefined) width = 0;
  if (height === undefined) height = 0;

  var result = { x: x, y: y, width: width, height: height };

  var transformation = CWStitchManager.getLocalDeviceTransformation();
  
  //Adjust x/y values from our rotation to the master device, which always has 0º rotation
  if (transformation.rotation === 0) {
    result.y      = y;
    result.x      = x;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 90) {
    result.y      = (transformation.height * transformation.scale) - x - width;
    result.x      = y;
    result.width  = height;
    result.height = width;
  }
  if (transformation.rotation === 180) {
    result.y      = (transformation.height * transformation.scale) - y - height;
    result.x      = (transformation.width * transformation.scale)  - x - width;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 270) {
    result.y      = x;
    result.x      = (transformation.width * transformation.scale) - y - height;
    result.width  = height;
    result.height = width;
  }

  //To get actual global coordinates we need to add the device's translation
  result.x += (transformation.x * transformation.scale);
  result.y += (transformation.y * transformation.scale);

  //Finally, adjust the scale to the scale of the master device
  result.x      /= transformation.scale;
  result.y      /= transformation.scale;
  result.width  /= transformation.scale;
  result.height /= transformation.scale;

  return result;
};


/**
 * Convenience function to convert the given x, y, height and width into local
 *    coordinates without constructing a new CWLocation object
 * @param  {Number} x      A local x coordinate or undefined
 * @param  {Number} y      A local y coordiante or undefined
 * @param  {Number} width  A local width or undefined
 * @param  {Number} height A local height or undefined
 * @return {Location}      An object containing local coordinates
 * @private
 */
CWLocation._toLocal = function(x, y, width, height) {
  if (x === undefined) x = 0;
  if (y === undefined) y = 0;
  if (width  === undefined) width = 0;
  if (height === undefined) height = 0;

  var result = { x: x, y: y, width: width, height: height };

  var transformation = CWStitchManager.getLocalDeviceTransformation();

  //Adjust values from the master rotation (0º) to our rotation
  //Also, we incorporate device translation here - we can't do that afterwards
  //because transformation.x/y are in local coordinates and therefore need to be
  //applied differently depending on rotation
  if (transformation.rotation === 0) {
    result.y      = y - transformation.y;
    result.x      = x - transformation.x;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 90) {
    result.y      = x - transformation.x;
    result.x      = transformation.height - (y - transformation.y + height);
    result.width  = height;
    result.height = width;
  }
  if (transformation.rotation === 180) {   
    result.y      = transformation.height - (y - transformation.y + height);
    result.x      = transformation.width  - (x - transformation.x + width);
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 270) {        
    result.y      = transformation.width - (x - transformation.x + width);
    result.x      = (y - transformation.y);
    result.width  = height;
    result.height = width;
  }

  //Get values in the local device's scaling
  result.x      *= transformation.scale;
  result.y      *= transformation.scale;
  result.width  *= transformation.scale;
  result.height *= transformation.scale;

  return result;
};


/**
 * TODO
 * @param  {Number} x        [description]
 * @param  {Number} y        [description]
 * @param  {Number} width    [description]
 * @param  {Number} height   [description]
 * @param  {Number} rotation [description]
 * @return {Location}          [description]
 */
CWLocation.applyRotation = function(x, y, width, height, rotation) {
  var transformation = CWStitchManager.getLocalDeviceTransformation();

  if (x === undefined) x = 0;
  if (y === undefined) y = 0;
  if (width  === undefined) width = 0;
  if (height === undefined) height = 0;
  if (rotation === undefined) rotation = transformation.rotation;

  var result = { x: x, y: y, width: width, height: height };

  if (transformation.rotation === 0) {
    result.y      = y;
    result.x      = x;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 90) {
    result.y      = -x;
    result.x      = y;
    result.width  = height;
    result.height = width;
  }
  if (transformation.rotation === 180) {   
    result.y      = -y;
    result.x      = -x;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 270) {        
    result.y      = x;
    result.x      = -y;
    result.width  = height;
    result.height = width;
  }

  return result;  
};


/**
 * Constructs a new CWLocation object from a string (for example produced by
 *    {@link CWLocation#toString}) and returns it
 * @param  {String} s The string representation of a CWLocation
 * @return {CWLocation}   A CWLocation object that corresponds to the string
 */
CWLocation.fromString = function(s) {
  var obj = JSON.parse(s);

  return new CWLocation(
    parseFloat(obj.x),
    parseFloat(obj.y),
    parseFloat(obj.width),
    parseFloat(obj.height),
    false
  );
};


/**
 * Constructs a new CWLocation that represents a point (has no width and
 *    height) and returns it
 * @param  {Number}  x       The x coordinate of the point
 * @param  {Number}  y       The y coordinate of the point
 * @param  {Boolean} isLocal Determines if the coordinates handed to this
 *    function are local or global coordinates, also see {@link CWLocation}
 * @return {CWLocation}      A CWLocation that represents the point at the
 *    given coordaintes
 */
CWLocation.fromPoint = function(x, y, isLocal) {
  return new CWLocation(x, y, undefined, undefined, isLocal);
};


/**
 * Constructs a new CWLocation that represents a size (has no x and
 *    y coordiantes) and returns it
 * @param  {Number}  width   The width of the size
 * @param  {Number}  height  The height of the size
 * @param  {Boolean} isLocal Determines if the size handed to this
 *    function is in local or global coordinates, also see {@link CWLocation}
 * @return {CWLocation}      A CWLocation that represents the given size
 */
CWLocation.fromSize = function(width, height, isLocal) {
  return new CWLocation(undefined, undefined, width, height, isLocal);
};
/* global Connichiwa, CWDebug, CWModules */
'use strict';



/**
 * This module is responsible for the communication between the JS library and
 *    the native layer. On the master, such communication must exist. On a
 *    remote, it is only possible if a native layer exists.This includes
 *    receiving and reacting to messages from the native layer and also
 *    calling methods on the native layer.
 *
 * TODO details about the communication protocol
 * @namespace CWNativeBridge
 * @protected
 */
var CWNativeBridge = CWNativeBridge || {};


/**
 * Determines if this device is run by a native layer. Always true for the
 *    master device
 * @type {Boolean}
 * @private
 */
CWNativeBridge._runsNative = false;


/**
 * Initializes the CWNativeBridge module. Must be called on load.
 * @function
 * @private
 */
CWNativeBridge.__constructor = function() {
  // if (Connichiwa.isMaster()) {
    // console.log("runsNative true")
    // this._runsNative = true;
  // } else {
    if (window.RUN_BY_CONNICHIWA_NATIVE === true) {
      this._runsNative = true;
    } 
  // }
}.bind(CWNativeBridge);


/**
 * Determines if this device is run by a native layer. Always true for the
 *    master device
 * @return {Boolean} true if a native layer is present, otherwise false
 * @function
 * @protected
 */
CWNativeBridge.isRunningNative = function() {
  return (this._runsNative === true);
}.bind(CWNativeBridge);


/**
 * Calls a method with the given name on the native layer. If there is no
 *    native layer or the method does not exist, the call will do nothing
 * @param  {String} methodName The name of the method to call
 * @function
 * @protected
 */
CWNativeBridge.callOnNative = function(methodName) {
  //If we are not running natively, all native method calls are simply ignored
  if (this.isRunningNative() !== true) return;

  //Grab additional arguments passed to this method, but not methodName
  var args = Array.prototype.slice.call(arguments);
  args.shift();

  //Check if the given method is a valid function and invoke it
  //Obviously, this could be used to call any method, but what's the point really?
  var method = window[methodName];
  if (typeof method === 'function') {
    method.apply(null, args);
  } else { 
    CWDebug.log(1, 'ERROR: Tried to call native method with name ' + methodName + ', but it doesn\'t exist!');
  }
}.bind(CWNativeBridge);


/**
 * This method is used to parse a message from the native layer. It will then
 *    call the appropiate sub-parse method, if this message is a valid
 *    message. This method should only be called by the native layer and never
 *    by the JS code or the application code.
 * @param  {Object} message The native layer's message
 * @function
 * @protected
 */
CWNativeBridge.parse = function(message) { /* ABSTRACT */ };


CWModules.add('CWNativeBridge');
/* global Connichiwa, CWGyroscope, CWSystemInfo, CWUtil, CWModules */
'use strict';



/**
 * @typedef DeviceTransformation
 * @type {Object}
 * @property {Number} x The x offset of this device in the global coordinate
 *    system
 * @property {Number} y The y offset of this device in the global coordinate
 *    system
 * @property {Number} width The device's viewport width in the global
 *    coordinate system, which can differ from the device's actual viewport
 *    width due to PPI differences between the devices
 * @property {Number} height The device's viewport height in the global
 *    coordinate system, which can differ from the device's actual viewport
 *    height due to PPI differences between the devices
 * @property {Number} rotation The device's rotation relative to the global
 *    coordinate system axis. Connichiwa can only detect 90º rotiations, so
 *    this property is either 0, 90, 180 or 270
 * @property {Number} scale The scale of this device's content. Connichiwa
 *    adjusts the scale of stitched device's to compensate for display PPI
 *    differences. If content is scaled with this scale on every device, it
 *    will appear the same physicial size on all stitched devices
 * @memberOf CWStitchManager
 */



/**
 * This manager handles everything stitch-related. It detects stitch gestures,
 *    calculates the stitched device's device transformation in the global
 *    coordinate system and is also responsible for handling stitch-related
 *    events and detecting unstitches. It also provides methods for accessing
 *    stitch-related information, such as if the device is stitched and the
 *    current device transformation
 * @namespace CWStitchManager
 */
var CWStitchManager = CWStitchManager || {};


/**
 * Determines if this device is currently stitched
 * @type {Boolean}
 * @private
 */
CWStitchManager._isStitched = false;


/**
 * This object stores the current device transformation of this device or is
 *    undefined, if the device is not stitched
 * @type {CWStitchManager.DeviceTransformation}
 * @private
 */
CWStitchManager._deviceTransformation = undefined;


/**
 * Remembers the gyroscope data when the device was stitched. Used to
 *    calculate the unstitch on device movement
 * @type {CWGyroscope.GyroscopeData}
 * @private
 */
CWStitchManager._gyroDataOnStitch = undefined;


/**
 * Determines if Connichiwa will automatically unstitch this device if it is
 *    moved
 * @type {Boolean}
 * @default true
 */
CWStitchManager.unstitchOnMove = true;


/**
 * If {@link CWStitchManager.unstitchOnMove} is set to true, this property
 *    determines axis that do **not** cause an unstitch of the device. It is
 *    an array that is either empty (all axis can cause an unstitch) or can
 *    contain one or multiple of the string values "x", "y", "z" (to ignore
 *    accelerometer axis) or "alpha", "beta", "gamma" (to ignore gyroscope
 *    axis)
 * @type {Array}
 * @default  [ ]
 */
CWStitchManager.ignoreMoveAxis = [];


/**
 * Sets up the CWStitchManager object. Must be called on load
 * @function
 * @private
 */
CWStitchManager.__constructor = function() {
  Connichiwa.on('stitchswipe',         this._onLocalSwipe);
  Connichiwa.on('wasStitched',         this._onWasStitched);
  Connichiwa.on('wasUnstitched',       this._onWasUnstitched);
  Connichiwa.on('gyroscopeUpdate',     this._onGyroUpdate);
  Connichiwa.on('accelerometerUpdate', this._onAccelerometerUpdate);
}.bind(CWStitchManager);


/**
 * Called whenever the manager receives a {@link event:wasStitched} message
 * @param  {Object} message The received message
 * @function
 * @private
 */
CWStitchManager._onWasStitched = function(message) {
  this._gyroDataOnStitch = CWGyroscope.getLastGyroscopeMeasure();
  this._deviceTransformation = message.deviceTransformation;
  this._isStitched = true;

  //TODO register for gyroscopeUpdate instead of in constructor
}.bind(CWStitchManager);


/**
 * Called whenever the manager receives a {@link event:wasUnstitched} message
 * @param  {Object} message The received message
 * @function
 * @private
 */
CWStitchManager._onWasUnstitched = function(message) {
  this._gyroDataOnStitch = undefined;
  this._deviceTransformation = this.getDefaultDeviceTransformation();
  this._isStitched = false;

  //TODO unregister from gyroscopeUpdate
}.bind(CWStitchManager);


/**
 * Called whenever the manager receives a {@link event:stitchswipe} message
 * @param  {Object} swipeData The received message
 * @function
 * @private
 */
CWStitchManager._onLocalSwipe = function(swipeData) {
  swipeData.device = Connichiwa.getIdentifier();
  swipeData.width  = CWSystemInfo.viewportWidth();
  swipeData.height = CWSystemInfo.viewportHeight();
  Connichiwa.send('master', '_stitchswipe', swipeData);
}.bind(CWStitchManager);


/**
 * Called whenever the manager receives a new {@link event:gyroscopeUpdate}
 *    event
 * @param  {CWGyroscope.GyroscopeData} gyroData The new gyroscope measures
 * @function
 * @private
 */
CWStitchManager._onGyroUpdate = function(gyroData) {
  if (this.isStitched() === false) return;
  if (this.unstitchOnMove === false) return;

  //Might happen if _onWasStitched is called before the first gyro measure arrived
  if (this._gyroDataOnStitch === undefined) {
    this._gyroDataOnStitch = gyroData;
  }
   
  var deltaAlpha = Math.abs(gyroData.alpha - this._gyroDataOnStitch.alpha);
  var deltaBeta  = Math.abs(gyroData.beta  - this._gyroDataOnStitch.beta);
  var deltaGamma = Math.abs(gyroData.gamma - this._gyroDataOnStitch.gamma);

  //Modulo gives us the smallest possible angle (e.g. 1º and 359º gives us 2º)
  deltaAlpha = Math.abs((deltaAlpha + 180) % 360 - 180);
  deltaBeta  = Math.abs((deltaBeta  + 180) % 360 - 180);
  deltaGamma = Math.abs((deltaGamma + 180) % 360 - 180);

  //If the device is tilted more than 20º, we back out of the stitch
  //We give a little more room for alpha. Alpha means the device was moved on the
  //table, which is not as bad as actually picking it up. 
  //Axises in the "ignoreMoveAxis" array are not checked
  if ((CWUtil.inArray('alpha', this.ignoreMoveAxis) === false && deltaAlpha >= 35) ||
      (CWUtil.inArray('beta',  this.ignoreMoveAxis) === false && deltaBeta  >= 20) ||
      (CWUtil.inArray('gamma', this.ignoreMoveAxis) === false && deltaGamma >= 20)) {
    this._quitStitch();
  }
}.bind(CWStitchManager);


/**
 * Called whenever the manager receives a new {@link
 *    event:accelerometerUpdate} event
 * @param  {CWGyroscope.AccelerometerData} accelData The new accelerometer
 *    measures
 * @function
 * @private
 */
CWStitchManager._onAccelerometerUpdate = function(accelData) {
  if (this.isStitched() === false) return;
  if (this.unstitchOnMove === false) return;


  //Get the accelerometer values normalized
  //z includes earth's gravitational force (~ -9.8), but sometimes is 9.8 and 
  //sometimes -9.8, depending on browser and device, therefore we use its absolute
  //value
  var x = Math.abs(accelData.x);
  var y = Math.abs(accelData.y);
  var z = Math.abs(Math.abs(accelData.z) - 9.81);

  //1.0 seems about a good value which doesn't trigger on every little shake,
  //but triggers when the device is actually moved 
  //Axises in the "ignoreMoveAxis" array are not checked
  if ((CWUtil.inArray('x', this.ignoreMoveAxis) === false && x >= 1.0) || 
      (CWUtil.inArray('y', this.ignoreMoveAxis) === false && y >= 1.0) ||
      (CWUtil.inArray('z', this.ignoreMoveAxis) === false && z >= 1.0)) {
    this._quitStitch();
  }
}.bind(CWStitchManager);


/**
 * Called whenever the manager wishes to quit the current stitching
 * @function
 * @private
 */
CWStitchManager._quitStitch = function() {
  var data = { device : Connichiwa.getIdentifier() };
  Connichiwa.send('master', '_quitstitch', data);
}.bind(CWStitchManager);


/**
 * Unstitches this device or does nothing if the device is not stitched. Note
 *    that the unstitch is done asynchronously. If you rely on the device
 *    being unstitched, wait for the {@link event:wasunstitched} event to be
 *    fired.
 * @function
 */
CWStitchManager.unstitch = function() {
  this._quitStitch();
}.bind(CWStitchManager);


/**
 * Determines if the device is currently stitched
 * @return {Boolean} true if the device is currently stitched, otherwise false
 * @function
 */
CWStitchManager.isStitched = function() {
  return this._isStitched;
}.bind(CWStitchManager);


/**
 * Returns this device's current device transformation, which is this device's
 *    position, rotation and size in the global coordinate system
 * @return {CWStitchManager.DeviceTransformation} The current device
 *    transformation
 * @function
 */
CWStitchManager.getLocalDeviceTransformation = function() {
  if (this._deviceTransformation === undefined) {
    return this.getDefaultDeviceTransformation();
  }
  
  return this._deviceTransformation;
}.bind(CWStitchManager);


/**
 * Retrieves the default device transformation that represents a non-stitched
 *    device
 * @return {CWStitchManager.DeviceTransformation} The default device
 *    transformation
 * @function
 * @protected
 */
CWStitchManager.getDefaultDeviceTransformation = function() {
  return {
    x        : 0, 
    y        : 0, 
    width    : CWSystemInfo.viewportWidth(), 
    height   : CWSystemInfo.viewportHeight(),
    rotation : 0, 
    scale    : 1.0 
  };
}.bind(CWStitchManager);


CWModules.add('CWStitchManager');
/* global CWModules */
'use strict';



/**
 * CWSystemInfo encapsulates some system-related information as far as they
 *    are available. It can be used, for example, to access the display's PPI,
 *    the browser window resolution or the orientation
 * @namespace CWSystemInfo
 */
var CWSystemInfo = CWSystemInfo || {};


/**
 * The PPI value that will be used when other PPI information are not available
 * @type {Number}
 * @const
 */
CWSystemInfo.DEFAULT_PPI = 100; //HD on a 22'' monitor


/**
 * This device's display PPI, approximated. JavaScript does not have direct
 *    access to the display size and therefore cannot retrieve the PPI value.
 *    Depending on the available information, such as the devicePixelRatio or
 *    navigator information, this method tries to approximate the display's
 *    PPI as close as possible
 * @return {Number} The device's approximated display PPI
 * @function
 */
CWSystemInfo.PPI = function() {
  var ppi = this.DEFAULT_PPI;

  //For high density screens we simply assume 142 DPI
  //This, luckily, is correct for a lot of android devices
  if (window.devicePixelRatio > 1.0) {
    ppi = 142; 
  }
   
  //For iPhone and iPad, we can figure out the DPI pretty well
  if (navigator.platform === 'iPad') {
    //usually we would distinguish iPad Mini's (163dpi) but we can't, so we 
    //return normal iPad DPI
    ppi = 132;
  }
  if (navigator.platform === 'iPhone' || navigator.platform === 'iPod') {
    //Newer iPhones (for now iPhone 6+) have a different resolution, luckily 
    //they also return a new devicePixelRatio
    if (window.devicePixelRatio === 3) {
      ppi = 153;
    } else {
      ppi = 163;
    }
  }

  return ppi;
}.bind(CWSystemInfo);


/**
 * Determines if the device is in landscape orientation
 * @return {Boolean} true if the device is in landscape orientation, otherwise
 *    false
 * @function
 */
CWSystemInfo.isLandscape = function() {
  return (window.innerHeight < window.innerWidth);
}.bind(CWSystemInfo);


/**
 * Returns the current viewport width of the browser or web view
 * @return {Number} The current viewport width
 * @function
 */
CWSystemInfo.viewportWidth = function() {
  return $(window).width();
}.bind(CWSystemInfo);


/**
 * Returns the current viewport height of the browser or web view. This method
 *    should not be used when using the meta-tag viewport with the
 *    height-device-height attribute
 * @return {Number} The current viewport height
 * @function
 */
CWSystemInfo.viewportHeight = function() {
  //This seems to break in landscape when using meta-viewport 
  //height-device-height so basically for now: don't use that
  return $(window).height();
}.bind(CWSystemInfo);

CWModules.add('CWSystemInfo');
/* global Connichiwa, Ractive, CWDatastore, CWUtil, CWDebug, CWModules */
'use strict';

/**
 * Provides cross-device templating in Connichiwa.
 *
 * CWTemplates allows you to write Mustache ({@link
 *    https://mustache.github.io}) templates and insert them into the DOM of a
 *    local or remote device. Mustache templates support *expressions* that
 *    can be replaced with content at runtime.
 *
 * #### Data-driven templates
 *
 * For example, if a template contains the line `Hello, {{name}}!` the
 *    expression is `{{name}}` You can replace it at runtime using {@link
 *    CWTemplates.set} - e.g. `CWTemplates.set('name', 'Paul')` will change
 *    the DOM to `Hello, Paul!`. At some point later you can call
 *    `CWTemplates.set('name', 'John')` and the DOM will be automatically
 *    reflect the change and display `Hello, John!`
 *
 * As you can see, Connichiwas templates are *data-driven* - you do not
 *    directly manipulate the DOM, but rather manipulate the data which will
 *    be automatically reflected in your UI. Connichiwa even sweetens that
 *    further by syncing your data across devices. So if a template on one
 *    device contains the expression `{{name}}`, and the same or another
 *    template on another device contains that expression as well, using
 *    `CWTemplates.set('name', 'Paul')` will change that expression on **all**
 *    your devices.
 *
 * What if you have a template that contains the `{{name}}` expression and
 *    want it to show a different name? Here is where data collections come
 *    into play: When inserting the template into the DOM, you can define the
 *    name of a data collection that will be used for that template. So your
 *    template could do something like:
 *
 * `CWTemplates.insert('myTemplate', 'body', 'customCollection')`
 *
 * Now, if some device calls `CWTemplates.set('name', 'Paul')` the new
 *    template will not be affected! Instead, you can set the name of that
 *    template using `CWTemplates.set('customCollection', 'name', 'Michael')`.
 *    So you can have multiple templates with the same expression, but use
 *    different data!
 *
 * #### How to insert a template?
 *
 * Templates are stored in external files with arbitrary extension
 *    (preferrably `.html`, as this enables syntax highlighting). A template
 *    consists of a template tag and needs a name:
 *
 * `<template name="myTemplate"> ... </template>`
 *
 * A file can contain multiple templates. To use one or more templates, you
 *    must first load the file that contains them using {@link
 *    CWTemplates.load}. You can then start to insert templates into your DOM
 *    using {@link CWTemplates.insert}. To replace your template expressions
 *    (such as `{{name}}`) with actual data, use {@link CWTemplates.set}.
 *    That's all there is to it.
 * @copyright This class and the whole idea behind CWTemplates is based on
 *    Roman Rädle's work (roman.raedle@uni-konstanz.de).
 * @namespace  CWTemplates
 */
var CWTemplates = CWTemplates || {};

/**
 * An array where every entry represents one template-file loading attempt.
 *    Each entry is a jQuery Promise of the ajax request to a template file.
 *    The Promise can have 3 possible states:
 *
 * * If the request is ongoing, the Promise is unresolved
 *
 * * If the request was successful and the template file was compiled, the
 *    Promise is resolved
 *
 * * If the request failed or the template file could not be compiled, the
 *    Promise is rejected
 * @type {Object}
 * @private
 */
CWTemplates._files = [];

/**
 * An object containing the individual templates. It has two keys:
 *
 * * 'raw' is an object with one entry per loaded template. Each entry has the
 *    template name as the key, and the templates raw HTML (as it occurs in
 *    the file) as the value
 *
 * * 'compiled' is an array where each entry is one template that was inserted
 *    into the DOM. This means that, if the same template is inserted multiple
 *    times, it will produce multiple entries in this array. Each entry is a
 *    Ractive object that represents the compiled template. Ractive methods
 *    can be called on it, such as `set()` or `update()`
 * @type {Object}
 * @private
 */
CWTemplates._templates = { raw: {}, compiled: [] };

/**
 * Initializes CWTemplates, for example registers necessary event handlers
 * @function
 * @private
 */
CWTemplates.__constructor = function() {
  var that = this;

  //People call CWTemplates.set to change template data, which in turn calls 
  //CWDatastore.set, which in turn fires _datastorechanged - we need to make
  //sure that the Ractive templates also know that the data changed
  Connichiwa.on("_datastorechanged", function(collection, changes) {
    //All template-related collections must start with _CWTemplates. Since we 
    //don't know which expressions are used in which templates, we just call 
    //update on ALL Ractives if a key changes
    if (collection && collection.indexOf('_CWTemplates') === 0) {
      $.each(changes, function(key, entry) {
        $.each(that._templates.compiled, function(index, ractive) {
          ractive.update(key);
        });
      });
    }
  });
}.bind(CWTemplates);


/**
 * Loads one or more files containing templates. Templates that have been
 *    loaded can then be inserted into the DOM using {@link
 *    CWTemplates.insert}.
 * @param  {String|Array} paths The path to a template file or an array of
 *    paths. If one or more paths are invalid, that particular load will fail, but all other paths will still be loaded.
 * @function
 */
CWTemplates.load = function(paths) {
  if (CWUtil.isString(paths)) paths = [ paths ];

  var that = this;
  $.each(paths, function(i, path) {
    //Don't load files twice
    if (path in that._files) return true;

    //We need to create our own Promise because we want the Promise to resolve 
    //after the file was COMPILED, not after it was loaded
    var deferred = new $.Deferred();
    that._files.push(deferred);
    $.get(path).done(function(data) {
      CWDebug.log(3, "Compiling template file "+path);
      var success = that._compile(data);
      if (success) deferred.resolve();
      else deferred.reject();
    }).fail(function() {
      CWDebug.err("Template file " + path +" does not exist");
      deferred.reject();
    });
  });
}.bind(CWTemplates);


 /**
  * Inserts the template with the given name into the local DOM. The template
  *    will be inserted into the DOM object(s) with the given target selector.
  *
  * The expressions in your templates (such as `{{name}}`) will be replaced
  *    with data from the *template data store*. The template data store is
  *    the data source that provides data to your UI, and you can insert data
  *    using {@link CWTemplates.set}. For example, `{{name}}` will be replaced
  *    by whatever value was set using `CWTemplates.set('name', ...)`.
  *
  * Connichiwa synchronizes your template data store across all your devices,
  *    so all your devices access the same underlying data - this ensures that
  *    your UI is consistent across multiple devices. So, if you insert a
  *    template on a remote device that contains the `{{name}}` expression,
  *    using `CWTemplates.set('name', ...)` on **any** device will update your
  *    UI.
  *
  * If you have the same expression in multiple templates, but want to feed
  *    different data to the templates, you can provide a collection name
  *    using the `data` attribute. By default, all templates take their data
  *    from the main collection. If you specify the name of a collection in
  *    the `data` attribute, your template will react only to changes in that
  *    particular collection. For example, if you insert a template using
  *    `CWTemplates.insert('myTemplate', 'body', 'myCollection')`, calling
  *    `CWTemplates.set('name', 'Paul')` will not affect the template.
  *    Instead, you must call `CWTemplates.set('myCollection', 'name',
  *    'Paul')` to update your template UI. This way, you can have the same
  *    expression multiple times but use different data.
  *
  * Note that insertion is an asynchronous operation, an optional callback
  *    can be provided and will be called when the insertion finished.
  *
  * Note that before you can insert a template, you must load the file that
  *    contains this template using {@link CWTemplates.load}. If your template
  *    contains subtemplates (using the `{{> subtemplate}}` notation), the
  *    files containing the subtemplate must have been loaded as well.
  * @param  {String}   templateName The name of the template to load. The file
  *    that contains a template with this name must be loaded using {@link
  *    CWTemplates.load} before calling this method.
  * @param  {String}   target       A jQuery selector that points to a valid
  *    DOM object (e.g. 'body'). The template will be inserted into this DOM
  *    element.
  * @param  {Object}   data         If undefined, the default template data
  *    store (that can be written using `CWTemplate.set(key, value)`) is fed
  *    to the template. If set to a string, the template data store of that
  *    name is fed to the template (which can be written using
  *    `CWTemplates.set('storeName', key, value)`). If set to an object
  *    literal, the static data from the object is fed to the template - the
  *    template is then rendered static.
  * @param  {Function} [callback]     An optional callback function. This
  *    callback will be called after the template was inserted into the DOM.
  * @function
 */
CWTemplates.insert = function(templateName, target, data, callback) {
  var that = this;
  $.when.all(this._files).always(function() {
    CWDebug.log(3, "Inserting template " + templateName + " into DOM");

    //Grab the template data:
    //* By default, we use the default CWTemplates data store
    //* If data is a string, we define an alternative data store using that name
    //* If data is an object literal, we use its content as static data and do
    //  not use the data store at all (=not reactive)
    var ractiveData;
    if (data === undefined) {
      ractiveData = CWDatastore._getCollection('_CWTemplates.', false);
    } else if (CWUtil.isString(data)) {
      ractiveData = CWDatastore._getCollection('_CWTemplates.'+data, false);
    } else if (CWUtil.isObject(data)) {
      ractiveData = data;
    }

    var ractive = new Ractive({ 
      template: that._templates.raw[templateName], 
      data: ractiveData,
      el: $(target),
      append: true,
      partials: that._templates.raw
    });
    that._templates.compiled.push(ractive); 

    if (callback !== undefined) callback();
  });
}.bind(CWTemplates);


/**
 * Writes the given data to the template data store. This method is the main
 *    mechanism to change the underlying data of templates. For example, if a
 *    template contains the expression `{{title}}`, this expression will
 *    always be replaced with the current value of the title key in the
 *    template data store.
 *
 * Be aware that data set using this method is synchronized across all your
 *    devices. Therefore, you can update the DOM on multiple devices with a
 *    single call to this method.
 * @param {String} [collection] An optional collection name. Collections can
 *    be thought of as "sub data stores". Using collections, you can insert
 *    multiple templates with the same expression, but have them display
 *    different data (also see {@link CWTemplates.insert}). If omitted, writes
 *    to the main collection. Collection names may not start with an
 *    underscore.
 * @param {Object} dict A dictionary of key/value pairs. Every pair will be
 *    inserted into the given collection. Existing keys will be overwritten.
 * @function
 *//**
 * Writes the given data to the template data store. This method is the main
 *    mechanism to change the underlying data of templates. For example, if a
 *    template contains the expression `{{title}}`, this expression will
 *    always be replaced with the current value of the title key in the
 *    template data store.
 *
 * Be aware that data set using this method is synchronized across all your
 *    devices. Therefore, you can update the DOM on multiple devices with a
 *    single call to this method.
 * @param {String} [collection] An optional collection name. Collections can
 *    be thought of as "sub data stores". Using collections, you can insert
 *    multiple templates with the same expression, but have them display
 *    different data (also see {@link CWTemplates.insert}). If omitted, writes
 *    to the main collection. Collection names may not start with an
 *    underscore.
 * @param {String} key The storage key. This must be equal to the expression
 *    in your template - e.g. setting a value for the `title` key will affect
 *    the `{{title}}` expression in your templates. Cannot be `undefined`.
 * @param {Object} value The new value for the given key. Must be an object
 *    that can be converted to JSON. May not be a function or `undefined`.
 * @function
 */
CWTemplates.set = function(collection, key, value) {  
  if (value === undefined) {
    //Args: key, value
    value = key;
    key = collection;
    collection = '';
  }

  CWDatastore.set('_CWTemplates.'+collection, key, value);
}.bind(CWTemplates);


CWTemplates.setMultiple = function(collection, dict) {
  if (dict === undefined) {
    //Args: dict
    dict = collection;
    collection = '';
  }

  CWDatastore.setMultiple('_CWTemplates.'+collection, dict);
}.bind(CWTemplates);


/**
 * Retrieves the current value for the given key in the given collection.
 * @param  {String} [collection] The collection to retrieve the data from. If
 *    omitted, the main collection is used.
 * @param  {String} key The key under which the data was stored
 * @return {Object} The current value of the given key in the given collection
 *    or undefined if the collection or the key in that collection does not
 *    exist
 * @function
 */
CWTemplates.get = function(collection, key) {
  //If only one arg was given, collection was omitted and defaults to ''
  if (key === undefined) {
    key = collection;
    collection = '';
  }

  return CWDatastore.get('_CWTemplates.'+collection, key);
}.bind(CWTemplates);

/**
 * Compiles the given piece of template code. All <template> tags that contain
 *    a name attribute within that code will be registered as templates. After
 *    this step, the templates can be inserted using {@link
 *    CWTemplates.insert}.
 * @param  {String} templateData Ractive template code
 * @returns {Boolean} true if the template data contained at least one valid
 *    template, otherwise false
 * @function
 * @private
 */
CWTemplates._compile = function(templateData) {
  var content = $('<wrapper>');
  content.html(templateData);

  var that = this;

  var templates = content.find('template');
  var addedTemplates = 0;
  templates.each(function(index, template) {
    template = $(template);

    var name = template.attr('name');
    var content = CWUtil.unescape(template.html());

    if (name === undefined || name.length === 0) {
      CWDebug.err(1, "Found template without name - template is ignored. Template Content: "+content);
      return true;
    }

    CWDebug.log(3, "Registering template: "+name);
    that._templates.raw[name] = content;
    addedTemplates++;
  });

  if (addedTemplates < 1) return false;
  return true;
}.bind(CWTemplates);

CWModules.add('CWTemplates');
/*global CWModules */
'use strict';



/**
 * Utility module providing often-needed utility functions
 * @namespace CWUtil
 */
var CWUtil = CWUtil || {};


/**
 * Returns an object that parses the given URL into its parts
 * @param  {String} url  The URL to parse, must be a valid URL
 * @return {URL} A parsed URL object where the different parts of the URL can
 *    be accessed
 * @function
 */
CWUtil.parseURL = function(url) {
  var parser = document.createElement('a');
  parser.href = url;

  return parser;
}.bind(CWUtil);


/**
 * Returns the given string, replacing HTML entities with their HTML
 *    counterparts (e.g. `&lt` with `<`)
 * @param  {String} escaped A safe HTML string
 * @return {String} The input string with unescaped HTML entities 
 * @function       
 */
CWUtil.unescape = function(escaped) {
  return escaped.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
}.bind(CWUtil);


/**
 * Returns the coordinate of a given mouse event or the first touch in a touch
 *    event
 * @param  {TouchEvent|MouseEvent|jQuery.Event} e     A valid mouse or touch
 *    event or a jQuery event wrapping such an event. Note that events
 *    resulting from a "touchend" are not considered valid, as they do not
 *    contain any touches
 * @param  {String} [type="page"] A string representing the type of locarion
 *    that should be returned. Can be either "page", "client" or "screen". See
 *    [Touch Documentation]{@link
 *    https://developer.mozilla.org/en-US/docs/Web/API/Touch} or [MouseEvent
 *    Documentation]{@link
 *    https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent}
 * @return {Point}  The coordinate of the event
 * @function
 */
CWUtil.getEventLocation = function(e, type) {
  if (type === undefined) type = 'page';

  var seen = [];
  var pos = { x: e[type + 'X'], y: e[type + 'Y'] };
  if (pos.x === undefined || pos.y === undefined)
  {
    var touches = (e.originalEvent === undefined) ? e.targetTouches : e.originalEvent.targetTouches;
    pos = { x: touches[0][type + 'X'], y: touches[0][type + 'Y'] };
  }

  return pos;
}.bind(CWUtil);


/**
 * Returns a random integer between min (inclusive) and max (inclusive). If
 *    only one parameter is given, returns a random number between 0 and that
 *    number. If no parameters are given, returns a random number between 0
 *    and Number.MAX_VALUE
 * @param  {Number} [min=0] The smallest possible value that is returned
 * @param  {Number} [max=Number.MAX_VALUE] The largest possible value that is
 *    returned
 * @return {Number} The generated random number between min and max
 * @function
 */
CWUtil.randomInt = function(min, max) {
  //Only one parameter was given, use it as max, 0 as min
  if (max === undefined && min !== undefined) {
    max = min;
    min = 0;
  //No parameter was given, use 0 as min, maxint as max
  } else if (max === undefined && min === undefined) {
    min = 0;
    max = Number.MAX_VALUE;
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}.bind(CWUtil);


/**
 * Checks if the given object is a valid Int
 * @param {Object} value  The object to check
 * @returns {Boolean}  true if the given value is an Int, otherwise false
 * @function
 */
CWUtil.isInt = function(value) {
  return (value === parseInt(value));
}.bind(CWUtil);


/**
 * Checks if the given object is a valid String
 * @param  {Object}  value  The object to check
 * @return {Boolean} true if the given value is a String, otherwise false
 * @function
 */
CWUtil.isString = function(value) {
  return (typeof(value) === 'string');
}.bind(CWUtil);


/**
 * Checks if the given object is a function
 * @param  {Object}  value The object to check
 * @return {Boolean} true if the given value is a function, otherwise false
 * @function
 */
CWUtil.isFunction = function(value) {
  return (typeof(value) === 'function');
}.bind(CWUtil);


/**
 * Checks if the given object is an object and not null.
 * @param {Object} value  The object to check
 * @returns {Boolean}   true if the given object is an object, false otherwise
 *    (e.g. for null, undefined or a primitive type).
 * @function
 */
CWUtil.isObject = function(value) {
  return (typeof(value) === 'object' && value !== null);
}.bind(CWUtil);


/**
 * Checks if the given object is an array
 * @param  {Object}  value The object to checl
 * @return {Boolean} true if the given object is an array, otherwise false
 * @function
 */
CWUtil.isArray = function(value) {
  return Array.isArray(value);
}.bind(CWUtil);

/**
 * Checks if the given value is in the given array.
 * @param {object} value The value to check
 * @param {array} array The array that the value should be in
 * @returns {boolean} true if value is in array, otherwise false
 * @function
 */
CWUtil.inArray = function(value, array) {
  return (array.indexOf(value) > -1);
}.bind(CWUtil);

/**
 * Creates a new random v4 UUID, thanks to {@link
 *    https://gist.github.com/jed/982883}
 * @return {String} A random v4 UUID string
 * @function
 * @protected
 */
CWUtil.createUUID = function(a) { 
  return a?(a ^ Math.random() * 16 >> a / 4).toString(16):([ 1e7 ] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g,CWUtil.createUUID);
}.bind(CWUtil);

CWModules.add('CWUtil');
'use strict';

/**
 * Constructs a new CWVector object from a start and an end point
 * @param {Point} p1  Start point of the vector
 * @param {Point} p2 End point of the vector
 * @class
 * @classdesc Represents a two-dimensional vector with a start and an end point
 */
function CWVector(p1, p2) {
  if (p1 === undefined || p2 === undefined) throw 'Cannot instantiate Vector without 2 points';

  /**
   * Start point of the vector
   * 
   * @type {Point}
   * @private
   */
  this._p1 = p1;

  /**
   * End point of the vector
   * 
   * @type {Point}
   * @private
   */
  this._p2 = p2;
}


/**
 * Returns the delta between the x values of the two points of the vector
 * 
 * @return {Number}
 *         The delta x value
 */
CWVector.prototype.deltaX = function() {
  return this._p2.x - this._p1.x;
};


/**
 * Returns the delta between the y values of the two points of the vector
 * 
 * @return {Number}
 *         The delta y value
 */
CWVector.prototype.deltaY = function() {
  return this._p2.y - this._p1.y;
};


/**
 * Returns the length of the vector
 * 
 * @return {Number}
 *         The vector's length
 */
CWVector.prototype.length = function() {
  return Math.sqrt(Math.pow(this._deltaX, 2) + Math.pow(this._deltaY, 2));
};


/**
 * Returns the angle between this vector and the given vector
 * 
 * @param  {CWVector} otherVector 
 *         The vector to measure the angle to
 * @return {Number}
 *         The angle between this vector and the given vector
 */
CWVector.prototype.angleBetween = function(otherVector) {
  var vectorsProduct = this.deltaX() * otherVector.deltaX() + this.deltaY() * otherVector.deltaY();
  var vectorsLength = this.length() * otherVector.length();
  return Math.acos(vectorsProduct / vectorsLength) * (180.0 / Math.PI);
};



/**
 * Returns the start point of the vector
 *
 * @return {Point}
 *         The start point of the vector
 */
CWVector.prototype.getP1 = function() {
  return this._p1;
};

/**
 * Returns the end point of the vector
 * 
 * @return {Point}
 *         The end point of the vector
 */
CWVector.prototype.getP2 = function() {
  return this._p2;
};
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
    CWDatastore._set(collection, collectionContent, undefined, false, true);
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
/* global CWEventManager, CWDevice, CWNativeBridge, CWUtil, CWDebug, CWModules */
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
  //We cannot have a non-native master, redirect to the remote page
  if (CWNativeBridge.isRunningNative() !== true && Connichiwa.isMaster()) {
    var parsedURL = new CWUtil.parseURL(document.URL);
    window.location = 'http://' + parsedURL.hostname + ':' + parsedURL.port + '/remote';
    return;
  }

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
    CWDebug.log(1, 'Fire immediately');
    //Timeout so the callback is always called asynchronously
    window.setTimeout(callback, 0);
  } else {
    CWDebug.log(1, 'Fire delayed');
    this.on('ready', callback);
  }
}.bind(Connichiwa);


//TODO remove, find an easy way to send a message to the master
Connichiwa.send = function(target, name, message) {
  message._name = name;
  message._source = Connichiwa.getIdentifier();
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

CWModules.add('Connichiwa');
/**
 * Represents a two-dimensional points
 * @typedef Point
 * @type Object
 * @property {Number} x  The x coordinate of the point
 * @property {Number} y  The y coordinate of the point
 */

/**
 * Represents a valid URL
 * @typedef URL
 * @type Object
 * @property {String} protocol  The protocol of the URL (e.g. http)
 * @property {String} hostname  The host name part of the URL (e.g.
 *    "example.com")
 * @property {String} host  The host part of the URL, which is the hostname
 *    plus port
 * @property {String} pathname  The path of the URL (e.g. "/some/path")
 * @property {Number} port The port of the URL, empty if no port was given
 * @property {String} search The query string of the URL
 * @property {String} hash The hash of the URL
 * @property {String} requestUri The URL without the protocol, hostname and
 *    port (e.g. "/some/path?var=value#ahash")
 */
/**
 * This event is a global, internal synonym for the {@link
 *    Connichiwa.event:onLoad} event
 * @event ready 
 */

/**
 * This event is fired after Connichiwa was loaded and set up properly. You
 *    can attach an event handler to this event by using the {@link
 *    Connichiwa.onLoad} method.
 *
 * On remotes, onLoad will further ensure that every script added to {@link
 *    Connichiwa.autoLoad} is loaded, so your code can rely on variables and
 *    methods created in these scripts.
 * @event onLoad
 * @memberOf  Connichiwa
 */

/**
 * This event is fired when an acknowledgment for receiving a message is
 *    received. Such an acknowledgment can be sent using {@link
 *    Connichiwa._sendAck}. The `{ID}` in the event name is replaced with the
 *    ID of the message that was acknowledged. This way, a callback function
 *    can be registered for the acknowledgement of a specific message using
 *    {@link CWEventManager.on}
 * @event __ack_message{ID}
 * @param {Object} message TODO
 * @protected
 */

/**
 * This event is fired when a swipe was detected on this device that could
 * be part of a stitch
 * @event stitchswipe
 * @param {Object} message TODO
 * @protected
 */

/**
 * This event is fired when this device was stitched to another device. This
 *    means the device's relative location changed, which can be retrieved
 *    using {@link CWStitchManager.getLocalDeviceTransformation}
 * @event wasStitched
 * @param {Object} message TODO
 */

/**
 * This event is fired when this device was unstitched. The device's relative
 *    position is now unknown and {@link
 *    CWStitchManager.getLocalDeviceTransformation} will return default values
 * @event wasUnstitched
 * @param {Object} message TODO
 */

/**
 * This event is fired when this device was used by another device to
 *    determine the other device's relative position (which means the other
 *    device is places next to this device)
 * @event gotstitchneighbor
 * @param {Object} message TODO
 */

/**
 * This event is fired at a regular interval (usually every ~500ms) and
 *    contains the latest gyroscope data from the device. If the device does
 *    not feature a gyroscope, this event is never fired.
 * @event gyroscopeUpdate
 * @param {CWGyroscope.GyroscopeData} data The latest gyroscope data
 */

/**
 * This event is fired at a regular interval (usually every ~500ms) and
 *    contains the latest accelerometer data from the device. If the device
 *    does not feature an accelerometer, this event is never fired.
 * @event accelerometerUpdate
 * @param {CWGyroscope.AccelerometerData} data The latest accelerometer data
 */

/**
 * This event is fired when a new device is detected over Bluetooth
 * @event devicedetected
 * @param {CWDevice} device The detected device
 */

/**
 * This event is fired when the approximated distance between the master and a
 *    detected device changes. If multiple devices are nearby, this method is
 *    called for each device seperately
 * @event devicedistancechanged
 * @param {CWDevice} device The device whose distance was changed
 */

/**
 * This event is fired whenever a previously detected device is lost (for
 *    example because it is switched off, closes the app or goes out of
 *    Bluetooth-range)
 * @event devicelost
 * @param {CWDevice} device The lost device
 */

/**
 * This event is fired whenever a device connects to the master's server,
 *    either as the result of a call to {@link CWDevice#connect} or becuase it
 *    manually connected (e.g. through a webbrowser)
 * @event deviceconnected
 * @param {CWDevice} device The connected device
 */

/**
 * This event is fired whenever the connection attempt to a detected but
 *    unconnected device failed. Such an attempt can fail, for example, if the
 *    two devices do not share a common network and are unable to connect over
 *    an ad hoc network. This is the opposing event to {@link
 *    event:remoteconnected}
 * @event connectfailed
 * @param {CWDevice} device The device that could not be connected
 */

/**
 * This event is fired when a previously connected remote device has
 *    disconnected. A disconnect can happen for example because the app was
 *    closed, the device was switched off, the device connected to another
 *    device but also because of network failures. A disconnected device can
 *    still be discovered if it remains in Bluetooth-range, in which case it
 *    will continue to send events such as {@link event:devicedistancechanged}
 * @event devicedisconnected
 * @param {CWDevice} device The device that disconnected
 */'use strict';

;(function($) {
  $(function() {
    /**
     * This method takes an arrya of deferred objects and returns a new
     *    "master" deferred object. The master will wait for all passed
     *    deferreds to either resolve or fail. It will then:
     *
     * * Be resolved if all deferreds were resolved * Fail if one or more
     *    deferreds failed
     *
     * In contrast to passing multiple deferreds to jQuery's $.when directly,
     *    the master deferred is not immediately rejected as soon as a single
     *    deferred fails. Instead, it waits for all deferreds to resolve or
     *    reject.
     * @copyright Roman Rädle <roman.raedle at uni-konstanz.de >
     * @param  {Array} deferreds An array of jQuery Deferred objects
     * @return {$.Deferred} A jQuery Deferred object that is rejected or
     *    resolved when all passed deferreds have been rejected or resolved
     */
    $.when.all = function(deferreds) {
      var masterDeferred = new $.Deferred();

      //Walk over all our deferreds and wait for all of them to either 
      //resolve or fail:
      //* When all have resolved, resolve the master
      //* When one or more fail, reject the master
      var remaining = deferreds.length;
      var anyReject = false;
      $.each(deferreds, function(i, deferred) {
        deferred.fail(function() {
          anyReject = true;
        }).always(function() {
          remaining--;
          if (remaining === 0) {
            if (anyReject) masterDeferred.reject();
            else masterDeferred.resolve();
          }
        });
      });

      return masterDeferred;
    };
  });
})(jQuery);
/* global CWDevice, CWNativeBridge */
'use strict';



/**
 * (Available on master device only)
 *
 * Tries to establish a HTTP connection to the device. This is only possible
 *    if the device has been discovered over Bluetooth ({@link
 *    CWDevice#isNearby} returns `true`). If the device is already connected,
 *    calling this method will have no effect.
 */
CWDevice.prototype.connect = function() {
  if (this._canBeConnected() === false) return;

  this._connectionState = CWDevice.ConnectionState.CONNECTING;
  CWNativeBridge.callOnNative('nativeCallConnectRemote', this.getIdentifier());
};
/* global CWDevice, CWDebug, CWModules */
'use strict';



/**
 * (Available on master device only)
 * 
 * This manager keeps track of all devices in the Connichiwa infrastructure.
 *    Devices can be added, removed and requested. Further, this manager keeps
 *    track of the local device of the master.
 * @namespace CWDeviceManager
 */
var CWDeviceManager = CWDeviceManager || {};


/**
 * (Available on master device only)
 * 
 * The CWDevice instance that represents the local (master) device, or
 *    undefined if it has not yet been created
 * @type {CWDevice}
 * @private
 */
CWDeviceManager._localDevice = undefined;


/**
 * (Available on master device only)
 * 
 * An array of remote CWDevice objects that represent the currently connected
 *    devices
 * @type {Array}
 * @default [ ]
 * @private
 */
CWDeviceManager._remoteDevices = [];


/**
 * (Available on master device only)
 * 
 * Adds a device to the manager. Everytime a new device is detected or
 *    connects, this method should be called
 * @param {CWDevice} newDevice The newly detected or conected device
 * @return {Boolean} true if the device was added, false otherwise
 * @function
 * @protected
 */
CWDeviceManager.addDevice = function(newDevice) {
  if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw 'Cannot add a non-device';
  if (this.getDeviceWithIdentifier(newDevice.getIdentifier()) !== null) return false;

  CWDebug.log(3, 'Added device: ' + newDevice.getIdentifier());

  this._remoteDevices.push(newDevice);
  return true;
}.bind(CWDeviceManager);


/**
 * (Available on master device only)
 * 
 * Removes the given device from the manager. Everytime a device is lost or
 *    disconnects, this method should be called
 * @param  {CWDevice|String} identifier The CWDevice to remove or the device's
 *    identifier
 * @return {Boolean} true if the device was removed, false otherwise
 * @function
 * @protected
 */
CWDeviceManager.removeDevice = function(identifier) {
  if (CWDevice.prototype.isPrototypeOf(identifier) === true) identifier = identifier.getIdentifier();
    
  var device = this.getDeviceWithIdentifier(identifier);
  if (device === null) return false;

  CWDebug.log('Removed device: ' + identifier);

  var index = this._remoteDevices.indexOf(device);
  this._remoteDevices.splice(index, 1);
  
  return true;
}.bind(CWDeviceManager);


/**
 * (Available on master device only)
 * 
 * Returns the CWDevice object for a given identifier
 * @param  {String} identifier The identifier of a device
 * @return {?CWDevice} The CWDevice that has the given identifier, or null if
 *    no device matches
 * @function
 */
CWDeviceManager.getDeviceWithIdentifier = function(identifier) {
  if (this._localDevice !== undefined && 
    (identifier === this._localDevice.getIdentifier() || identifier === 'master')) {
    return this._localDevice;
  }
  
  for (var i = 0; i < this._remoteDevices.length; i++)
  {
    var remoteDevice = this._remoteDevices[i];
    if (remoteDevice.getIdentifier() === identifier)
    {
      return remoteDevice;
    }
  }

  return null;
}.bind(CWDeviceManager);


/**
 * (Available on master device only)
 *
 * Returns an array of all devices that are connected over HTTP and Websocket 
 * @return {CWDevice} An array of all devices that are currently connected to
 *    the master
 * @function
 */
CWDeviceManager.getConnectedDevices = function() {
  var connectedDevices = [];
  for (var i = 0; i < this._remoteDevices.length; i++)
  {
    var remoteDevice = this._remoteDevices[i];
    if (remoteDevice.isConnected()) connectedDevices.push(remoteDevice);
  }

  return connectedDevices;
}.bind(CWDeviceManager);


/**
 * (Available on master device only)
 *
 * Creates the local device of the master. Only one such device can be
 *    created. If a local device already exists, this method will do nothing
 * @param  {Object} properties The local device's properties
 * @return {Bolean} true if the local device was created, otherwise false  
 * @function
 * @protected          
 */
CWDeviceManager.createLocalDevice = function(properties) {
  if (this._localDevice !== undefined) return false;

  properties.isLocal = true;

  this._localDevice = new CWDevice(properties);
  this._localDevice._discoveryState = CWDevice.DiscoveryState.LOST;
  this._localDevice._connectionState = CWDevice.ConnectionState.CONNECTED;

  CWDebug.log(3, 'Created local device: ' + JSON.stringify(properties));

  return true;
}.bind(CWDeviceManager);


/**
 * Returns the local device or undefined if it has not yet been created
 * @function
 */
CWDeviceManager.getLocalDevice = function() {
  return this._localDevice;
}.bind(CWDeviceManager);

CWModules.add('CWDeviceManager');
/* global Connichiwa, CWDeviceManager, CWEventManager, CWDevice, CWDebug, CWModules */
'use strict';



var CWNativeBridge = CWNativeBridge || {};


/**
 * @override
 * @ignore
 */
CWNativeBridge.parse = function(message) {
  CWDebug.log(4, 'Parsing native message (master): ' + message);
  var object = JSON.parse(message);
  switch (object._name)
  {
    case 'debuginfo':             this._parseDebugInfo(object); break;
    case 'connectwebsocket':      this._parseConnectWebsocket(object); break;
    case 'localinfo':             this._parseLocalInfo(object); break;
    case 'devicedetected':        this._parseDeviceDetected(object); break;
    case 'devicedistancechanged': this._parseDeviceDistanceChanged(object); break;
    case 'devicelost':            this._parseDeviceLost(object); break;
    case 'remoteconnectfailed':   this._parseRemoteConnectFailed(object); break;
    case 'remotedisconnected':    this._parseRemoteDisconnected(object); break;
    case 'disconnectwebsocket':   this._parseDisconnectWebsocket(object); break;
  }
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `debuginfo` messages. Such information are used to apply the native
 *    layer's debug settings on the JS library
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @private
 */
CWNativeBridge._parseDebugInfo = function(message) {
  CWDebug._setDebugInfo(message);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `connectwebsocket` messages. Such messages are sent when the native
 *    layer is ready to receive websocket connections and we can connect to
 *    the websocket
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @private
 */
CWNativeBridge._parseConnectWebsocket = function(message) {
  Connichiwa._connectWebsocket();
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `localinfo` messages. Such messages contain the information about
 *    this device as determined by the native layer. The message will create
 *    the local device after which the JS library is considered "ready"
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires ready
 * @private
 */
CWNativeBridge._parseLocalInfo = function(message) {
  var success = CWDeviceManager.createLocalDevice(message);
  if (success)
  {
    Connichiwa._sendObject(message); //needed so server recognizes us as local weblib
    CWEventManager.trigger('ready');
  }
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `devicedetected` messages. Such a message is sent by the native
 *    layer if a Bluetooth-enabled Connichiwa device is nearby. This will
 *    create a new CWDevice and report the detection to the application
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires devicedetected
 * @private
 */
CWNativeBridge._parseDeviceDetected = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  
  //We might re-detect a lost device, so it is possible that the device is already stored
  if (device === null)
  {
    device = new CWDevice(message);
    CWDeviceManager.addDevice(device);
  }
  device._discoveryState = CWDevice.DiscoveryState.DISCOVERED;

  CWDebug.log(2, 'Detected device: ' + device.getIdentifier());
  CWEventManager.trigger('deviceDetected', device);

  //If autoconnect is enabled, the device that launched first will 
  //automatically connect to all other devices
  if (Connichiwa.autoConnect === true) {
    var localDevice = CWDeviceManager.getLocalDevice();
    if (localDevice.getLaunchDate() < device.getLaunchDate()) {
      device.connect();
    }
  } 
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `devicedistancechanged` messages. Such a message is sent by the
 *    native layer if the approximated distance between the master and a
 *    detected device changes
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires devicedistancechanged
 * @private
 */
CWNativeBridge._parseDeviceDistanceChanged = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  if (device === null) return;
  
  device._distance = parseFloat(message.distance);
  CWDebug.log(5, 'Updated distance of device ' + device.getIdentifier() + ' to ' + device.getDistance());
  CWEventManager.trigger('deviceDistanceChanged', device);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `devicelost` messages. Such a message is sent by the native layer if
 *    a previously detected device is lost (for example because it is switched
 *    off, closes the app or goes out of Bluetooth-range)
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires devicelost
 * @private
 */
CWNativeBridge._parseDeviceLost = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  device._discoveryState = CWDevice.DiscoveryState.LOST;

  CWDebug.log(2, 'Lost device: ' + device.getIdentifier());
  CWEventManager.trigger('deviceLost', device);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `remoteconnectfailed` messages. Such a message is sent by the native
 *    layer if the connection attempt to a detected but unconnected device
 *    failed. Such an attempt can fail, for example, if the two devices do not
 *    share a common network and are unable to connect over an ad hoc network
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires connectfailed
 * @private
 */
CWNativeBridge._parseRemoteConnectFailed = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  device._connectionState = CWDevice.ConnectionState.DISCONNECTED;

  CWDebug.log(2, 'Connection to remote device failed: ' + device.getIdentifier());
  CWEventManager.trigger('connectFailed', device);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `remotedisconnected` messages. Such a message is sent by the native
 *    layer if a previously connected remote device has disconnected. A
 *    disconnect can happen for example because the app was closed, the device
 *    was switched off, the device connected to another device but also
 *    because of network failures
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @fires devicedisconnected
 * @private
 */
CWNativeBridge._parseRemoteDisconnected = function(message) {
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
  if (device === null) return;
    
  device._connectionState = CWDevice.ConnectionState.DISCONNECTED;

  CWDebug.log(2, 'Device disconnected: ' + device.getIdentifier());
  CWEventManager.trigger('deviceDisconnected', device);
}.bind(CWNativeBridge);


/**
 * (Available on master device only) 
 * 
 * Parses `remotedisconnected` messages. Such a message is sent by the native
 *    layer whenever the websocket connection to the server should be
 *    disconnected. This can be the case, for example, when the app is
 *    suspended on the device and the server is suspended
 * @param  {Object} message The object that represents the JSON message that
 *    was received from the native layer
 * @function
 * @private
 */
CWNativeBridge._parseDisconnectWebsocket = function(message) {
  Connichiwa._disconnectWebsocket();  
}.bind(CWNativeBridge);

CWModules.add('CWNativeBridge');
/* global Connichiwa, CWDevice, CWDeviceManager, CWEventManager, CWDebug, CWModules */
'use strict';



var CWStitchManager = CWStitchManager || {};


/**
 * (Available on master device only)
 * 
 * An object that contains all stitchswipes from all the devices
 * @type {Object}
 * @private
 */
CWStitchManager._swipes = {};


/**
 * (Available on master device only)
 * 
 * An object that contains all the device transformation of all stitched
 * devices
 * @type {Object}
 * @private
 */
CWStitchManager._devices = {};



/**
 * (Available on master device only)
 *
 * Returns the transformation of the given device
 * @param  {CWDevice} device The device to get the transformation of
 * @return {CWStitchManager.DeviceTransformation} The device transformation of
 *    the device
 * @function
 */
CWStitchManager.getDeviceTransformation = function(device) {
  return this._getDeviceTransformation(device, false);
}.bind(CWStitchManager);


/**
 * (Available on master device only)
 *
 * Same as {@link CWStitchManager.getDeviceTransformation}. The forceRecent
 *    parameter can be used to avoid the return of cached information.
 *    Usually, the transformation for the local device in {@link
 *    CWStitchManager._devices} is updated earlier and {@link
 *    CWStitchManager.getDeviceTransformation} then returns cached information
 *    so the device transformation for the application does not change until
 *    the {@link event:wasStitched} event arrived. Only after the event was
 *    fired the cached information is updated as well.
 * @param  {CWDevice} device The device to return the transformation of
 * @param  {Boolean} [forceRecent=false] Set to true to ensure that no cached
 *    transformation are returned
 * @return {CWStitchManager.DeviceTransformation} The device transformation of
 *    the device
 * @function
 * @private
 */
CWStitchManager._getDeviceTransformation = function(device, forceRecent) {
  if (device === undefined) device = Connichiwa.getIdentifier();
  if (CWDevice.prototype.isPrototypeOf(device)) device = device.getIdentifier();

  if (forceRecent === undefined) forceRecent = false;

  //If the local device is requested and forceRecent is not true, we return
  //getLocalDeviceTransformation, which could be cached
  if (device === Connichiwa.getIdentifier() && forceRecent !== true) {
    return this.getLocalDeviceTransformation();
  }

  var data = this._getStitchData(device);
  if (data === undefined) return this.getDefaultDeviceTransformation();

  return { 
    width    : data.width,
    height   : data.height, 
    x        : data.transformX, 
    y        : data.transformY,
    rotation : data.rotation,
    scale    : data.scale
  };
}.bind(CWStitchManager);


/**
 * (Available on master device only)
 * 
 * Called whenever a stitchswipe was performed on a device (either local or
 *    remote). The method checks the new swipe against all other swipes. If
 *    two swipes match (e.g. by direction and time), they are considered a
 *    stitch and the devices will be stitched
 * @param  {Object} data The stitchswipe's data
 * @function
 * @protected
 */
CWStitchManager.detectedSwipe = function(data) {
  var swipe = {
    date         : new Date(),
    device       : data.device,
    edge         : data.edge,
    width        : data.width,
    height       : data.height,
    x            : data.x,
    y            : data.y
  };

  var device = CWDeviceManager.getDeviceWithIdentifier(swipe.device);
  if (device === null || device.isConnected() === false) return;

  CWDebug.log(3, 'Detected swipe on ' + swipe.device + ' on edge ' + swipe.edge );

  //Check if the swipe combines with another swipe to a stitch
  for (var key in this._swipes) {
    var savedSwipe = this._swipes[key];

    CWDebug.log(4, 'Checking existing swipe: '+key);

    //We can't create a stitch on a single device
    if (savedSwipe.device === swipe.device) continue;

    CWDebug.log(4, 'Checking time constraint');

    //If the existing swipe is too old, it is invalid
    if ((swipe.date.getTime() - savedSwipe.date.getTime()) > 1000) continue;

    CWDebug.log(4, 'Checking connection constraint');

    //Check if the other device is still connected
    var savedDevice = CWDeviceManager.getDeviceWithIdentifier(savedSwipe.device);
    if (savedDevice === null || savedDevice.isConnected() === false) continue;

    this._detectedStitch(savedSwipe, swipe);
    return;

    //TODO remove the swipes?
  }

  //If the swipe does not seem to be part of a stitch, remember it for later
  this._swipes[swipe.device] = swipe;
}.bind(CWStitchManager);


/**
 * (Available on master device only)
 * 
 * Will unstitch the device with the given identifier and send a message to
 *    the device to let it know that it was unstitched. The device is then
 *    responsible for resettings its device transformation
 * @param  {String} identifier The identifier string of the device that should
 *    be unstitched
 * @function
 * @protected
 */
CWStitchManager.unstitchDevice = function(identifier) {
  if (identifier in this._devices) {
    var unstitchMessage = { 
      deviceTransformation : this.getDeviceTransformation(identifier)
    };
    Connichiwa.send(identifier, '_wasunstitched', unstitchMessage);

    delete this._devices[identifier];
    CWDebug.log(3, 'Device was unstitched: ' + identifier);

    //We do not unstitch the last device because once a global coordiante
    //system is established, it should be kept
  }
}.bind(CWStitchManager);



/**
 * (Available on master device only)
 *
 * Should be called whenever two stitchswipes match and form a stitch. The
 *    swipe data of the two swipes that matched must be passed to this
 *    function.
 * @param  {Object} firstSwipe  First swipe data
 * @param  {Object} secondSwipe Second swipe data
 * @function
 * @private
 */
CWStitchManager._detectedStitch = function(firstSwipe, secondSwipe) {     
  //If no device is stitched yet, we automatically stitch the first device
  //This device will then become the reference and its origin and axis will be the origin
  //and axis of the global coordinate system
  if (Object.keys(this._devices).length === 0) {
    //If one of the devices is the master, make sure we stitch it first
    //Some applications might rely on that, and those that don't are not harmed
    if (secondSwipe.device === Connichiwa.getIdentifier()) {
      var tempSwipe = firstSwipe;
      firstSwipe = secondSwipe;
      secondSwipe = tempSwipe;
    }
    var stitchData = this._createStitchData(firstSwipe.device);
    stitchData.width  = firstSwipe.width;
    stitchData.height = firstSwipe.height;
    this._devices[firstSwipe.device] = stitchData;

    //Send out messages to the stitched device and the master
    CWDebug.log(3, 'First device was auto-stitched: '+JSON.stringify(stitchData));
    CWEventManager.trigger('stitch', secondSwipe.device, firstSwipe.device);

    var wasstitchMessage = {
      otherDevice          : secondSwipe.device,
      edge                 : firstSwipe.edge, //TODO should this be in here? and if so, should it be relative?
      deviceTransformation : this._getDeviceTransformation(firstSwipe.device, true)
    };
    Connichiwa.send(firstSwipe.device, '_wasstitched', wasstitchMessage);
  }

  //
  // PREPARATION
  // 
  
  //Exactly one of the two swiped devices need to be stitched already
  //We use that device as a reference to calculate the position of the new device
  var firstStitchData  = this._getStitchData(firstSwipe.device);
  var secondStitchData = this._getStitchData(secondSwipe.device);
  if (firstStitchData === undefined && secondStitchData === undefined) return;
  if (firstStitchData !== undefined && secondStitchData !== undefined) return;

  //Determine which device is already stitched
  //From now on, everything prefixed with "stitched" will describe that device,
  //everthing prefixed with "new" describes the device that should be added
  var stitchedSwipe, newSwipe;
  if (firstStitchData !== undefined) {
    stitchedSwipe = firstSwipe;
    newSwipe      = secondSwipe;
  } else {
    stitchedSwipe = secondSwipe;
    newSwipe      = firstSwipe;
  }

  //Grab the CWDevice objects
  var stitchedDevice = CWDeviceManager.getDeviceWithIdentifier(stitchedSwipe.device);
  var newDevice      = CWDeviceManager.getDeviceWithIdentifier(newSwipe.device);

  var stitchedStitchData = this._getStitchData(stitchedSwipe.device);
  var newStitchData      = this._createStitchData(newSwipe.device);

  // CWDebug.log(3, "Stitched Swipe: "+JSON.stringify(stitchedSwipe));
  // CWDebug.log(3, "New Swipe: "+JSON.stringify(newSwipe));
  // CWDebug.log(3, "Stitched Device: "+JSON.stringify(stitchedDevice));

  //Calculate the scaling of the new device relative to the master
  //This compensates for different PPIs on devices - content should appear the
  //same size on all of them
  newStitchData.scale = newDevice.getPPI() / stitchedDevice.getPPI() * stitchedStitchData.scale;

  //Calculate the rotation of the device relative to the master
  //If a device is rotated and the OS detects an orientation change (portrait/landscape)
  //the OS will take care of rotating the webview. But if the orientation
  //is not changed, for example when the device is rotated on the table, we need
  //to take care of translating and rotating ourselves, so the stitched devices
  //get homogenous content
  var rotation = 0;
  var rotationIndex = this._indexForEdge(stitchedSwipe.edge) - this._indexForEdge(newSwipe.edge);
  if (rotationIndex < 0) rotationIndex += 4;
  if (rotationIndex === 2) rotation = 0;
  if (rotationIndex === 3) rotation = 90;
  if (rotationIndex === 1) rotation = 270;
  if (rotationIndex === 0) rotation = 180;
  newStitchData.rotation = (rotation + stitchedStitchData.rotation) % 360; //make relative to master
  // CWDebug.log(3, "Devices edges: "+this._indexForEdge(stitchedSwipe.edge)+", "+this._indexForEdge(newSwipe.edge));

  //
  // RELATIVE SWIPE DATA
  // 
  // Here is where it gets interesting: We need to translate both device's swipes
  // to compensate for their rotation. This way, the x/y and width/height is adjusted
  // as if both devices had a 0º rotation - and only then can we actually calculate
  // with their values in order to determine their relative position.
  // 
  // The calculations are rather straightforward if you think about it, let's
  // take 90º as an example: The y value of a 90º device is the x-axis of a 0º 
  // device. The x value is the y-axis, but swapped: An x value of 0 becomes a large
  // y value, because its at the top of the device (and therefore a bigger y). An
  // x value of "width" therefore becomes a y value of 0.
  // 
  // Note that we also adjust the relative values by the device's scale - this way,
  // both relative swipes are scaled to the master device and are fully comparable.
  // 
  // Also, we rotate the edges: If a device is rotated 90º and the "top" edge is
  // swiped, this physically is the "left" edge (from a user perspective).
  // 
  
  function rotateSwipe(swipe, rotation) {
    var result = {};
    if (rotation === 0) {
      result.y      = swipe.y;
      result.x      = swipe.x;
      result.width  = swipe.width;
      result.height = swipe.height;
    }
    if (rotation === 90) {
      result.y      = swipe.width - swipe.x;
      result.x      = swipe.y;
      result.width  = swipe.height;
      result.height = swipe.width;
    }
    if (rotation === 180) {
      result.y      = swipe.height - swipe.y;
      result.x      = swipe.width  - swipe.x;
      result.width  = swipe.width;
      result.height = swipe.height;
    }
    if (rotation === 270) {
      result.y      = swipe.x;
      result.x      = swipe.height - swipe.y;
      result.width  = swipe.height;
      result.height = swipe.width;
    }

    return result;
  } 
  
  
  var newRelativeSwipe = rotateSwipe(newSwipe, newStitchData.rotation);
  newRelativeSwipe.edge = (this._indexForEdge(newSwipe.edge) + (newStitchData.rotation / 90)) % 4;

  newRelativeSwipe.y      /= newStitchData.scale;
  newRelativeSwipe.x      /= newStitchData.scale;
  newRelativeSwipe.width  /= newStitchData.scale;
  newRelativeSwipe.height /= newStitchData.scale;

  //
  // And the same thing for the stitched device
  //
  
  var stitchedRelativeSwipe = rotateSwipe(stitchedSwipe, stitchedStitchData.rotation);
  stitchedRelativeSwipe.edge = (this._indexForEdge(stitchedSwipe.edge) + (stitchedStitchData.rotation / 90)) % 4;

  stitchedRelativeSwipe.y      /= stitchedStitchData.scale;
  stitchedRelativeSwipe.x      /= stitchedStitchData.scale;
  stitchedRelativeSwipe.width  /= stitchedStitchData.scale;
  stitchedRelativeSwipe.height /= stitchedStitchData.scale;

  //
  // DETERMINE THE NEW STITCH DATA
  // 
  // Now we have everything we need and can actually determine the stitch data
  // of the new device: This means we can calculate its translation relative to
  // the origin of the master and its adjusted (relative and scaled) width and height
  // This is the data that will be sent to the device and that the device can use
  // to transform its content
  // 

  //Make sure the stitch data contains original and relative width/height
  newStitchData.width        = newRelativeSwipe.width;
  newStitchData.height       = newRelativeSwipe.height;
  newStitchData.deviceWidth  = newSwipe.width;
  newStitchData.deviceHeight = newSwipe.height;

  //Finally, what we actually wanted all along: The translation now becomes a
  //simple matter of calculating the relative position between the "stitched"
  //and the "new" device. It should, we worked goddamn hard for that!
  newStitchData.transformX = stitchedStitchData.transformX + stitchedRelativeSwipe.x - newRelativeSwipe.x;
  newStitchData.transformY = stitchedStitchData.transformY + stitchedRelativeSwipe.y - newRelativeSwipe.y;

  // CWDebug.log(3, "Stitched Data: "+JSON.stringify(stitchedStitchData));
  // CWDebug.log(3, "New Data: "+JSON.stringify(newStitchData));
  // CWDebug.log(3, "Stitched Relative Swipe: "+JSON.stringify(stitchedRelativeSwipe));
  // CWDebug.log(3, "New Relative Swipe: "+JSON.stringify(newRelativeSwipe));
  
  //Finish it up: Add the device to the stitched data array and send messages
  //to the master ("stitch"), the new device ("wasstitched") and the 
  //other device ("gotstitchneighbor")
  this._devices[newSwipe.device] = newStitchData;

  CWDebug.log(3, 'Device was stitched: '+JSON.stringify(newStitchData));
  CWEventManager.trigger('stitch', stitchedSwipe.device, newSwipe.device);

  var wasstitchMessage = {
    otherDevice          : stitchedSwipe.device,
    edge                 : newSwipe.edge, //TODO should this be in here? and if so, should it be relative?
    deviceTransformation : this._getDeviceTransformation(newSwipe.device, true)
  };
  newDevice.send('_wasstitched', wasstitchMessage);

  var gotneighborMessage = {
    otherDevice          : newSwipe.device,
    edge                 : stitchedSwipe.edge, //TODO should this be in here? and if so, should it be relative?
  };
  stitchedDevice.send('_gotstitchneighbor', gotneighborMessage);
}.bind(CWStitchManager);


/**
 * (Available on master device only)
 * 
 * Creates and returns a new stitch data object with default values
 * @param  {String} device The device's identifier of the device where the
 *    stitch occured on
 * @return {Object} Stitch data object, contains the keys "device", "width",
 *    "height", "transformX", "transformY", "rotation", "scale"       
 * @function
 * @private
 */
CWStitchManager._createStitchData = function(device) {
  return {
    device     : device,
    width      : 0,
    height     : 0,
    transformX : 0,
    transformY : 0,
    rotation   : 0,
    scale      : 1.0,
  };
}.bind(CWStitchManager);


/**
 * (Available on master device only)
 * 
 * Returns the stitch data for the given device, which is similar to the
 *    device transformation but with additional information
 * @param  {CWDevice|String} device The device or device identifier of the
 *    device to get the stitch data of
 * @return {Object} The stitch of the given device or undefined if no stitch
 *    data is available
 * @function
 * @private
 */
CWStitchManager._getStitchData = function(device) {
  if (CWDevice.prototype.isPrototypeOf(device)) device = device.getIdentifier();
  return this._devices[device];
}.bind(CWStitchManager);


/**
 * (Available on master device only)
 * 
 * Returns a numeric index for an edge
 * @param  {String} edge An edge-string, either "top", "left", "bottom" or
 *    "right"
 * @return {Number} A numeric index that belongs to the edge, so either 0, 1,
 *    2 or 3. If the given edge-string was invalid, returns -1      
 * @function
 * @private
 */
CWStitchManager._indexForEdge = function(edge) {
  switch (edge) {
    case 'top':    return 0;
    case 'bottom': return 2;
    case 'left':   return 1;
    case 'right':  return 3;
  }

  return -1;
}.bind(CWStitchManager);


/**
 * (Available on master device only)
 * 
 * Returns an index string for a numeric index
 * @param  {Number} index The index of an edge, either 0, 1, 2 or 3
 * @return {String} The edge-string that belongs to the given index, either
 *    "top", "left", "bottom" or "right". If the given index was invalid,
 *    returns the string "invalid"
 * @function
 * @private
 */
CWStitchManager._edgeForIndex = function(index) {
  switch (index) {
    case 0: return 'top';
    case 2: return 'bottom';
    case 3: return 'right';
    case 1: return 'left';
  }

  return 'invalid';
}.bind(CWStitchManager);

CWModules.add('CWStitchManager');
/* global Connichiwa, CWEventManager, CWStitchManager, CWDeviceManager, CWDevice, CWDeviceConnectionState, CWDebug, CWModules */
/* global nativeCallRemoteDidConnect */
'use strict';



var CWWebsocketMessageParser = CWWebsocketMessageParser || {};

/**
 * (Available on master device only)
 *
 * Parses a message from the Websocket on the master device and calls the
 *    appropiate sub-parse message. Also see {@link
 *    CWWebsocketMessageParser.parse}
 * @param  {Object} message  The object that represents the JSON message that
 *    was received from the websocket
 * @function
 * @protected
 */
CWWebsocketMessageParser.parseOnMaster = function(message) {
  switch (message._name) {
    case 'remoteinfo'   :  this._parseRemoteInfo(message);  break;
    case '_stitchswipe' :  this._parseStitchSwipe(message); break;
    case '_quitstitch'  :  this._parseQuitStitch(message);  break;
  }

  return true;
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseRemoteInfo = function(message)
{
  var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);

  //If we have a non-native remote no device might exist since
  //no info was sent via BT. If so, create one now.
  if (device === null) {
    device = new CWDevice(message); 
    CWDeviceManager.addDevice(device);
  } else {
    //TODO although unnecessary, for cleanness sake we should probably
    //overwrite any existing device data with the newly received data?
    //If a device exists, that data should be the same as the one we received
    //via BT anyways, so it shouldn't matter
    CWDebug.log(1, 'TODO');
  }
  
  device._connectionState = CWDevice.ConnectionState.CONNECTED;
  nativeCallRemoteDidConnect(device.getIdentifier());

  //Make sure the remote uses the same logging settings as we do
  device.send('_debuginfo', CWDebug._getDebugInfo());
  
  // AutoLoad files from Connichiwa.autoLoad on the new remote device
  var didConnectCallback = function() { 
    CWEventManager.trigger('deviceConnected', device); 
  };
  var loadOtherFile = function(device, file) {
    //As of now, "other" files are only CSS
    var extension = file.split('.').pop().toLowerCase();
    if (extension === 'css') {
      device.loadCSS(file);
    } 
  };
  
  //We need to separate JS files from other filetypes in Connichiwa.autoLoad
  //The reason is that we want to attach a callback to the last JS file we
  //load, so we are informed when it was loaded. 
  var autoLoadJS    = [];
  var autoLoadOther = [];
  for (var i = 0; i < Connichiwa.autoLoad.length; i++) {
    var file = Connichiwa.autoLoad[i];
    var extension = file.split('.').pop().toLowerCase();

    if (extension === 'js') autoLoadJS.push(file);
    else autoLoadOther.push(file);
  }

  //First, let's load all non-JS files
  for (var i = 0; i < autoLoadOther.length; i++) {
    var file = autoLoadOther[i];
    loadOtherFile(device, file);
  }

  //Now load all JS files and attach the callback to the last one
  //If no JS files are auto-loaded, execute the callback immediately
  if (autoLoadJS.length > 0) {
    for (var i = 0; i < autoLoadJS.length; i++) {
      var script = autoLoadJS[i];
      if (i === (autoLoadJS.length - 1)) {
        device.loadScript(script, didConnectCallback);
      } else {
        device.loadScript(script);
      }
    }
  } else {
    didConnectCallback();
  }
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseStitchSwipe = function(message) {
  CWStitchManager.detectedSwipe(message);
}.bind(CWWebsocketMessageParser);


CWWebsocketMessageParser._parseQuitStitch = function(message) {
  CWStitchManager.unstitchDevice(message.device);
}.bind(CWWebsocketMessageParser);

CWModules.add('CWWebsocketMessageParser');
/* global CWDeviceManager, CWNativeBridge, CWWebsocketMessageParser, CWEventManager, CWDebug, CWModules */
/* global nativeCallWebsocketDidOpen */
/* global CONNECTING, OPEN */
'use strict';


var Connichiwa = Connichiwa || {};


/**
 * (Available on master device only)
 * 
 * When the websocket connection fails, this stores the number of retry
 *    attempts
 * @type {Number}
 * @private
 */
Connichiwa._connectionAttempts = 0;


/**
 * (Available on master device only)
 * 
 * Set to true to automatically connect nearby devices. If multiple devices
 *    with autoConnect enabled meet each other, the one that where the
 *    application was launched earlier will become the master device
 * @type {Boolean}
 * @default false
 */
Connichiwa.autoConnect = false;


/**
 * (Available on master device only)
 *
 * An array of URLs to JavaScript or CSS scripts that will be automatically
 *    loaded on any device that is connected from now on. Further, on all
 *    connected devices, the callbacks passed to {@link Connichiwa.onLoad}
 *    will only be invoked after all the scripts in this array have been
 *    loaded
 * @type {Array}
 * @default [ ]
 */
Connichiwa.autoLoad = [];


// PUBLIC API


/**
 * @override
 * @ignore
 */
Connichiwa.getLocalDevice = function() {
  return CWDeviceManager.getLocalDevice();
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa.getIdentifier = function() 
{
  var localDevice = CWDeviceManager.getLocalDevice();
  if (localDevice === undefined) return undefined;

  return localDevice.getIdentifier();
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa.isMaster = function() {
  return true;
}.bind(Connichiwa);


/**
 * (Available on master device only)
 *
 * Returns an array of IPs over which the HTTP and websocket server running on
 *    this device can be reached
 * @return {Array} An array of IPs as strings
 * @function
 * @protected
 */
Connichiwa.getIPs = function() {
  var localDevice = CWDeviceManager.getLocalDevice();
  if (localDevice === undefined) return undefined;

  return localDevice.getIPs();
}.bind(Connichiwa);


/**
 * (Available on master device only)
 *
 * Returns the port where the HTTP server on this device runs on. The
 *    websocket server runs on this port +1
 * @return {Number} The port of the HTTP server on this device
 * @function
 * @protected
 */
Connichiwa.getPort = function() {
  var localDevice = CWDeviceManager.getLocalDevice();
  if (localDevice === undefined) return undefined;

  return localDevice.getPort();
}.bind(Connichiwa);


// WEBSOCKET


/**
 * @override
 * @ignore
 */
Connichiwa._connectWebsocket = function() {
  if (this._websocket !== undefined && (this._websocket.state === CONNECTING || this._websocket.state === OPEN)) {
    return;
  }

  this._cleanupWebsocket();

  CWDebug.log(3, 'Connecting websocket');

  this._websocket           = new WebSocket('ws://127.0.0.1:8001');
  this._websocket.onopen    = this._onWebsocketOpen;
  this._websocket.onmessage = this._onWebsocketMessage;
  this._websocket.onclose   = this._onWebsocketClose;
  this._websocket.onerror   = this._onWebsocketError;

  this._connectionAttempts++;
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketOpen = function() {
  CWDebug.log(3, 'Websocket opened');
  CWNativeBridge.callOnNative('nativeCallWebsocketDidOpen');
  this._connectionAttempts = 0;
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketMessage = function(e) {
  var message = JSON.parse(e.data);

  //Filter messages that were broadcasted by us and do not have the
  //'_broadcastToSource' flag set
  if (message._target === 'broadcast' && 
    message._source === this.getLocalDevice().getIdentifier() && 
    message._broadcastToSource !== true) {
    return;
  }

  CWDebug.log(4, 'Received message: ' + e.data);
  
  //It seems that reacting immediatly to a websocket message
  //sometimes causes crashes in UIWebView. I am unsure why.
  //We use requestAnimationFrame in an attempt to prevent those crashes
  var that = this;
  window.requestAnimationFrame(function() {
    CWWebsocketMessageParser.parse(message);
    CWWebsocketMessageParser.parseOnMaster(message);

    if (message._name) CWEventManager.trigger('message' + message._name, message);
  });
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketClose = function(e) {
  CWDebug.log(3, 'Websocket closed');
  CWDebug.log(3, e.code);
  CWDebug.log(3, e.reason);
  this._cleanupWebsocket();

  if (this._connectionAttempts >= 5)
  {
    //Give up, guess we are fucked
    CWNativeBridge.callOnNative('nativeCallWebsocketDidClose');
    return;
  }

  //We can't allow this blashphemy! Try to reconnect!
  // setTimeout(function() { this._connectWebsocket(); }.bind(this), this._connectionAttempts * 1000);
}.bind(Connichiwa);


/**
 * @override
 * @ignore
 */
Connichiwa._onWebsocketError = function() {
  this._onWebsocketClose();
}.bind(Connichiwa);

CWModules.add('Connichiwa');
CWModules.init();