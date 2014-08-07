/* global OOP, Connichiwa, CWEventManager */
"use strict";


 
var CWPinchManager = OOP.createSingleton("Connichiwa", "CWPinchManager", {
  "private _isPinched": false,


  __constructor: function() {
    Connichiwa.onMessage("wasPinched", this._onWasPinched);
    CWEventManager.register("pinchswipe", this._onLocalSwipe);
  },


  _onWasPinched: function() {

    //TODO set isPinched to true and listen to gyro updates that might cancel the pinch
  },


  _onLocalSwipe: function(swipeData) {
    if (this.isPinched()) return;

    //Prepare for the master and send away
    swipeData.type   = "pinchswipe";
    swipeData.device = Connichiwa.getIdentifier();
    swipeData.width  = screen.availWidth;
    swipeData.height = screen.availHeight;
    Connichiwa.send(swipeData);
  },


  "public isPinched": function() {
    return this._isPinched;
  },
});
