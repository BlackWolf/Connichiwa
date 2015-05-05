/* global CWEventManager, CWVector, CWUtil, CWDebug, CWModules */
'use strict';



/**
 * CWGestures is responsible for capturing gestures on DOM elements and
 *    passing the detected gestures on to other parts of the library. Right
 *    now, this is used to detect the pinch gesture used in device stitching
 * @namespace CWGestures
 * @private
 */
var CWGestures = CWGestures || {};


/**
 * The start location of the current touch
 * @type {Point}
 * @private
 */
CWGestures._touchStart = undefined;


/**
 * The last location of the current touch
 * @type {Point}
 * @private
 */
CWGestures._touchLast = undefined;


/**
 * The vector between the last touch location ({@link CWGestures._touchLast})
 *    and the touch before that. undefined if only one touch arrived so far
 * @type {CWVector}
 * @private
 */
CWGestures._touchLastVector = undefined;


/**
 * Determines if the current gesture qualifies for a potential swipe
 * @type {Boolean}
 * @private
 */
CWGestures._touchCheckable = false;

/**
 * If a direction change occurs during a swipe, the original swipe direction is
 *    stored in this property
 * @type {CWVector}
 * @private
 */
CWGestures._touchAngleReferenceVector = undefined;


/**
 * The number of touches that occured after a poential direction change
 * @type {Number}
 * @private
 */
CWGestures._touchAngleChangedCount = 0;


/**
 * Initializes the CWGestures object, should be called on application launch
 * @function
 * @private
 */
CWGestures.__constructor = function() {
  var that = this;
  $(document).ready(function() {
    that._captureOn($('body'));
  });
}.bind(CWGestures);


/**
 * Called when a touchstart or mousedown occurs on one of the monitored 
 * elements
 * @param  {Event} e The touch or mouse event that triggered the function
 * @function
 * @private
 */
CWGestures._onDown = function(e) {
  this._touchStart = CWUtil.getEventLocation(e, 'client');
}.bind(CWGestures);


/**
 * Called when a touchmove or mousemove occurs on one of the monitored 
 * elements
 * @param  {Event} e The touch or mouse event that triggered the function
 * @function
 * @private
 */
CWGestures._onMove = function(e) {
  if (this._touchStart === undefined) return;

  var newTouch = CWUtil.getEventLocation(e, 'client');

  //Just checking the swipe vector in _onEnd is not enough: If the finger 
  //changes direction and then returns the original direction, this would be
  //detected as a valid swipe. Therefore, we monitor for direction changes in
  //this method and cancel a swipe on a direction change.
  //Unfortunately, touches can "jitter", so we need to make sure that
  //small (or very short) direction changes don't cancel the swipe. Therefore, 
  //the original swipe direction is stored in _touchAngleReferenceVector and 
  //successive touches are checked against that vector. If the user resumes the
  //original direction within 3 touches, the swipe is still considered valid.
  //
  //Furthermore, we add some noise reduction by making sure the last finger 
  //vector has a minimum length of 2 and the entire swipe is at least 5 pixels 
  //in length
  if (this._touchLast !== undefined) {
    var totalTouchVector = new CWVector(this._touchStart, newTouch);
    var newTouchVector   = new CWVector(this._touchLast,  newTouch);

    this._touchCheckable = (this._touchCheckable || totalTouchVector.length() > 5);
    if (this._touchCheckable && newTouchVector.length() > 1) {

      //A previous touch was a direction change, compare with the saved
      //reference vector by calculating their angle
      if (this._touchAngleReferenceVector !== undefined) {
        var referenceTouchAngle = newTouchVector.angleBetween(this._touchAngleReferenceVector);
        if (referenceTouchAngle > 20) {
        // if (referenceTouchAngle > 30) {
          this._touchAngleChangedCount++;

          //This is a security measure against "jitter": Only if 3 successive
          //touches are a direction change do we invalidate the swipe
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
          var newTouchAngle = newTouchVector.angleBetween(this._touchLastVector);
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
}.bind(CWGestures);


/**
 * Called when a touchend or mouseup occurs on one of the monitored 
 * elements
 * @param  {Event} e The touch or mouse event that triggered the function
 * @function
 * @private
 */
CWGestures._onUp = function(e) {
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
    CWDebug.log(3, 'Swipe REJECTED because it was too short (' + swipeLength + ')');
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
}.bind(CWGestures);


/**
 * Installs the necessary event handlers on the given DOM or jQuery element to
 *    capture gestures on that element
 * @param  {HTMLElement|jQuery} el The element that should be monitored for
 *    gestures
 * @function
 * @private
 */
CWGestures._captureOn = function(el) {
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
}.bind(CWGestures);

//Initalize module. Delayed call to make sure all modules are ready
if (CWGestures.__constructor) window.setTimeout(CWGestures.__constructor, 0);

CWModules.add('CWGestures');
