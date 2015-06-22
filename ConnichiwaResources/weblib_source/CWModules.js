/* global CWNativeBridge */
'use strict';

var CWModules = {};

// CWModules._modules = [];
// CWModules._actualModules = {};
CWModules._modules = {};
CWModules._didInit = false;

CWModules.retrieve = function(module) {
  if (module in this._modules === false) {
    this._modules[module] = {};
  }

  return this._modules[module];
}.bind(CWModules);


CWModules.init = function() {
  if (this._didInit) throw 'Cannot initialize modules twice';

  //We need to setTimeout the initialization to make sure that everything else
  //is set up
  var that = this;
  window.setTimeout(function() {
    // for (var i = 0; i < that._modules.length; i++) {
    for (var moduleName in that._modules) {
      if (that._modules.hasOwnProperty(moduleName)) {
        console.log('Initializing module ' + moduleName + '...');

        var module = that._modules[moduleName];

        //Bind every function in the module to it, so the module can use "this"
        for (var key in module) {
          if (module.hasOwnProperty(key) && typeof(module[key]) === 'function') {
            module[key] = module[key].bind(module);
          }
        }

        //Call constructor if module has one
        //Delay call to make sure all module have been initialized
        if (module.__constructor) {
          window.setTimeout(module.__constructor, 0);
        }
      }
    }

    CWNativeBridge.callOnNative("nativeCallLibraryDidLoad");
  }, 0);

  this._didInit = true;
}.bind(CWModules);
