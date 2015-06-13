/* global CWModules */
'use strict';



/**
 * CWSystemInfo encapsulates some system-related information as far as they
 *    are available. It can be used, for example, to access the display's PPI,
 *    the browser window resolution or the orientation
 * @namespace CWSystemInfo
 */
var CWSystemInfo = CWModules.retrieve('CWSystemInfo');


/**
 * The PPI value that will be used when other PPI information are not available
 * @type {Number}
 * @const
 */
CWSystemInfo.DEFAULT_PPI = 100; //1080p on a 22'' monitor


/**
 * This device's display PPI, approximated. JavaScript does not have direct
 *    access to the display size and therefore cannot retrieve the PPI value.
 *    Depending on the available information, such as the devicePixelRatio or
 *    navigator information, this method tries to approximate the display's
 *    PPI as close as possible
 * @return {Number} The device's approximated display PPI
 * @function
 */
CWSystemInfo.PPI = function() {
  var ppi = this.DEFAULT_PPI;

  //For high density screens we simply assume 142 DPI
  //This, luckily, is correct for a lot of android devices
  if (window.devicePixelRatio > 1.0) {
    ppi = 142; 
  }
   
  //For iPhone and iPad, we can figure out the DPI pretty well
  if (navigator.platform === 'iPad') {
    //usually we would distinguish iPad Mini's (163dpi) but we can't, so we 
    //return normal iPad DPI
    ppi = 132;
  }
  if (navigator.platform === 'iPhone' || navigator.platform === 'iPod') {
    //Newer iPhones (for now iPhone 6+) have a different resolution, luckily 
    //they also return a new devicePixelRatio
    if (window.devicePixelRatio === 3) {
      ppi = 153;
    } else {
      ppi = 163;
    }
  }

  return ppi;
};


/**
 * Determines if the device is in landscape orientation
 * @return {Boolean} true if the device is in landscape orientation, otherwise
 *    false
 * @function
 */
CWSystemInfo.isLandscape = function() {
  return (window.innerHeight < window.innerWidth);
};


/**
 * Returns the current viewport width of the browser or web view
 * @return {Number} The current viewport width
 * @function
 */
CWSystemInfo.viewportWidth = function() {
  return $(window).width();
};


/**
 * Returns the current viewport height of the browser or web view. This method
 *    should not be used when using the meta-tag viewport with the
 *    height-device-height attribute
 * @return {Number} The current viewport height
 * @function
 */
CWSystemInfo.viewportHeight = function() {
  //This seems to break in landscape when using meta-viewport 
  //height-device-height so basically for now: don't use that
  return $(window).height();
};
