/* global OOP */
"use strict";



var CWSystemInfo = OOP.createSingleton("Connichiwa", "CWSystemInfo", {
  _ppi : undefined,


  "public PPI": function() {
    if (this._ppi !== undefined) return this._ppi;

    this._ppi = this.DEFAULT_PPI();

    //For high density screens we simply assume 142 DPI
    //This, luckily, is correct for a lot of android devices
    if (window.devicePixelRatio > 1.0) {
      this._ppi = 142; 
    }
     
    //For iPhone and iPad, we can figure out the DPI pretty well
    if (navigator.platform === "iPad") {
      //TODO usually we would distinguish iPad Mini's (163dpi)
      //but we can't, so we return normal iPad DPI
      this._ppi = 132;
    }
    if (navigator.platform === "iPhone" || navigator.platform === "iPod") {
      //Newer iPhones (for now iPhone 6+) have a different resolution, luckily they
      //also return a new devicePixelRatio
      if (window.devicePixelRatio === 3) {
        this._ppi = 153;
      } else {
        this._ppi = 163;
      }
    }

    return this._ppi;
  },


  "public isLandscape": function() {
    return (window.innerHeight < window.innerWidth);
  },


  "public viewportWidth": function() {
    return $(window).width();
  },


  "public viewportHeight": function() {
    //This seems to break in landscape when using meta-viewport height-device-height
    //so basically for now: don't use that
    return $(window).height();
  },

  "public DEFAULT_PPI": function() {
    return 100; //HD on a 22'' monitor
  }
});
