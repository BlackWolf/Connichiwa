/* global Connichiwa, CWDevice, CWDeviceManager, Ractive, CWDatastore, CWUtil, CWDebug, CWModules */
'use strict';

/**
 * Provides cross-device templating in Connichiwa.
 *
 * CWTemplates allows you to write Ractive.js ({@link
 *    http://www.ractivejs.org}) templates and insert them into the DOM of a
 *    local or remote device. Mustache templates support *expressions* that
 *    can be dynamically replaced with content at runtime.
 *
 * #### Creating a template
 *
 * Templates are stored in external files. Technically, any extension is
 *    exceptable, but `.html` is preferred. One file can contain one or more
 *    templates. Each template must be surrounded by a `<template>` tag that
 *    must have a name attribute with a unique name:
 *
 * ```html
 * <template name="myTemplate">
 *
 * <!-- template content goes here --&gt;
 *
 * </template>
 * ```
 *
 * Templates can contain any kind of ordinary HTML but can further contain
 *    *expressions*. Expressions can be if-else constructs, loops but most
 *    commonly are used as variables - placeholders where dynamic content is
 *    inserted using JavaScript. To learn about all the possibilities of
 *    Ractive.js templates, have a look at {@link
 *    http://docs.ractivejs.org/latest/}.
 *
 * #### Using a template
 *
 * Once you created a file that contains one or multiple templates, there are
 *    two steps required to make use of the template:
 *
 * 1. **Load the template**: This will download the template file from the
 *    server and parse it. This step makes all containing templates known to
 *    the system. Loading a template is done using {@link CWTemplates.load}:
 *
 *    ```js
 *    CWTemplates.load('templates.html');
 *    ```
 *
 * 2. **Insert the template**: After loading a template file, you can insert
 *    any template it contains into the DOM using {@link CWTemplates.insert}:
 *
 *    ```js
 *    CWTemplates.insert('myTemplate');
 *    ```
 *
 * By default, templates are appended to the body of your device. You can
 *    specify an alternative target and further configure the insertion. Have
 *    a look at {@link CWTemplates.insert} for possible options.
 *
 * To **insert a template on another device** the same procedure is used. Just
 *    pass a device identifier or a {@link CWDevice} object as the first
 *    parameter to **both** {@link CWTemplates.load} and {@link
 *    CWTemplates.insert}.
 *
 * #### Expressions
 *
 * Besides ordinary HTML, templates in Connichiwa can contain *expressions*.
 *    Expressions always start with two opening curly brackets and end with
 *    two closing curly brackets. Most commonly, expressions are used as
 *    placeholders for dynamic content. For example:
 *
 * ```html
 * <h2>Hello, {{name}}!</h2>
 * ```
 *
 * The expression in this example is `{{name}}`. In your JavaScript, you can
 *    use {@link CWTemplates.set} to replace such expressions with content:
 *
 * ```js
 * CWTemplates.set('name', 'Paul');
 * ```
 *
 * The template will notice that the expression `{{name}}` changed and
 *    automatically update the UI to reflect the change, displaying `Hello,
 *    Paul!` in the heading.
 *
 * Expressions can be redefined at any time. Calling `CWTemplates.set('name',
 *    'John')` at a later point will automatically replace "Paul" with "John"
 *    in your UI.
 *
 * #### Data-driven templates
 *
 * As you can see, Connichiwas templates are *data-driven* - you do not
 *    directly manipulate the DOM, but rather manipulate the data behind your
 *    templates. Connichiwa even sweetens that further by syncing your data
 *    across devices. So if a template on one device contains the expression
 *    `{{name}}`, and a template on another device contains that expression as
 *    well, using {@link CWTemplates.set} will affect your UI on **all** your
 *    devices.
 *
 * There are cases, though, where this behaviour is unwanted - for example, if
 *    you want to reuse a template on multiple devices, but fill it with
 *    different data. To achieve this, you can provide the name of a
 *    sub-datastore when inserting the template. In the same manner, you can
 *    set data of a sub-datastore by passing the `collection` parameter to
 *    {@link CWTemplates.set}. By default, all templates take their data from
 *    the main template collection. If you provide the name of a sub
 *    collection, your template will react only to data changes in that
 *    collection. For example, you can insert a template as such:
 *
 * ```js
 * CWTemplates.insert('greeting', { dataSource: 'myCollection'});
 * ```
 *
 * This template will not be affected when you use `CWTemplates.set('name',
 *    'Paul')`. Instead, you must call the following to set the name for this
 *    template:
 *
 * ```js
 * CWTemplates.set('myCollection', 'name', 'Paul');
 * ```
 *
 * As you can see, you defined a collection name when inserting the template,
 *    and you have to set data for the same collection to affect the template.
 * @copyright This class and the whole idea behind CWTemplates is based on
 *    Roman Rädle's work (roman.raedle@uni-konstanz.de).
 * @namespace  CWTemplates
 */
