/* global OOP */
"use strict";



/**
 * Gives us some nice debug convenience functions
 *
 * @namespace CWDebug
 */
var CWDebug = OOP.createSingleton("Connichiwa", "CWDebug", {
  _debug: false,
  _logLevel: 0,

  "public setDebug": function(v) {
    this._debug = v;
  },

  "public setLogLevel": function(v) {
    this._logLevel = v;
  },


  "public setDebugInfo": function(info) {
    if (info.debug)    CWDebug.setDebug(info.debug);
    if (info.logLevel) CWDebug.setLogLevel(info.logLevel);
  },


  "public getDebugInfo": function() {
    return { debug: this._debug, logLevel: this._logLevel };
  },


  "public log": function(level, msg) {
    if (this._debug && level <= this._logLevel) {
      console.log(level + "|" + msg);
    }
  },

  "public err": function(msg) {
    if (this._debug) {
      console.log("ERROR" + "|" + msg);
    }
  }
});