/* global OOP, CWEventManager, CWVector, CWDebug, Connichiwa, CWUtil */
"use strict";



var CWGestures = OOP.createSingleton("Connichiwa", "CWGestures", {
  "private _touchStart": undefined,
  "private _touchLast": undefined,
  "private _touchLastVector": undefined,
  "private _touchCheckable": false,
  "private _touchAngleReferenceVector": undefined,
  "private _touchAngleChangedCount": 0,

  __constructor: function() {
    var that = this;
    $(document).ready(function() {
      that.captureOn($("body"));
    });
  },


  "private _onDown": function(e) {
    this._touchStart = CWUtil.getEventLocation(e, "client");
  },


  "private _onMove": function(e) {
    if (this._touchStart === undefined) return;

    var newTouch = CWUtil.getEventLocation(e, "client");

    //In touchend, we only compare this._touchStart to this._touchLast, so it is possible that
    //the user starts swiping, then goes in the opposite direction and then in the
    //first direction again, which would be detected as a valid swipe.
    //To prevent this, we try to detect direction changes here by checking the angle
    //between the current and the previous finger vector.
    //
    //Unfortunately, touches can "jitter", so we need to make sure that
    //small (or very short) angle changes don't cancel the swipe. Because of this,
    //once we detect a direction change we save the last "valid" finger vector into
    //this._touchAngleReferenceVector. We then compare the following vectors to that 
    //reference vector. Only if 3 touches in a row have a direction change, we cancel
    //the swipe.
    //
    //Furthermore, we add some noise reduction by making sure the last finger vector
    //has a minimum length of 2 and the entire swipe is at least 5 pixels in length
    if (this._touchLast !== undefined) {
      var totalTouchVector = new CWVector(this._touchStart, newTouch);
      var newTouchVector   = new CWVector(this._touchLast,  newTouch);

      this._touchCheckable = (this._touchCheckable || totalTouchVector.length() > 5);
      if (this._touchCheckable && newTouchVector.length() > 1) {

        //A previous touch was a direction change, compare with the saved
        //reference vector by calculating their angle
        if (this._touchAngleReferenceVector !== undefined) {
          var referenceTouchAngle = newTouchVector.angle(this._touchAngleReferenceVector);
          if (referenceTouchAngle > 20) {
          // if (referenceTouchAngle > 30) {
            this._touchAngleChangedCount++;

            if (this._touchAngleChangedCount === 3) {
              this._touchStart = undefined;
              this._touchLast  = undefined;
              return;
            }
          } else {
            this._touchAngleReferenceVector = undefined;
            this._touchAngleChangedCount = 0;
          }

        //Compare the current finger vector to the last finger vector and see
        //if the direction has changed by calculating their angle
        } else {
          if (this._touchLastVector !== undefined) {
            var newTouchAngle = newTouchVector.angle(this._touchLastVector);
            if (newTouchAngle > 20) {
            // if (newTouchAngle > 30) {
              this._touchAngleReferenceVector = this._touchLastVector;
              this._touchAngleChangedCount = 1;
            }
          }
        }
      }

      if (newTouchVector.length() > 0) this._touchLastVector = newTouchVector;
    } 

    this._touchLast = newTouch;
  },


  "private _onUp": function(e) {
    var swipeStart = this._touchStart;
    var swipeEnd   = this._touchLast;

    this._touchStart                = undefined;
    this._touchLast                 = undefined;
    this._touchLastVector           = undefined;
    this._touchCheckable            = false;
    this._touchAngleReferenceVector = undefined;
    this._touchAngleChangedCount    = 0;

    if (swipeStart === undefined || swipeEnd === undefined) return;

    var deltaX = swipeEnd.x - swipeStart.x;
    var deltaY = swipeEnd.y - swipeStart.y;

    //The swipe must have a minimum length to make sure its not a tap
    var swipeLength = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
    if (swipeLength <= 10) {
      CWDebug.log(3, "Swipe REJECTED because it was too short (" + swipeLength + ")");
      return;
    }

    //Check the direction of the swipe
    //For example, if a swipe to the right is performed at y=10 we need this to
    //recognize this swipe as a right-swipe instead of a top-swipe
    //We check the deltaX to deltaY ratio to determine the direction
    //For very short swipes, this ratio can be worse because short swipes tend
    //to be less straight. For very short swipes we almost don't care anymore
    var xyRatio = 0.25;
    if (swipeLength < 100) xyRatio = 0.35; //short swipes tend to be less straight
    if (swipeLength < 50)  xyRatio = 0.4;
    if (swipeLength < 40)  xyRatio = 0.45;
    if (swipeLength < 15)  xyRatio = 0.8; //doesn't matter that much anymore
    // var xyRatio = 0.65;
    // if (swipeLength < 100) xyRatio = 0.75; //short swipes tend to be less straight
    // if (swipeLength < 50)  xyRatio = 0.85;
    // if (swipeLength < 40)  xyRatio = 0.95;
    // if (swipeLength < 15)  xyRatio = 0.95; //doesn't matter that much anymore

    var direction = "invalid";
    if (Math.abs(deltaY) < (Math.abs(deltaX) * xyRatio)) {
      if (deltaX > 0) direction = "right";
      if (deltaX < 0) direction = "left";
    }
    if (Math.abs(deltaX) < (Math.abs(deltaY) * xyRatio)) {
      if (deltaY > 0) direction = "down";
      if (deltaY < 0) direction = "up";
    }

    //Check if the touch ended at a device edge
    //Lucky us, touch coordinates incorporate rubber banding - this means that a swipe down with rubber banding
    //will give us smaller values than it should, because the gray top area is subtracted
    //Luckily, window.innerHeight incorporates rubber banding as well, so we can calculate the missing pixels
    var rubberBanding = $(window).height() - window.innerHeight;
    swipeEnd.y += rubberBanding;
    var endsAtTopEdge    = (swipeEnd.y <= 50);
    var endsAtLeftEdge   = (swipeEnd.x <= 50);
    var endsAtBottomEdge = (swipeEnd.y >= ($(window).height() - 50));
    var endsAtRightEdge  = (swipeEnd.x >= ($(window).width()  - 50));
    // var endsAtTopEdge    = (swipeEnd.y <= 100);
    // var endsAtLeftEdge   = (swipeEnd.x <= 100);
    // var endsAtBottomEdge = (swipeEnd.y >= ($(window).height() - 100));
    // var endsAtRightEdge  = (swipeEnd.x >= ($(window).width()  - 100));

    var edge = "invalid";
    if (endsAtTopEdge    && direction === "up")    edge = "top";
    if (endsAtLeftEdge   && direction === "left")  edge = "left";
    if (endsAtBottomEdge && direction === "down")  edge = "bottom";
    if (endsAtRightEdge  && direction === "right") edge = "right";

    if (edge === "invalid") {
      CWDebug.log(3, "Swipe REJECTED. Ending: x - " + swipeEnd.x + "/" + ($(window).width() - 50) + ", y - " + swipeEnd.y + "/" + ($(window).height() - 50) + ". Direction: " + direction + ". Edge endings: " + endsAtTopEdge + ", " + endsAtRightEdge + ", " + endsAtBottomEdge + ", " + endsAtLeftEdge);
      return;
    }

    //Make sure the data really ends at an edge, even if rubber banding occured or the user lifted the finger 
    //slightly before the edge of the device
    if (edge === "top")    swipeEnd.y = 0;
    if (edge === "left")   swipeEnd.x = 0;
    if (edge === "bottom") swipeEnd.y = $(window).height();
    if (edge === "right")  swipeEnd.x = $(window).width();      

    var swipeData = {
      edge : edge,
      x    : swipeEnd.x,
      y    : swipeEnd.y
    };
    CWEventManager.trigger("stitchswipe", swipeData);
  },


  "public captureOn": function(el) {
    if (el instanceof jQuery) el = el.get(0);

    //el.on("mousedown this._touchStart", this._onDown);
    el.addEventListener("mousedown",  this._onDown, true);
    el.addEventListener("touchstart", this._onDown, true);

    //el.on("mousemove touchmove", this._onMove);
    el.addEventListener("mousemove", this._onMove, true);
    el.addEventListener("touchmove", this._onMove, true);

    //el.on("mouseup touchend", this._onUp);
    el.addEventListener("mouseup",  this._onUp, true);
    el.addEventListener("touchend", this._onUp, true);
  }
});
