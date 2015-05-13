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
  if (value === undefined && CWUtil.isObject(key) === false) {
    value = key;
    key = collection;
    collection = undefined;
  }

  this._set(collection, key, value, true);
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
 * @private
 */
CWDatastore._set = function(collection, key, value, sync) {  
  //3 args: collection was omitted
  if (sync === undefined) {
    sync = value;
    value = key;
    key = collection;
    collection = undefined;
  }

  if (collection === undefined) collection = '_default';

  //Create collection if it doesn't exist
  if ((collection in this._data) === false) {
    this._data[collection] = {};
  }

  //Create a dictionary of the changes we need to make to the datastore
  var keyValues;
  if (CWUtil.isObject(key)) {
    //User already provided such a dictionary
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
