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

    // CWDebug.log(3, JSON.stringify(CWUtil.getEventLocation(e, "client")));
    // CWDebug.log(3, JSON.stringify(CWUtil.getEventLocation(e, "page")));
    // CWDebug.log(3, JSON.stringify(CWUtil.getEventLocation(e, "screen")));
    // CWDebug.log(3, window.innerHeight+" || "+window.outerHeight+" || "+$(window).height()+" || "+$(window).innerHeight()+" || "+$(window).outerHeight())

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
    // CWDebug.log(3, "Original Y: "+swipeEnd.y);
    // CWDebug.log(3, window.innerHeight+" || "+window.outerHeight+" || "+$(window).height()+" || "+$(window).innerHeight()+" || "+$(window).outerHeight())
    var rubberBanding = $(window).height() - window.innerHeight;
    swipeEnd.y += rubberBanding;
    var endsAtTopEdge    = (swipeEnd.y <= 50);
    var endsAtLeftEdge   = (swipeEnd.x <= 50);
    var endsAtBottomEdge = (swipeEnd.y >= ($(window).height() - 50));
    var endsAtRightEdge  = (swipeEnd.x >= ($(window).width()  - 50));

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
  });
});
