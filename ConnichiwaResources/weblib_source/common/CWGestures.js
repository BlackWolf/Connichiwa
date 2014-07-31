/* global CWDebug, Connichiwa, CWUtil */
"use strict";


$(document).ready(function() {
  var startLocation;
  var endLocation;
  $("body").on("mousedown touchstart", function(e) {
    startLocation = CWUtil.getEventLocation(e, "client");

    // var client = CWUtil.getEventLocation(e, "client");
    // var page = CWUtil.getEventLocation(e, "page");

    // CWDebug.log(1, "Touch start. Screen: "+JSON.stringify(startLocation)+". Client: "+JSON.stringify(client)+". Page: "+JSON.stringify(page));
  });

  $("body").on("mousemove touchmove", function(e) {
    if (startLocation === undefined) return;

    //TODO if the user stops moving the finger or starts moving in another direction,
    //this swipe is invalid
    
    endLocation = CWUtil.getEventLocation(e, "client");
  });

  $("body").on("mouseup touchend", function(e) {
    if (startLocation === undefined || endLocation === undefined) return;

    //TODO check if the swipe had a certain minimum length

    //TODO check if the swipe was a straight line

    //Check if the touch ended at a device edge
    //If so, it's a potential part of a multi-device pinch, so send it to the master
    var endsAtTopEdge    = (endLocation.y <= 50);
    var endsAtLeftEdge   = (endLocation.x <= 50);
    var endsAtBottomEdge = (endLocation.y >= (screen.availHeight - 50));
    var endsAtRightEdge  = (endLocation.x >= (screen.availWidth - 50));

    var edge = "invalid";
    if (endsAtTopEdge)         edge = "top";
    else if (endsAtLeftEdge)   edge = "left";
    else if (endsAtBottomEdge) edge = "bottom";
    else if (endsAtRightEdge)  edge = "right";

    if (edge === "invalid") return;

    CWDebug.log(1, "Endlocation is "+JSON.stringify(endLocation)+", edge is "+edge);

    var message = {
      type   : "pinchswipe",
      device : Connichiwa.getIdentifier(),
      edge   : edge,
      x      : endLocation.x,
      y      : endLocation.y
    };
    Connichiwa.send(message);

    startLocation = undefined;
    endLocation   = undefined;
  });
});
