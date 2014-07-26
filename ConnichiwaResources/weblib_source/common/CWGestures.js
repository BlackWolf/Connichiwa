/* global CWDebug, Connichiwa, CWUtil */
"use strict";


// (function() {
$(document).ready(function() {
  var startLocation;
  var endLocation;
  $("body").on("mousedown touchstart", function(e) {
    startLocation = CWUtil.getEventLocation(e, "screen");
    // CWDebug.log(1, "Touch started @ "+JSON.stringify(startLocation));
  });

  $("body").on("mousemove touchmove", function(e) {
    endLocation = CWUtil.getEventLocation(e, "screen");
  });

  $("body").on("mouseup touchend", function(e) {
    if (startLocation === undefined || endLocation === undefined) return;

    // CWDebug.log(1, "Touch eneded @ " + JSON.stringify(endLocation));

    //First, check if the touch ended at a device edge
    //If so, it's a potential part of a multi-device pinch, so send it to the master
    var endsAtTopEdge = (endLocation.y <= 50);
    var endsAtLeftEdge = (endLocation.x <= 50);
    var endsAtBottomEdge = (endLocation.y >= screen.availHeight - 50);
    var endsAtRightEdge = (endLocation.x >= screen.availWidth - 50);

    var edge = "invalid";
    if (endsAtTopEdge) edge = "top";
    else if (endsAtLeftEdge) edge = "left";
    else if (endsAtBottomEdge) edge = "bottom";
    else if (endsAtRightEdge) edge = "right";

    if (edge === "invalid") return;

    var message = {
      type   : "pinchswipe",
      device : Connichiwa.getIdentifier(),
      edge   : edge
    };
    Connichiwa.send(message);

    startLocation = undefined;
    endLocation = undefined;
  });
});
// })();
