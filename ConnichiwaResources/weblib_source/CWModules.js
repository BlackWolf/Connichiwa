/* global CWNativeBridge */
'use strict';

var CWModules = {};

CWModules._modules = [];
CWModules._actualModules = {};
CWModules._didInit = false;

CWModules.retrieve = function(module) {
  this.add(module);

  if (module in this._actualModules === false) {
    this._actualModules[module] = {};
  }

  return this._actualModules[module];
}.bind(CWModules);

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

      var theMod = that._actualModules[module];
      for (var key in theMod) {
        // console.log("Checking "+key);
        if (theMod.hasOwnProperty(key) && typeof(theMod[key]) === 'function') {
          // console.log("Binding "+key);
          // window[module][key] = window[module][key].bind(window[module]);
          theMod[key] = theMod[key].bind(theMod);
        }
      }

      if (window[module].__constructor) window[module].__constructor();
    }  

    CWNativeBridge.callOnNative("nativeCallLibraryDidLoad");
  }, 0);

  this._didInit = true;
}.bind(CWModules);
