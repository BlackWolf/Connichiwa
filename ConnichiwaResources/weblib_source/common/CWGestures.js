/* global CWDebug, Connichiwa, CWUtil */
"use strict";


$(document).ready(function() {
  var startLocation;
  var endLocation;
  $("body").on("mousedown touchstart", function(e) {
    startLocation = CWUtil.getEventLocation(e, "client");
  });

  $("body").on("mousemove touchmove", function(e) {
    if (startLocation === undefined) return;

    //TODO if the user stops moving the finger or starts moving in another direction,
    //this swipe is invalid
    
    endLocation = CWUtil.getEventLocation(e, "client");
  });

  $("body").on("mouseup touchend", function(e) {
    var swipeStart = startLocation;
    var swipeEnd = endLocation;

    startLocation = undefined;
    endLocation   = undefined;

    if (swipeStart === undefined || swipeEnd === undefined) return;

    var deltaX = swipeEnd.x - swipeStart.x;
    var deltaY = swipeEnd.y - swipeStart.y;

    //The swipe must have a minimum length to make sure its not a tap
    var swipeLength = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
    CWDebug.log(1, "Swipe length is "+swipeLength);
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

    CWDebug.log(1, "deltaX "+deltaX+", deltaY "+deltaY);
    CWDebug.log(1, "swipe direction is "+direction);

    //Check if the touch ended at a device edge
    var endsAtTopEdge    = (swipeEnd.y <= 50);
    var endsAtLeftEdge   = (swipeEnd.x <= 50);
    var endsAtBottomEdge = (swipeEnd.y >= (screen.availHeight - 50));
    var endsAtRightEdge  = (swipeEnd.x >= (screen.availWidth - 50));

    var edge = "invalid";
    if (endsAtTopEdge    && direction === "up")    edge = "top";
    if (endsAtLeftEdge   && direction === "left")  edge = "left";
    if (endsAtBottomEdge && direction === "down")  edge = "bottom";
    if (endsAtRightEdge  && direction === "right") edge = "right";

    if (edge === "invalid") return;

    var message = {
      type   : "pinchswipe",
      device : Connichiwa.getIdentifier(),
      edge   : edge,
      width  : screen.availWidth,
      height : screen.availHeight,
      x      : swipeEnd.x,
      y      : swipeEnd.y
    };
    Connichiwa.send(message);
  });
});
