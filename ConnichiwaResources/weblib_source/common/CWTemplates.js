/* global Connichiwa, Handlebars, CWUtil, CWDebug, CWModules */
'use strict';

/**
 * Used for Handlebars templating in Connichiwa. This provides you with the
 *    ability to load Handelbars templates ({@link http://handlebarsjs.com})
 *    and insert them into the DOM. To do so, you must first load the files
 *    that contain your Handlebars templates (and - if your template uses
 *    partials - all files that contain those) using {@link CWTemplates.load}.
 *    After that, you can insert these templates into the DOM by using {@link
 *    CWTemplates.insert}. This will grab the template of your choice, fill it
 *    with the data you provide and insert it at the given position into the
 *    DOM.
 *
 * Note that in order to load and insert templates into another device's DOMs,
 *    you must use {@link CWDevice#loadTemplates} and {@link
 *    CWDevice#insertTemplate}.
 *
 * This class further provides the Handlebars helper `isMaster` and
 *    `ifIsMaster`
 * @copyright This class and the whole idea behind CWTemplates is based on
 *    Roman Rädle's work (roman.raedle@uni-konstanz.de).
 * @namespace  CWTemplates
 */
var CWTemplates = CWTemplates || {};

/**
 * An array of Deferred objects, each representing the AJAX request and
 *    compilation of a single template file. If a Deferred in this array is
 *    resolved, the template file is ready for use
 * @type {Array}
 * @private
 */
CWTemplates._loadedPaths = [];


/**
 * Constructor initializing the CWTemplates object and registering some
 *    Connichiwa-related Handlebars helper that can be used in templates
 * @function
 * @private
 */
CWTemplates.__constructor = function() {
  //Register Connichiwa helper for handlebars
  Handlebars.registerHelper({
    'isMaster': function() {
      return Connichiwa.isMaster();
    },

    'ifIsMaster': function(options) {
      if (Connichiwa.isMaster()) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  });
};


/**
 * Loads one or more files containing Handlebars templates, so they can be
 *    used afterwards using {@link CWTemplates.insert}.
 * @param  {String|Array} paths The path to a template file or an array of
 *    paths. If one or more paths are invalid, the load will fail silently,
 *    but all other paths will still be loaded.
 * @function
 */
CWTemplates.load = function(paths) {
  if (CWUtil.isString(paths)) paths = [ paths ];

  var that = this;
  $.each(paths, function(i, path) {
    CWDebug.log(1, "Getting "+path);
    var deferred = new $.Deferred();
    that._loadedPaths.push(deferred);
    $.get(path).done(function(data) {
      CWDebug.log(1, "Compiling "+path);
      that._compile(data);
      deferred.resolve();
    }).fail(function() {
      CWDebug.log(1, path +" does not exist");
      deferred.reject();
    });
  });
}.bind(CWTemplates);


 /**
  * Inserts the template with the given name into the local DOM. The template
  *    will be inserted into the DOM object(s) with the given target selector
  *    and the template's data will be set to the given data object. As
  *    inserting a template is an asynchronous operation that first waits for
  *    all {@link CWTemplates.load} calls to finish, an optional callback can
  *    be supplied that will be called after the template was inserted.
  *
  * Note that before you can insert a template, you must load the file that
  *    contains this template using {@link CWTemplates.load}.
  * @param  {String}   templateName The name of the template to load. The file
  *    that contains a template with this name must be loaded using {@link
  *    CWTemplates.load} before calling this method.
  * @param  {String}   target       A jQuery selector that points to a valid
  *    DOM object (e.g. 'body'). The template will be inserted into this DOM
  *    element.
  * @param  {Object}   data         An arbitrary object of key-value pairs
  *    that will be handed to the template as the template's data. E.g. if the
  *    template contains an expression {{title}}, this expression will be
  *    replaced with the value of the 'title' entry in this object.
  * @param  {Function} callback     An optional callback function. This
  *    callback will be called after the template was inserted into the DOM.
  *    This means that within this callback, you can be sure the content of
  *    the template exists in the DOM. 
  * @function
 */
CWTemplates.insert = function(templateName, target, data, callback) {
  $.when.all(this._loadedPaths).always(function() {
    CWDebug.log(3, "Inserting template " + templateName);
    var template = Handlebars.compile("{{> "+templateName+" }}");
    var html = template(data);

    $(target).append(html);
    if (callback !== undefined) callback();
  });
}.bind(CWTemplates);


/**
 * Compiles the given piece of template code. All <template> tags that contain
 *    a name attribute within that code will be registered as templates with
 *    Handlebars. After this step, the templates can be inserted using {@link
 *    CWTemplates.insert}.
 * @param  {String} templateData Handlebars template code
 * @function
 * @private
 */
CWTemplates._compile = function(templateData) {
  var content = $('<wrapper>');
  content.html(templateData);

  var templates = content.find('template');
  templates.each(function(index, template) {
    template = $(template);

    var name = template.attr('name');
    var content = CWUtil.unescape(template.html());

    if (name === undefined || name.length === 0) {
      CWDebug.err(1, "Found template without name - template is ignored. Template Content: "+content);
      return true;
    }

    CWDebug.log(3, "Registering template: "+template.attr('name'));
    Handlebars.registerPartial(name, content);
  });
}.bind(CWTemplates);

CWModules.add('CWTemplates');
