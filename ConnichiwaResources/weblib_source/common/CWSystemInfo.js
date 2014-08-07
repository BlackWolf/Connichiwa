/* global OOP */
"use strict";



var CWSystemInfo = OOP.createSingleton("Connichiwa", "CWSystemInfo", {
  _ppi : undefined,


  "public PPI": function() {
    if (this._ppi !== undefined) return this._ppi;

    this._ppi = this.DEFAULT_PPI();

    // if (navigator.platform === "iPad") {
    //   if (window.devicePixelRatio > 1) this._ppi = 264;
    //   else this._ppi = 132;
    // }

    // if (navigator.platform === "iPhone" || navigator.platform === "iPod") {
    //   if (window.devicePixelRatio > 1) this._ppi = 326;
    //   else this._ppi = 264;
    // }
     
    if (navigator.platform === "iPad") {
      //TODO usually we would distinguish iPad Mini's (163dpi)
      //but we can't, so we return normal iPad DPI
      this._ppi = 132;
    }

    if (navigator.platform === "iPhone" || navigator.platform === "iPod") {
      this._ppi = 163;
    }

    return this._ppi;
  },

  "public DEFAULT_PPI": function() {
    return 96;
  }
});
