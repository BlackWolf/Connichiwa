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
var CWDatastore = CWModules.retrieve('CWDatastore');

/**
 * The datastores stored data :-)
 * @type {Object}
 * @private
 */
CWDatastore._data = {};


/**
 * Stores or updates the given key/value pair in the given collection.
 *
 * See {@link CWDatastore.setMultiple} to set multiple values at once.
 * @param {String} [collection] The collection to write to. If no collection
 *    is provided, a default collection will be used. Collection names may not
 *    start with an underscore.
 * @param {String} key The key under which the value will be stored in the
 *    collection
 * @param {Object} value The value to store. Must be an object or value that
 *    can be converted to JSON. May not be a function or `undefined`.
 * @function
 */
CWDatastore.set = function(collection, key, value) {
  if (value === undefined) {
    //Args: key, value
    value = key;
    key = collection;
    collection = undefined;
  }

  var data = {};
  data[key] = value;
  this.setMultiple(collection, data);
};


/**
 * Stores or updates the given key/value pairs in the given collection. Works
 *    the same as {@link CWDatastore.set}, but sets multiple values at once.
 * @param {String} [collection] The collection to write to. If no collection
 *    is provided, a default collection will be used. Collection names may not
 *    start with an underscore.
 * @param {Object} dict An object containing key/value pairs. All of these
 *    will be stored in the given collection. Existing entries will be
 *    overwritten.
 * @function
 */
CWDatastore.setMultiple = function(collection, dict) {
  if (dict === undefined) {
    //Args: dict
    dict = collection;
    collection = undefined;
  }

  if (collection === undefined) collection = '_default';

  this._set(collection, dict, true);
};


/**
 * Stores or updates one or more key/value pairs in the given collection. The
 *    `sync` parameter allows to suppress syncing to other devices.
 * @param {String} collection The collection to write to.
 * @param {String} key Can be one of two things:
 * * A string, representing a key. In this case, the value parameter must be
 *    the value to store under the given key and the `isDict` parameter must
 *    be `false`. * A dictionary of key/value pairs. All of these will be
 *    stored in the given collection. In this case, the value parameter is
 *    ignored and the `isDict` parameter must be `true`.
 * @param {Object} value The value to store. Must be an object or value that
 *    can be converted to JSON. May not be a function or `undefined`. If a
 *    dictionary is stored, this is not used.
 * @param {Boolean} sync Determines whether the newly stored value is synced
 *    to other devices. Should almost always be `true`, the only exception is
 *    if we store a value that we received from another device (to prevent a
 *    sync loop)
 * @param {Boolean} isDict Determines if a single key/value pair or an entire
 * @fires _datastorechanged
 * @function
 * @protected
 */
// CWDatastore._set = function(collection, key, value, sync, isDict) {
CWDatastore._set = function(collection, data, sync) {
  //Create collection if it doesn't exist
  if ((collection in this._data) === false) {
    this._data[collection] = {};
  }

  var that = this;
  var reportedChanges = {};
  $.each(data, function(keyToSet, valueToSet) {
    if (CWUtil.isFunction(valueToSet)) {
      CWDebug.err('Attempted to store function in CWDatastore (collection: ' + collection + ', key: ' + keyToSet + '). This is invalid and will be ignored.');
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
};


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
};


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
};


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

  if (returnCopy === false) return this._data[collection];
  return $.extend(true, {}, this._data[collection]);
};


/**
 * Syncs the entry represented by the given key in the given collection to all
 *    other currently connected devices.
 * @param  {String} [collection] The collection where the entry is stored. If
 *    omitted, will use the default collection.
 * @param  {String} key They keys from the collection to synchronize or an
 *    array of keys. Keys that do not exist will be ignored.
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
};

/**
 * Syncs the entire data store (all collections) to another device. This
 *    method potentially produces a large websocket message **and should be
 *    used with CAUTION!**
 * @param  {String} target A unique device identifies as returned by {@link
 *    CWDevice#getIdentifier}
 * @param {Function} [callback] An optional callback that is called when the
 *    datastore was synced to the other device.
 * @function
 * @protected
 */
CWDatastore._syncStoreToDevice = function(target, callback) {
  Connichiwa.send(target, '_updatedatastore', { data: this._data }, callback);
};
