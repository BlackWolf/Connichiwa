/* global OOP, CWDebug */
"use strict";


var CWPinchManager = OOP.createSingleton("Connichiwa", "CWPinchManager", {
  "private _swipes": {},

  "package detectedSwipe": function(identifier, edge) {
    //Check if the swipe corresponds with another swipe in the database to form a pinch
    var now = new Date();
    var matchingEdge = this._oppositeEdge(edge);

    for (var key in this._swipes) {
      var savedSwipe = this._swipes[key];

      //We can't create a pinch on a single device
      if (savedSwipe.device === identifier) continue;

      //If the edge of the other swipe is not on the correct device edge, it's not forming a pinch
      if (savedSwipe.edge !== matchingEdge) continue;

      //If the existing swipe is too old, it is invalid
      if ((now.getTime() - savedSwipe.date.getTime()) > 1000) continue;

      //WE HAVE A PINCH
      
    }
    
    //If the swipe does not seem to be part of a pinch, remember it for later
    this._swipes[identifier] = { device: identifier, edge: edge, date: now };
  },


  "private _oppositeEdge": function(edge) {
    switch (edge) {
      case "top": return "bottom"; 
      case "bottom": return "top";
      case "left": return "right";
      case "right": return "left";
    }

    return "invalid";
  }
});
