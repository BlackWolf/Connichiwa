/* global CWEventManager, CWVector, CWDebug, Connichiwa, CWUtil */
"use strict";


$(document).ready(function() {
  var touchStart;
  var touchLast;
  var touchLastVector;
  var touchCheckable = false;
  var touchAngleReferenceVector;
  var touchAngleChangedCount = 0;
  $("body").on("mousedown touchstart", function(e) {
    touchStart = CWUtil.getEventLocation(e, "client");
  });

  $("body").on("mousemove touchmove", function(e) {
    if (touchStart === undefined) return;

    var newTouch = CWUtil.getEventLocation(e, "client");

    //In touchend, we only compare touchStart to touchLast, so it is possible that
    //the user starts swiping, then goes in the opposite direction and then in the
    //first direction again, which would be detected as a valid swipe.
    //To prevent this, we try to detect direction changes here by checking the angle
    //between the current and the previous finger vector.
    //
    //Unfortunately, touches can "jitter", so we need to make sure that
    //small (or very short) angle changes don't cancel the swipe. Because of this,
    //once we detect a direction change we save the last "valid" finger vector into
    //touchAngleReferenceVector. We then compare the following vectors to that 
    //reference vector. Only if 3 touches in a row have a direction change, we cancel
    //the swipe.
    //
    //Furthermore, we add some noise reduction by making sure the last finger vector
    //has a minimum length of 2 and the entire swipe is at least 5 pixels in length
    if (touchLast !== undefined) {
      var totalTouchVector = new CWVector(touchStart, newTouch);
      var newTouchVector   = new CWVector(touchLast, newTouch);

      var touchCheckable = (touchCheckable || totalTouchVector.length() > 5);
      if (touchCheckable && newTouchVector.length() > 1) {

        //A previous touch was a direction change, compare with the saved
        //reference vector by calculating their angle
        if (touchAngleReferenceVector !== undefined) {
          var referenceTouchAngle = newTouchVector.angle(touchAngleReferenceVector);
          if (referenceTouchAngle > 20) {
            touchAngleChangedCount++;

            if (touchAngleChangedCount === 3) {
              touchStart = undefined;
              touchLast  = undefined;
              return;
            }
          } else {
            touchAngleReferenceVector = undefined;
            touchAngleChangedCount = 0;
          }

        //Compare the current finger vector to the last finger vector and see
        //if the direction has changed by calculating their angle
        } else {
          if (touchLastVector !== undefined) {
            var newTouchAngle = newTouchVector.angle(touchLastVector);
            if (newTouchAngle > 20) {
              touchAngleReferenceVector = touchLastVector;
              touchAngleChangedCount = 1;
            }
          }
        }
      }

      if (newTouchVector.length() > 0) touchLastVector = newTouchVector;
    } 

    touchLast = newTouch;
  });

  $("body").on("mouseup touchend", function(e) {
    var swipeStart = touchStart;
    var swipeEnd   = touchLast;

    touchStart                = undefined;
    touchLast                 = undefined;
    touchLastVector           = undefined;
    touchCheckable            = false;
    touchAngleReferenceVector = undefined;
    touchAngleChangedCount    = 0;

    if (swipeStart === undefined || swipeEnd === undefined) return;

    var deltaX = swipeEnd.x - swipeStart.x;
    var deltaY = swipeEnd.y - swipeStart.y;

    //The swipe must have a minimum length to make sure its not a tap
    var swipeLength = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
    if (swipeLength <= 10) return;

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
    var endsAtTopEdge    = (swipeEnd.y <= 25);
    var endsAtLeftEdge   = (swipeEnd.x <= 25);
    var endsAtBottomEdge = (swipeEnd.y >= (screen.availHeight - 25));
    var endsAtRightEdge  = (swipeEnd.x >= (screen.availWidth - 25));

    var edge = "invalid";
    if (endsAtTopEdge    && direction === "up")    edge = "top";
    if (endsAtLeftEdge   && direction === "left")  edge = "left";
    if (endsAtBottomEdge && direction === "down")  edge = "bottom";
    if (endsAtRightEdge  && direction === "right") edge = "right";

    if (edge === "invalid") return;

    var swipeData = {
      // type   : "pinchswipe",
      // device : Connichiwa.getIdentifier(),
      edge   : edge,
      // width  : screen.availWidth,
      // height : screen.availHeight,
      x      : swipeEnd.x,
      y      : swipeEnd.y
    };
    // Connichiwa.send(message);
    CWEventManager.trigger("pinchswipe", swipeData);
  });
});