var CWTemplates = CWModules.retrieve('CWTemplates');

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
};


/**
 * Loads one or more files containing templates. Templates that have been
 *    loaded can then be inserted into the DOM using {@link
 *    CWTemplates.insert}.
 * @param {CWDevice|String} [device] The device where to load the template,
 *    either represented by a CWDevice or by a device's unique identifier
 *    string. If omitted, the template is loaded on the local device.
 * @param  {String|Array} paths The path to a template file or an array of
 *    paths. If one or more paths are invalid, that particular load will fail,
 *    but all other paths will still be loaded.
 * @function
 */
CWTemplates.load = function(device, paths) {
  if (paths === undefined) {
    //Args: paths
    paths = device;
    device = undefined;
  }

  // if (CWDevice.prototype.isPrototypeOf(device) === true) {
    // device = device.getIdentifier();
  // }
  //
  //TODO
  if (CWUtil.isString(device)) {
    device = CWDeviceManager.getDeviceWithIdentifier(device);
  }
  //TODO

  if (CWUtil.isString(paths)) paths = [ paths ];

  //If a device was given, use device.loadTemplates()
  if (device !== undefined) {
    device.loadTemplates(paths);
    return;
  }

  //If we want to load something on this device, let's do that now
  //Download the file & compile it
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
};


 /**
  * Inserts the template with the given name into the given device's DOM.
  *
  * Note that insertion is an asynchronous operation. If you want to execute
  *    code after the template has inserted, use the `onComplete` option to
  *    provide a callback.
  *
  * Note that before you can insert a template, you must load the file that
  *    contains this template using {@link CWTemplates.load}. If your template
  *    contains subtemplates (using the `{{> subtemplate}}` notation), the
  *    files containing the subtemplate must have been loaded as well.
  * @param {CWDevice|String} [device] The device where to insert the template,
  *    either represented by a CWDevice or by a device's unique identifier
  *    string. If omitted, the template is inserted on the local device's DOM.
  * @param  {String}   templateName The name of the template to load. The file
  *    that contains a template with this name must be loaded using {@link
  *    CWTemplates.load} before calling this method.
  * @param  {Object}   options Options that configures the insertion. All
  *    settings are optional. The following options are available:
  *
  * * **target** (default: `'body'`)
  *
  *   A jQuery selector that represents a DOM element on the target device. The
  *    template is inserted into the DOM element(s) represented by this
  *    selector.
  *
  * * **dataSource**
  *
  *   By default, the template data comes from the default template data store
  *    (see {@link CWTemplates.set}). If `dataSource` is set to a String, a
  *    sub-datastore with the given name will be used. So if you set this to
  *    `'foo'`, the template will react only to changes in the foo template
  *    data store (set using `CWTemplates.set('foo', key, value)`). If this is
  *    set to an object, the template will use the data from the object.
  *    Therefore, the template will be static and not react to changes in the
  *    datastore.
  *
  * * **onComplete**
  *
  *   A callback function that is executed if the template has been inserted.
  * @function
 */
CWTemplates.insert = function(device, templateName, options) {
  if (templateName === undefined) {
    //Args: templateName
    templateName = device;
    device = undefined;
  } else if (CWUtil.isObject(templateName) && options === undefined) {
    //Args: templateName, options
    options = templateName;
    templateName = device;
    device = undefined;
  }

  if (options === undefined) options = {};

  //TODO
  if (CWUtil.isString(device)) {
    device = CWDeviceManager.getDeviceWithIdentifier(device);
  }
  //TODO

  //Inserting into remote DOM - relay method call to CWDevice
  if (device !== undefined) {
    device.insertTemplate(templateName, options);
    return;
  }

  var target     = options.target || 'body';
  var dataSource = options.dataSource;
  var onBefore   = options.onBefore;
  var onComplete = options.onComplete;

  //Inserting into local DOM
  var that = this;
  $.when.all(this._files).always(function() {
    CWDebug.log(3, "Inserting template " + templateName + " into DOM");

    //Grab the template data:
    //* By default, we use the default CWTemplates data store
    //* If data is a string, we define an alternative data store using that name
    //* If data is an object literal, we use its content as static data and do
    //  not use the data store at all (=not reactive)
    var ractiveData;
    if (dataSource === undefined) {
      ractiveData = CWDatastore._getCollection('_CWTemplates.', false);
    } else if (CWUtil.isString(dataSource)) {
      ractiveData = CWDatastore._getCollection('_CWTemplates.' + dataSource, false);
    } else if (CWUtil.isObject(dataSource)) {
      ractiveData = dataSource;
    }

    if (onBefore != undefined) onBefore();

    var ractive = new Ractive({
      template: that._templates.raw[templateName],
      data: ractiveData,
      el: $(target),
      append: true,
      partials: that._templates.raw
    });
    that._templates.compiled.push(ractive);

    if (onComplete !== undefined) onComplete();
  });
};


