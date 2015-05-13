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
    if (CWUtil.isObject(key) === false) {
      if (CWUtil.isObject(collection)) {
        //Args: (dict)
        key = collection;
        collection = '';
      } else {
        //Args: (collection, key, value)
        value = key;
        key = collection;
        collection = '';
      }
    }
  }

  CWDatastore.set('_CWTemplates.'+collection, key, value);
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
