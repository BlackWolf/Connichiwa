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