/**
 * Writes the given data to the template data store. This method is the main
 *    mechanism to change the underlying data of templates.
 *
 * The expressions in your templates will be replaced by values with the same
 *    key in the template data store. For example, the expression `{{name}}` will be replaced by
 *    whatever value was set using:
 *
 *    ```js
 *    CWTemplates.set('name', value);
 *    ```
 *
 * Connichiwa synchronizes your template data store across all your devices,
 *    this ensures that your UI is consistent across all devices. So, if you
 *    insert a template on a remote device that contains the `{{name}}`
 *    expression, using `CWTemplates.set('name', ...)` on **any** device will
 *    update your UI on **all** devices.
 *
 * There are cases, though, where this behaviour is not wanted - for example,
 *    if you want to reuse a template on multiple devices, but fill it with
 *    different data. To achieve this, you can provide the name of a
 *    sub-datastore when inserting the template. In the same manner, you can
 *    set the data in a sub-datastore by passing the `collection` parameter to
 *    this method. By default, all templates take their data from the main
 *    template collection. If you provide the name of a sub collection, your
 *    template will react only to data changes in that collection. For
 *    example, if you insert a template using
 *
 *    ```js
 *    CWTemplates.insert('myTemplate', { dataSource: 'myCollection'} );
 *    ```
 *
 *    calling `CWTemplates.set('name', 'Paul')` will not affect that template.
 *    Instead, you must call
 *
 *    ```js
 *    CWTemplates.set('myCollection', 'name', 'Paul');
 *    ```
 *
 *    to update that particular template.
 *
 * Use {@link CWTemplates.setMultiple} to set multiple values at once.
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
};


/**
 * Writes the given data to the template data store. This method takes a
 *    key/value dictionary and will set each of them in the given template
 *    collection. See {@link CWTemplates.set} for more information.
 * @param {String} [collection] An optional collection name. Collections can
 *    be thought of as "sub data stores". Using collections, you can insert
 *    multiple templates with the same expression, but have them display
 *    different data (also see {@link CWTemplates.insert}). If omitted, writes
 *    to the main collection. Collection names may not start with an
 *    underscore.
 * @param {Object} dict A dictionary of key/value pairs. Every pair will be
 *    inserted into the given collection. Existing keys will be overwritten.
 * @function
 */
CWTemplates.setMultiple = function(collection, dict) {
  if (dict === undefined) {
    //Args: dict
    dict = collection;
    collection = '';
  }

  CWDatastore.setMultiple('_CWTemplates.'+collection, dict);
};


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
};

/**
 * Compiles the given piece of template code. All <template> tags that contain
 *    a name attribute within that code will be registered as templates. After
 *    this step, the templates can be inserted using {@link
 *    CWTemplates.insert}.
 * @param  {String} templateData Ractive/Mustache template code
 * @returns {Boolean} true if the template data contained at least one valid
 *    template, otherwise false
 * @function
 * @private
 */
CWTemplates._compile = function(templateData) {
  //We cannot use jQuery DOM stuff to find the <template> tags in the data,
  //since the expressions become text nodes and can mess up our DOM tree.
  //Therefore, we need to manually parse the templates via regexp
  //This means that something like this will break:
  // <template name="t"> content <!-- </template> --> </template>
  //But I guess we can live with that for now
  var regexp = /^(?:(?!<template)[\s\S])*<template name=(?:"|')([^"']+)(?:"|')>(((?!<\/template>)[\s\S])*)<\/template>/i;
  var remainingTemplateData = templateData;
  var match;
  var addedTemplates = 0;
  do {
    match = regexp.exec(remainingTemplateData);

    if (match) {
      var name = match[1];
      var content = match[2];

      remainingTemplateData = remainingTemplateData.substring(match[0].length);

      // if (name === undefined || name.length === 0) {
        // CWDebug.err(1, "Found template without name - template is ignored. Template Content: "+content);
        // continue;
      // }

      CWDebug.log(3, "Registering template: "+name);
      this._templates.raw[name] = content;
      addedTemplates++;
    }
  } while (match && remainingTemplateData.length > 0);

  if (addedTemplates < 1) return false;
  return true;
};
