"use strict";

var OOP = (function() {
  var DEFAULT_PACKAGE_NAME = "default";

  var classes = {};
  var packages = {};

  var createSingleton = function(packageName, className, properties) {
    //if we only get 2 arguments, the packageName was omitted
    if (properties === undefined) {
      properties = className;
      className = packageName;
      packageName = DEFAULT_PACKAGE_NAME;
    }

    return _createSingletonInPackage(packageName, className, properties);
  };

  var _createSingletonInPackage = function(packageName, className, properties) {
    // To create a new class, we first create an empty class and then
    // extend it with the given properties
    var theClass = {
      private : function() {},
      package : function() {},
      public  : function() {}
    };

    if (packageName in packages === false) {
      packages[packageName] = function() {};
    }

    //Save the package-scoped properties of the class in the package so other
    //classes in the same package get access to them
    //Furthermore, set a private package property of the class to its package
    //so the package is accessible inside the class via "this.package"
    var thePackage = packages[packageName];
    thePackage[className] = theClass.package;
    theClass.private.package = thePackage;

    //Save all scopes of the class OOP-internally
    //We need those if we want to extend the class later
    if (packageName in classes === false) classes[packageName] = {};
    classes[packageName][className] = theClass;

    return _extendSingletonInPackage(packageName, className, properties);
  };


  var extendSingleton = function(packageName, className, properties) {
    //if we only get 2 arguments, the packageName was omitted
    if (properties === undefined) {
      properties = className;
      className = packageName;
      packageName = DEFAULT_PACKAGE_NAME;
    }

    return _extendSingletonInPackage(packageName, className, properties);
  };


  var _extendSingletonInPackage = function(packageName, className, properties) {
    if (packageName in classes === false) return;
    if (className in classes[packageName] === false) return;
    var addedConstructor = false;
    var theClass = classes[packageName][className];

    var getter = function(scope, propertyName) { return function() { return scope[propertyName]; }; };
    var setter = function(scope, propertyName) { return function(value) { scope[propertyName] = value; }; };
    
    var errorGetter = function() { return undefined; };
    var errorSetter = function(value) { throw new TypeError("Cannot set non-visible property"); };
  
    // Walk over each property we got. Determine its visibility
    // and add it to the right object so it has the correct scope 
    for (var modifiedPropertyName in properties) {
      if (properties.hasOwnProperty(modifiedPropertyName)) {

        //Determine visibility
        var visibility = "private";
        var propertyName = modifiedPropertyName;
        if (propertyName.indexOf("public ") === 0) {
          visibility = "public";
          propertyName = propertyName.substr(7);
        } else if (propertyName.indexOf("package ") === 0) {
          visibility = "package";
          propertyName = propertyName.substr(8);
        } else if (propertyName.indexOf("private ") === 0) {
          propertyName = propertyName.substr(8);
        }

        //
        // METHODS
        // 
        // Methods simply need to be added to the correct scope. This means:
        // - private methods are only in private scope (available within the class)
        // - package methods are in private and package scope (not available publicly)
        // - public methods are in private, package and public scope (available everywhere)
        // Furthermore, each method is bound to the private scope - from inside a class method 
        // we can then access every class method and property using "this"
        // 
        
        if (typeof properties[modifiedPropertyName] === "function")
        {
          var theMethod = properties[modifiedPropertyName].bind(theClass.private);

          switch (visibility) {
            case "private":
              theClass.private[propertyName]  = theMethod;
              break;
            case "package":
              theClass.private[propertyName]  = theMethod;
              theClass.package[propertyName]  = theMethod;
              break;
            case "public":
              theClass.private[propertyName]  = theMethod;
              theClass.package[propertyName]  = theMethod;
              theClass.public[propertyName]   = theMethod;
              break;
          }

          if (propertyName === "__constructor") {
            addedConstructor = true;
          }

          //
          // PROPERTIES
          // 
          // Properties are more complex than methods because primitives are not 
          // passed by reference. We still need to make sure we access the same
          // property in all scopes.
          // To achieve that, we only define the property in the most visible scope (e.g. in
          // package scope if the property is marked package). The more limited scopes get
          // getters & setters that access that property.
          // Furthermore, accessing a property that doesn't exist creates that property
          // in JavaScript. E.g., accessing a private property publicly does not fail, but creates
          // that property in public scope. Therefore, we define getters & setters for the more
          // public scopes that throw an error. 
          // 
          
        } else {
          switch (visibility) {
            case "private":
              theClass.private[propertyName] = properties[modifiedPropertyName];

              Object.defineProperty(theClass.package, propertyName, {
                get : errorGetter,
                set : errorSetter
              });

              Object.defineProperty(theClass.public, propertyName, {
                get : errorGetter,
                set : errorSetter
              });

              break;
            case "package":
              theClass.package[propertyName] = properties[modifiedPropertyName];

              Object.defineProperty(theClass.private, propertyName, {
                get : getter(theClass.package, propertyName),
                set : setter(theClass.package, propertyName)
              });

              Object.defineProperty(theClass.public, propertyName, {
                get : errorGetter,
                set : errorSetter
              });

              break;
            case "public":
              theClass.public[propertyName] = properties[modifiedPropertyName];

              Object.defineProperty(theClass.private, propertyName, {
                get : getter(theClass.public, propertyName),
                set : setter(theClass.public, propertyName)
              });

              Object.defineProperty(theClass.package, propertyName, {
                get : getter(theClass.public, propertyName),
                set : setter(theClass.public, propertyName)
              });

              break;
          }
        }
      }
    }

    //Now that the class is built, call a constructor if there is any
    //Constructors have the magic name __constructor
    //We invoke the constructor in the next run loop, because we have to wait
    //for other classes and parts of the package to be build
    if (addedConstructor === true) {
      window.setTimeout(theClass.private.__constructor, 0);
    }

    return theClass.public;
  };


  return {
    createSingleton : createSingleton,
    extendSingleton : extendSingleton
  };
})();  
"use strict";



/**
 * Gives us some nice debug convenience functions
 *
 * @namespace CWDebug
 */
var CWDebug = (function()
{
  /**
   * true if debug mode is on, otherwise false
   */
  var debug = true;

  var enableDebug = function() {
    debug = true;
  };


  var disableDebug = function() {
    debug = false;
  };

  /**
   * Logs a message to the console if debug mode is on
   *
   * @param {int} priority The priority of the message. Messages with lower priority are printed at lower debug states.
   * @param {string} message the message to log
   *
   * @memberof CWDebug
   */
  var log = function(priority, message)
  {
    // if (priority > 3) return;
    if (debug) console.log(priority + "|" + message);
  };

  return {
    enableDebug  : enableDebug,
    disableDebug : disableDebug,
    log          : log
  };
})();
/* global Connichiwa, CWSystemInfo, CWUtil, CWEventManager, CWDebug */
/* global nativeCallConnectRemote */
"use strict";



var CWDeviceDiscoveryState = 
{
  DISCOVERED : "discovered",
  LOST       : "lost"
};

var CWDeviceConnectionState =
{
  DISCONNECTED : "disconnected",
  CONNECTING   : "connecting",
  CONNECTED    : "connected"
};



/**
 * An instance of this class describes a remote device that was detected nearby. It furthermore keeps information like the distance of the device and other connection-related information.
 *
 * @namespace CWDevice
 */
function CWDevice(properties)
{
  if (!properties.identifier) throw "Cannot instantiate CWDevice without an identifier";

  this.discoveryState = CWDeviceDiscoveryState.LOST;
  this.connectionState = CWDeviceConnectionState.DISCONNECTED;
  this.distance = -1;
  var _identifier = properties.identifier;
  var _launchDate = Date.now() / 1000.0;
  var _name = "unknown";
  var _ppi = CWSystemInfo.DEFAULT_PPI();
  var _isLocal = false; 

  if (properties.launchDate) _launchDate = properties.launchDate;
  if (properties.name) _name = properties.name;
  if (properties.ppi && properties.ppi > 0) _ppi = properties.ppi;
  if (properties.isLocal) _isLocal = properties.isLocal;
  
  /**
   * Returns the identifier of this device
   *
   * @returns {string} The identifier of this device
   *
   * @method getIdentifier
   * @memberof CWDevice
   */
  this.getIdentifier = function() { return _identifier; };

  this.getLaunchDate = function() { return _launchDate; };

  this.getName = function() { return _name; };

  this.getPPI = function() { return _ppi; };

  this.isLocal = function() {
    return this._isLocal;
  };
  
  this.isNearby = function()
  {
    return (this.discoveryState === CWDeviceDiscoveryState.DISCOVERED);
  };
  
  this.canBeConnected = function() 
  { 
    return (this.connectionState === CWDeviceConnectionState.DISCONNECTED && 
      this.discoveryState === CWDeviceDiscoveryState.DISCOVERED);
  };
  
  this.isConnected = function()
  {
    return (this.connectionState === CWDeviceConnectionState.CONNECTED);
  };

  return this;
}


// DEVICE COMMUNICATION API


CWDevice.prototype.append = function(target, html) {
  Connichiwa.append(this.getIdentifier(), target, html);
};


CWDevice.prototype.loadScript = function(url, callback) {
  Connichiwa.loadScript(this.getIdentifier(), url, callback);
};


CWDevice.prototype.send = function(messageObject)
{
  Connichiwa.send(this.getIdentifier(), messageObject);
};


/**
 * Checks if the given object is equal to this device. Two devices are equal if they describe the same remote device (= their ID is the same). This does not do any pointer comparison.
 *
 * @param {object} object The object to compare this CWDevice to
 * @returns {bool} true if the given object is equal to this CWDevice, otherwise false
 */
CWDevice.prototype.equalTo = function(object)
{
  if (CWDevice.prototype.isPrototypeOf(object) === false) return false;
  return this.getIdentifier() === object.getIdentifier();
};


/**
 * Returns a string representation of this CWDevice
 *
 * @returns {string} a string representation of this device
 */
CWDevice.prototype.toString = function() {
  return this.getIdentifier();
};
/* global CWUtil, CWDebug */
"use strict";



/**
 * Manages events throughout Connichiwa. Allows all parts of Connichiwa to register for and trigger events.
 *
 * @namespace CWEventManager
 */
var CWEventManager = (function()
{
  /**
   * A dictionary where each entry represents a single event. The key is the event name. Each entry of the dictionary is an array of callbacks that should be called when the event is triggered.
   */
  var _callbacks = {};

  /**
   * Registers the given callback function for the given event. When the event is triggered, the callback will be executed.
   *
   * @param {string} event The name of the event
   * @param {function} callback The callback function to call when the event is triggered
   *
   * @memberof CWEventManager
   */
  var register = function(event, callback)
  {
    if (typeof(event) !== "string") throw "Event name must be a string";
    if (typeof(callback) !== "function") throw "Event callback must be a function";

    event = event.toLowerCase();

    //event can be a space-seperated list of event names
    if (event.indexOf(" ") !== -1) {
      var events = event.split(" ");
      for (var i = 0; i < events.length; i++) {
        CWEventManager.register(events[i], callback);
      }
      return;
    }

    if (!_callbacks[event]) _callbacks[event] = [];
    _callbacks[event].push(callback);
    CWDebug.log(3, "Attached callback to " + event);
  };

  /**
   * Triggers the given events, calling all callback functions that have registered for the event.
   *
   * @param {string} event The name of the event to trigger
   *
   * @memberof CWEventManager
   */
  var trigger = function(logPrio, event)
  {
    //Get the arguments passed to trigger() without logPrio and event
    var args = Array.prototype.slice.call(arguments);
    if (CWUtil.isString(logPrio) === true) {
      //Only the event was given, default logPrio is used
      event = logPrio;
      logPrio = 4;
      args.shift();
    } else {
      //logPrio and event were given, remove both from args
      args.shift();
      args.shift();
    }

    event = event.toLowerCase();

    if (!_callbacks[event]) { 
      CWDebug.log(5, "No callbacks  for " + event + " registered"); 
      return; 
    }

    CWDebug.log(logPrio, "Triggering event " + event + " for "+_callbacks[event].length + " callbacks");
    for (var i = 0; i < _callbacks[event].length; i++)
    {
      var callback = _callbacks[event][i];
      callback.apply(null, args); //calls the callback with arguments args
    }
  };

  return {
    register : register,
    trigger  : trigger
  };
})();
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
          // if (referenceTouchAngle > 30) {
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
            // if (newTouchAngle > 30) {
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
  });
});
/* global OOP, gyro, CWEventManager, CWDebug */
"use strict";



var CWGyroscope = OOP.createSingleton("Connichiwa", "CWGyroscope", {
  _lastMeasure: undefined,

  __constructor: function() {
  gyro.frequency = 500;
  gyro.startTracking(this._onUpdate);    

    //TODO we should only start tracking if necessary
    //necessary for now means the device has been stitched
    //but how do we best figure that out?
  },

  "private _onUpdate": function(o) {
    if (o.alpha === null || o.beta === null || o.gamma === null ||
      o.x === null || o.y === null || o.z === null) return;

    if (this._lastMeasure === undefined) this._lastMeasure = o;
    
    //Send gyro update
    var deltaAlpha = o.alpha - this._lastMeasure.alpha;
    var deltaBeta  = o.beta  - this._lastMeasure.beta;
    var deltaGamma = o.gamma - this._lastMeasure.gamma;
    var gyroData = { 
      alpha : o.alpha, 
      beta  : o.beta, 
      gamma : o.gamma,
      delta : {
        alpha : deltaAlpha, 
        beta  : deltaBeta, 
        gamma : deltaGamma
      }
    };
    CWEventManager.trigger(5, "gyroscopeUpdate", gyroData);

    //Send accelerometer update
    var deltaX = o.x - this._lastMeasure.x;
    var deltaY = o.y - this._lastMeasure.y;
    var deltaZ = o.z - this._lastMeasure.z;
    var accelData = { 
      x     : o.x, 
      y     : o.y, 
      z     : o.z,
      delta : {
        x : deltaX, 
        y : deltaY, 
        z : deltaZ
      }
    };
    CWEventManager.trigger(5, "accelerometerUpdate", accelData);

    //We need to copy the values of o because o will be altered by gyro
    this._lastMeasure = { x: o.x, y: o.y, z: o.z, alpha: o.alpha, beta: o.beta, gamma: o.gamma };
  },


  "package getLastGyroscopeMeasure": function() {
    if (this._lastMeasure === undefined) return undefined;

    return { 
      alpha : this._lastMeasure.alpha, 
      beta  : this._lastMeasure.beta,
      gamma : this._lastMeasure.gamma
    };
  },


  "package getLastAccelerometerMeasure": function() {
    if (this._lastMeasure === undefined) return undefined;
    
    return {
      x : this._lastMeasure.x,
      y : this._lastMeasure.y,
      z : this._lastMeasure.z
    };
  }
});
/* global CWEventManager, CWStitchManager */
"use strict";

function CWLocation(x, y, width, height, isLocal) {
  //
  // TODO
  // 
  // make x, y, widht, height private so it can only be accessed through
  // setLocal/setGlobal
  // 
  
  if (isLocal === true) {
    var global = CWLocation.toGlobal(x, y, width, height);
    this.x      = global.x;
    this.y      = global.y;
    this.width  = global.width;
    this.height = global.height;
  } else {
    //By default, we assume the location to be global coordinates
    this.x      = x;
    this.y      = y;
    this.width  = width;
    this.height = height;
  }

  //When this device is stitched or unstitched, we adjust the values to the
  //new device transformation so that the local coordinates stay the same
  //This is done so that content shown on this device does not change location or
  //size on a stitch or unstitch
  CWEventManager.register("wasUnstitched", function(message) {
    this.x -= message.deviceTransformation.x;
    this.y -= message.deviceTransformation.y;

    this.x *= message.deviceTransformation.scale;
    this.y *= message.deviceTransformation.scale;
    this.width *= message.deviceTransformation.scale;
    this.height *= message.deviceTransformation.scale;
  }.bind(this));

  CWEventManager.register("wasStitched", function(message) {
    this.x /= message.deviceTransformation.scale;
    this.y /= message.deviceTransformation.scale;
    this.width /= message.deviceTransformation.scale;
    this.height /= message.deviceTransformation.scale;

    this.x += message.deviceTransformation.x;
    this.y += message.deviceTransformation.y;
  }.bind(this));

  this.getGlobal = function() {
    return { 
      x      : this.x, 
      y      : this.y, 
      width  : this.width, 
      height : this.height
    };
  };

  this.getLocal = function() {
    return CWLocation.toLocal(this.x, this.y, this.width, this.height);
  };

  this.getGlobalX = function() { return this.x; };

  this.getGlobalY = function() { return this.y; };

  this.getGlobalWidth = function() { return this.width; };

  this.getGlobalHeight = function() { return this.height; };

  this.getLocalX = function() { return this.getLocal().x; };

  this.getLocalY = function() { return this.getLocal().y; };

  this.getLocalWidth = function() { return this.getLocal().width; };

  this.getLocalHeight = function() { return this.getLocal().height; };

  this.setGlobal = function(x, y, width, height) {
    if (x      !== undefined) this.x      = x;
    if (y      !== undefined) this.y      = y;
    if (width  !== undefined) this.width  = width;
    if (height !== undefined) this.height = height;
  };

  this.setLocal = function(x, y, width, height) {
    CWDebug.log(3, "To Global: "+x+", "+y+", "+width+", "+height);
    var global = CWLocation.toGlobal(x, y, width, height);
    CWDebug.log(3, JSON.stringify(global));
    this.x      = global.x;
    this.y      = global.y;
    this.width  = global.width;
    this.height = global.height;
  };

  this.setGlobalX = function(v) { this.setGlobal(v, this.y, this.width, this.height); };

  this.setGlobalY = function(v) { this.setGlobal(this.x, v, this.width, this.height); };

  this.setGlobalWidth = function(v) { this.setGlobal(this.x, this.y, v, this.height); };

  this.setGlobalHeight = function(v) { this.setGlobal(this.x, this.y, this.width, v); };

  this.setLocalX = function(v) {
    var local = this.getLocal();
    this.setLocal(v, local.y, local.width, local.height);
  };

  this.setLocalY = function(v) {
    var local = this.getLocal();
    this.setLocal(local.x, v, local.width, local.height);
  };

  this.setLocalWidth = function(v) {
    var local = this.getLocal();
    this.setLocal(local.x, local.y, v, local.height);
  };

  this.setLocalHeight = function(v) {
    var local = this.getLocal();
    this.setLocal(local.x, local.y, local.width, v);
  };

  this.toString = function() {
    return JSON.stringify(this.getGlobal());
  };

  this.copy = function() {
    return CWLocation.fromString(this.toString());
  };
}

CWLocation.toGlobal = function(x, y, width, height) {
  if (x === undefined) x = 0;
  if (y === undefined) y = 0;
  if (width  === undefined) width = 0;
  if (height === undefined) height = 0;

  var result = { x: x, y: y, width: width, height: height };

  var transformation = CWStitchManager.getDeviceTransformation();
  
  //Adjust x/y values from our rotation to the master device, which always has 0º rotation
  if (transformation.rotation === 0) {
    result.y      = y;
    result.x      = x;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 90) {
    result.y      = (transformation.height * transformation.scale) - x - width;
    result.x      = y;
    result.width  = height;
    result.height = width;
  }
  if (transformation.rotation === 180) {
    result.y      = (transformation.height * transformation.scale) - y - height;
    result.x      = (transformation.width * transformation.scale)  - x - width;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 270) {
    result.y      = x;
    result.x      = (transformation.width * transformation.scale) - y - height;
    result.width  = height;
    result.height = width;
  }

  //To get actual global coordinates we need to add the device's translation
  result.x += (transformation.x * transformation.scale);
  result.y += (transformation.y * transformation.scale);

  //Finally, adjust the scale to the scale of the master device
  result.x      /= transformation.scale;
  result.y      /= transformation.scale;
  result.width  /= transformation.scale;
  result.height /= transformation.scale;

  return result;
};

CWLocation.toLocal = function(x, y, width, height) {
  if (x === undefined) x = 0;
  if (y === undefined) y = 0;
  if (width  === undefined) width = 0;
  if (height === undefined) height = 0;

  var result = { x: x, y: y, width: width, height: height };

  var transformation = CWStitchManager.getDeviceTransformation();

  //Adjust values from the master rotation (0º) to our rotation
  //Also, we incorporate device translation here - we can't do that afterwards
  //because transformation.x/y are in local coordinates and therefore need to be
  //applied differently depending on rotation
  if (transformation.rotation === 0) {
    result.y      = y - transformation.y;
    result.x      = x - transformation.x;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 90) {
    result.y      = x - transformation.x;
    result.x      = transformation.height - (y - transformation.y + height);
    result.width  = height;
    result.height = width;
  }
  if (transformation.rotation === 180) {   
    result.y      = transformation.height - (y - transformation.y + height);
    result.x      = transformation.width  - (x - transformation.x + width);
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 270) {        
    result.y      = transformation.width - (x - transformation.x + width);
    result.x      = (y - transformation.y);
    result.width  = height;
    result.height = width;
  }

  //Get values in the local device's scaling
  result.x      *= transformation.scale;
  result.y      *= transformation.scale;
  result.width  *= transformation.scale;
  result.height *= transformation.scale;

  return result;
};

CWLocation.applyRotation = function(x, y, width, height, rotation) {
  var transformation = CWStitchManager.getDeviceTransformation();

  if (x === undefined) x = 0;
  if (y === undefined) y = 0;
  if (width  === undefined) width = 0;
  if (height === undefined) height = 0;
  if (rotation === undefined) rotation = transformation.rotation;

  var result = { x: x, y: y, width: width, height: height };

  if (transformation.rotation === 0) {
    result.y      = y;
    result.x      = x;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 90) {
    result.y      = -x;
    result.x      = y;
    result.width  = height;
    result.height = width;
  }
  if (transformation.rotation === 180) {   
    result.y      = -y;
    result.x      = -x;
    result.width  = width;
    result.height = height;
  }
  if (transformation.rotation === 270) {        
    result.y      = x;
    result.x      = -y;
    result.width  = height;
    result.height = width;
  }

  return result;  
};

CWLocation.fromString = function(s) {
  var obj = JSON.parse(s);

  return new CWLocation(
    parseFloat(obj.x),
    parseFloat(obj.y),
    parseFloat(obj.width),
    parseFloat(obj.height),
    false
  );
};

function CWPoint(x, y, isLocal) {
  return new CWLocation(x, y, undefined, undefined, isLocal);
}

function CWSize(width, height, isLocal) {
  return new CWLocation(undefined, undefined, width, height, isLocal);
}
/* global OOP, Connichiwa, CWEventManager, CWSystemInfo, CWUtil */
"use strict";


 
var CWStitchManager = OOP.createSingleton("Connichiwa", "CWStitchManager", {
  "private _isStitched": false,
  "private _deviceTransformation": undefined,
  "private _gyroDataOnStitch": undefined,

  "public unstitchOnMove": true,
  "public ignoreMoveAxis": [],


  __constructor: function() {
    CWEventManager.register("stitchswipe",         this._onLocalSwipe);
    CWEventManager.register("wasStitched",         this._onWasStitched);
    CWEventManager.register("wasUnstitched",       this._onWasUnstitched);
    CWEventManager.register("gyroscopeUpdate",     this._onGyroUpdate);
    CWEventManager.register("accelerometerUpdate", this._onAccelerometerUpdate);
  },


  _onWasStitched: function(message) {
    this._gyroDataOnStitch = this.package.CWGyroscope.getLastGyroscopeMeasure();
    this._deviceTransformation = message.deviceTransformation;
    this._isStitched = true;

    //TODO register for gyroscopeUpdate instead of in constructor
  },


  _onWasUnstitched: function(message) {
    this._gyroDataOnStitch = undefined;
    this._deviceTransformation = this.DEFAULT_DEVICE_TRANSFORMATION();
    this._isStitched = false;

    //TODO unregister from gyroscopeUpdate
  },


  _onLocalSwipe: function(swipeData) {
    swipeData.type   = "stitchswipe";
    swipeData.device = Connichiwa.getIdentifier();
    swipeData.width  = CWSystemInfo.viewportWidth();
    swipeData.height = CWSystemInfo.viewportHeight();
    Connichiwa.send(swipeData);
  },


  _onGyroUpdate: function(gyroData) {
    if (this.isStitched() === false) return;
    if (this.unstitchOnMove === false) return;

    //Might happen if _onWasStitched is called before the first gyro measure arrived
    if (this._gyroDataOnStitch === undefined) {
      this._gyroDataOnStitch = gyroData;
    }
     
    var deltaAlpha = Math.abs(gyroData.alpha - this._gyroDataOnStitch.alpha);
    var deltaBeta  = Math.abs(gyroData.beta  - this._gyroDataOnStitch.beta);
    var deltaGamma = Math.abs(gyroData.gamma - this._gyroDataOnStitch.gamma);

    //Modulo gives us the smallest possible angle (e.g. 1º and 359º gives us 2º)
    deltaAlpha = Math.abs((deltaAlpha + 180) % 360 - 180);
    deltaBeta  = Math.abs((deltaBeta  + 180) % 360 - 180);
    deltaGamma = Math.abs((deltaGamma + 180) % 360 - 180);

    //If the device is tilted more than 20º, we back out of the stitch
    //We give a little more room for alpha. Alpha means the device was moved on the
    //table, which is not as bad as actually picking it up. 
    //Axises in the "ignoreMoveAxis" array are not checked
    if ((CWUtil.inArray("alpha", this.ignoreMoveAxis) === false && deltaAlpha >= 35) ||
        (CWUtil.inArray("beta",  this.ignoreMoveAxis) === false && deltaBeta  >= 20) ||
        (CWUtil.inArray("gamma", this.ignoreMoveAxis) === false && deltaGamma >= 20)) {
      this._quitStitch();
    }
  },


  _onAccelerometerUpdate: function(accelData) {
    if (this.isStitched() === false) return;
    if (this.unstitchOnMove === false) return;


    //Get the accelerometer values normalized
    //z includes earth's gravitational force (~ -9.8), but sometimes is 9.8 and 
    //sometimes -9.8, depending on browser and device, therefore we use its absolute
    //value
    var x = Math.abs(accelData.x);
    var y = Math.abs(accelData.y);
    var z = Math.abs(Math.abs(accelData.z) - 9.81);

    //1.0 seems about a good value which doesn't trigger on every little shake,
    //but triggers when the device is actually moved 
    //Axises in the "ignoreMoveAxis" array are not checked
    if ((CWUtil.inArray("x", this.ignoreMoveAxis) === false && x >= 1.0) || 
        (CWUtil.inArray("y", this.ignoreMoveAxis) === false && y >= 1.0) ||
        (CWUtil.inArray("z", this.ignoreMoveAxis) === false && z >= 1.0)) {
      this._quitStitch();
    }
  },


  "private _quitStitch": function() {
    var data = {
      type   : "quitstitch",
      device : Connichiwa.getIdentifier()
    };
    Connichiwa.send(data);
  },


  "public unstitch": function() {
    this._quitStitch();
  },


  "public isStitched": function() {
    return this._isStitched;
  },


  "public getDeviceTransformation": function() {
    if (this._deviceTransformation === undefined) {
      return this.DEFAULT_DEVICE_TRANSFORMATION();
    }
    
    return this._deviceTransformation;
  },

  "private DEFAULT_DEVICE_TRANSFORMATION": function() {
    return { 
      x        : 0, 
      y        : 0, 
      width    : CWSystemInfo.viewportWidth(), 
      height   : CWSystemInfo.viewportHeight(),
      rotation : 0, 
      scale    : 1.0 
    };
  }
});
/* global OOP */
"use strict";



var CWSystemInfo = OOP.createSingleton("Connichiwa", "CWSystemInfo", {
  _ppi : undefined,


  "public PPI": function() {
    if (this._ppi !== undefined) return this._ppi;

    this._ppi = this.DEFAULT_PPI();

    //For high density screens we simply assume 142 DPI
    //This, luckily, is correct for a lot of android devices
    if (window.devicePixelRatio > 1.0) {
      this._ppi = 142; 
    }
     
    //For iPhone and iPad, we can figure out the DPI pretty well
    if (navigator.platform === "iPad") {
      //TODO usually we would distinguish iPad Mini's (163dpi)
      //but we can't, so we return normal iPad DPI
      this._ppi = 132;
    }
    if (navigator.platform === "iPhone" || navigator.platform === "iPod") {
      //Newer iPhones (for now iPhone 6+) have a different resolution, luckily they
      //also return a new devicePixelRatio
      if (window.devicePixelRatio === 3) {
        this._ppi = 153;
      } else {
        this._ppi = 163;
      }
    }

    return this._ppi;
  },


  "public isLandscape": function() {
    return (window.innerHeight < window.innerWidth);
  },


  "public viewportWidth": function() {
    return $(window).width();
  },


  "public viewportHeight": function() {
    //This seems to break in landscape when using meta-viewport height-device-height
    //so basically for now: don't use that
    return $(window).height();
  },

  "public DEFAULT_PPI": function() {
    return 100; //HD on a 22'' monitor
  }
});
"use strict";



/**
 * A utility class giving us some often needed utility functions.
 *
 * @namespace CWUtil
 */
var CWUtil = (function()
{
  var parseURL = function(url) 
  {
    var parser = document.createElement("a");
    parser.href = url;

    return parser;
  };


  var getEventLocation = function(e, type) 
  {
    if (type === undefined) type = "page";

    var pos = { x: e[type+"X"], y: e[type+"Y"] };
    if (pos.x === undefined || pos.y === undefined)
    {
      pos = { x: e.originalEvent.targetTouches[0][type+"X"], y: e.originalEvent.targetTouches[0][type+"Y"] };
    }

    return pos;
  };


  var randomInt = function(min, max) {
    //Only one parameter was given, use it as max, 0 as min
    if (max === undefined && min !== undefined) {
      max = min;
      min = 0;
    //No parameter was given, use 0 as min, maxint as max
    } else if (max === undefined && min === undefined) {
      min = 0;
      max = Number.MAX_VALUE;
    }

    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  
  /**
   * Checks if the given parameter is an Int.
   *
   * @param {object} value A value to check
   * @returns {boolean} true if the given value is an Int, otherwise false
   *
   * @memberof CWUtil
   */
  var isInt = function(value)
  {
    return (value === parseInt(value));
  };


  var isString = function(value) {
    return (typeof(value) === "string");
  };


  /**
   * Checks if the given parameter is an object and not null.
   *
   * @param {object} value A value to check
   * @returns {boolean} true if the given value is an object, otherwise false
   *
   * @memberof CWUtil
   */
  var isObject = function(value)
  {
    return (typeof(value) === "object" && value !== null);
  };


  /**
   * Checks if the given value is in the given array.
   *
   * @param {object} value The value to check
   * @param {array} array The array that the value should be in
   * @returns {boolean} true if value is in array, otherwise false
   *
   * @memberof CWUtil
   */
  var inArray = function(value, array)
  {
    return (array.indexOf(value) > -1);
  };

  //Crazy small code to create UUIDs - cudos to https://gist.github.com/jed/982883
  var createUUID = function(a) { 
    return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,CWUtil.createUUID);
  };


  return {
    parseURL         : parseURL,
    getEventLocation : getEventLocation,
    randomInt        : randomInt,
    isInt            : isInt,
    isString         : isString,
    isObject         : isObject,
    inArray          : inArray,
    createUUID       : createUUID
  };
})();
"use strict";

function CWVector(p1, p2) {
  if (p1 === undefined || p2 === undefined) throw "Cannot instantiate Vector without 2 points";

  var _p1 = p1;
  var _p2 = p2;
  var _deltaX = _p2.x - _p1.x;
  var _deltaY = _p2.y - _p1.y;
  var _length = Math.sqrt(Math.pow(_deltaX, 2) + Math.pow(_deltaY, 2));

  this.p1 = function() { return _p1; };
  this.p2 = function() { return _p2; };
  this.deltaX = function() { return _deltaX; };
  this.deltaY = function() { return _deltaY; };
  this.length = function() { return _length; };
}

CWVector.prototype.angle = function(otherVector) {
  var vectorsProduct = this.deltaX() * otherVector.deltaX() + this.deltaY() * otherVector.deltaY();
  var vectorsLength = this.length() * otherVector.length();
  return Math.acos(vectorsProduct / vectorsLength) * (180.0 / Math.PI);
};


/* global OOP, Connichiwa, CWEventManager, CWDebug */
"use strict";


var CWWebsocketMessageParser = OOP.createSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parse": function(message) {
    switch (message.type) {
      case "ack"               : this._parseAck(message);               break;
      case "append"            : this._parseAppend(message);            break;
      case "loadscript"        : this._parseLoadScript(message);        break;
      case "wasstitched"       : this._parseWasStitched(message);       break;
      case "wasunstitched"     : this._parseWasUnstitched(message);     break;
      case "gotstitchneighbor" : this._parseGotStitchNeighbor(message); break;
      case "remotelog"         : this._parseRemoteLog(message);         break;
    }
  },


  _parseAck: function(message) {
    CWEventManager.trigger("__messageack__id" + message.original._id);
  },

  _parseAppend: function(message) {
    $(message.targetSelector).append(message.html);
  },

  _parseLoadScript: function(message) {
    var that = this;
    $.getScript(message.url).done(function() {
      that.package.Connichiwa._sendAck(message);
    }).fail(function(f, s, t) {
      CWDebug.log(1, "There was an error loading '" + message.url + "': " + t);
    });
  },

  _parseWasStitched: function(message) {
    CWEventManager.trigger("wasStitched", message);
  },

  _parseWasUnstitched: function(message) {
    CWEventManager.trigger("wasUnstitched", message);
  },

  _parseGotStitchNeighbor: function(message) {
    CWEventManager.trigger("gotstitchneighbor", message);
  },

  _parseRemoteLog: function(message) {
    CWDebug.log(message.priority, "(From "+message.source+") "+message.message);
  }
});
/* global OOP, CWEventManager, CWUtil, CWDebug */
"use strict";



var Connichiwa = OOP.createSingleton("Connichiwa", "Connichiwa", {
  "private _websocket" : undefined,


  "public getIdentifier" : function() { /* ABSTRACT */ },
  "public isMaster"      : function() { /* ABSTRACT */ },


  "public on": function(eventName, callback) {
    //We can't use the normal event system for the load event, so
    //forward it
    if (eventName === "load") {
      this.onLoad(callback);
      return;
    } 
    
    CWEventManager.register(eventName, callback);
  },


  "public onMessage": function(messageName, callback) {
    this.on("message" + messageName, callback);
  },


  "public onLoad": function(callback) {
    if (document.readyState === 'complete') {
      callback();
    } else {
      $(window).load(callback);
    }
  },


  // DEVICE COMMUNICATION API


  "public append": function(identifier, target, html) {
    //if html is missing, html is target and target is body
    if (html === undefined) {
      html = target;
      target = "body";
    }

    //target should be a selector but can also be a DOM or jQuery element
    //If so, we try to get it by its ID on the other side
    if (CWUtil.isObject(target)) {
      target = $(target).attr("id");
    }
    
    //html can be a DOM or jQuery element - if so, send the outerHTML including 
    //all styles
    if (CWUtil.isObject(html) === true) {
      var el = $(html);
      var clone = el.clone();
      clone[0].style.cssText = el[0].style.cssText; //TODO really needed?
      html = clone[0].outerHTML;
    }

    var message = {
      type           : "append",
      targetSelector : target,
      html           : html
    };
    this.send(identifier, message);
  },


  "public loadScript": function(identifier, url, callback) {
    var message = {
      type : "loadscript",
      url  : url
    };
    var messageID = this.send(identifier, message);

    if (callback !== undefined) {
      this.on("__messageack__id" + messageID, callback);
    }
  },


  "public send": function(targetIdentifier, messageObject) {
    if (messageObject === undefined) {
      messageObject = targetIdentifier;
      targetIdentifier = "master";
    }

    messageObject.source = this.getIdentifier();
    messageObject.target = targetIdentifier;
    return this._sendObject(messageObject);
  },


  "public respond": function(originalMessage, responseObject) {
    this.send(originalMessage.source, responseObject);
  },


  "public broadcast": function(messageObject, sendToSelf) 
  {
    this.send("broadcast", messageObject);

    if (sendToSelf === true) {
      this.send(this.getIdentifier(), messageObject);
    }
  },


  "package _sendAck": function(messageObject) {
    var ackMessage = {
      type     : "ack",
      original : messageObject
    };
    this.send(messageObject.source, ackMessage);
  },


  "package _sendObject": function(messageObject)
  {
    messageObject._id = CWUtil.randomInt();

    var messageString = JSON.stringify(messageObject);
    CWDebug.log(4, "Sending message: " + messageString);
    this._websocket.send(messageString);

    return messageObject._id;
  },


  "package _disconnectWebsocket": function()
  {
    this._websocket.close();
  },


  _cleanupWebsocket: function()
  {
    if (this._websocket !== undefined) 
    {
      this._websocket.onopen    = undefined;
      this._websocket.onmessage = undefined;
      this._websocket.onclose   = undefined;
      this._websocket.onerror   = undefined;
      this._websocket           = undefined;
    }
  },
});
/* global CWDevice, CWDeviceConnectionState */
/* global nativeCallConnectRemote */
"use strict";

CWDevice.prototype.connect = function()
{
  if (this.canBeConnected() === false) return;

  this.connectionState = CWDeviceConnectionState.CONNECTING;
  nativeCallConnectRemote(this.getIdentifier());
};
/* global CWDevice, CWEventManager, CWDebug */
/* global CWDeviceConnectionState, CWDeviceDiscoveryState */
"use strict";



/**
 * Manages the local device and all remote devices detected and connected to
 *
 * @namespace CWDeviceManager
 */
var CWDeviceManager = (function()
{
  var _localDevice;
  /**
   * An array of detected remote devices as CWDevice objects. All detected devices are in here, they are not necessarily connected to or used in any way by this device.
   */
  var _remoteDevices = [];

  /**
   * Adds a new remote device to the manager
   *
   * @param {CWDevice} newDevice The device that should be added to the manager. If the device already exists, nothing will happen.
   * @returns {bool} true if the device was added, otherwise false
   *
   * @memberof CWDeviceManager
   */
  var addDevice = function(newDevice)
  {
    if (CWDevice.prototype.isPrototypeOf(newDevice) === false) throw "Cannot add a non-device";
    if (getDeviceWithIdentifier(newDevice.getIdentifier()) !== null) return false;

    CWDebug.log(3, "Added device: " + newDevice.getIdentifier());
    _remoteDevices.push(newDevice);
    return true;
  };


  /**
   * Removes a remote device from the manager
   *
   * @param {string|CWDevice} identifier The identifier of the device to remove or a CWDevice. If the device is not stored by this manager, nothing will happen
  *  @returns {bool} true if the device was removed, otherwise false
   *
   * @memberof CWDeviceManager
   */
  var removeDevice = function(identifier)
  {
    if (CWDevice.prototype.isPrototypeOf(identifier) === true) identifier = identifier.getIdentifier();
      
    var device = getDeviceWithIdentifier(identifier);
    if (device === null) return false;

    CWDebug.log("Removed device: " + identifier);
    var index = _remoteDevices.indexOf(device);
    _remoteDevices.splice(index, 1);
    
    return true;
  };


  /**
   * Gets the CWDevice with the given identifier or null if the device is not stored in this manager
   *
   * @param {string} identifier The identifier of the device to search for
   * @returns A CWDevice that belongs to the given ID or null if that device cannot be found
   *
   * @memberof CWDeviceManager
   */
  var getDeviceWithIdentifier = function(identifier)
  {
    if (_localDevice !== undefined && 
      (identifier === _localDevice.getIdentifier() || identifier === "master")) {
      return _localDevice;
    }
    
    for (var i = 0; i < _remoteDevices.length; i++)
    {
      var remoteDevice = _remoteDevices[i];
      if (remoteDevice.getIdentifier() === identifier)
      {
        return remoteDevice;
      }
    }

    return null;
  };


  var getConnectedDevices = function()
  {
    var connectedDevices = [];
    for (var i = 0; i < _remoteDevices.length; i++)
    {
      var remoteDevice = _remoteDevices[i];
      if (remoteDevice.isConnected()) connectedDevices.push(remoteDevice);
    }

    return connectedDevices;
  };


  var createLocalDevice = function(properties) {
    if (_localDevice !== undefined) return false;

    properties.isLocal = true;

    _localDevice = new CWDevice(properties);
    _localDevice.discoveryState = CWDeviceDiscoveryState.LOST;
    _localDevice.connectionState = CWDeviceConnectionState.CONNECTED;

    CWDebug.log(3, "Created local device: " + JSON.stringify(properties));

    return true;
  };


  var getLocalDevice = function() {
    return _localDevice;
  };

  return {
    addDevice               : addDevice,
    removeDevice            : removeDevice,
    getDeviceWithIdentifier : getDeviceWithIdentifier,
    getConnectedDevices     : getConnectedDevices,
    createLocalDevice       : createLocalDevice,
    getLocalDevice          : getLocalDevice
  };
})();
/* global OOP, Connichiwa, CWDeviceManager, CWDevice, CWDeviceDiscoveryState, CWDeviceConnectionState, CWEventManager, CWDebug */
"use strict";



/**
 * The Connichiwa Communication Protocol Parser (Native Layer).  
 * Here the protocol used to communicate between this library and the native layer is parsed. This communication is done via JSON.
 *
 * **Local ID Information** -- type="localidentifier"  
 * Contains information about the local device. Format:
 * * identifier -- a string identifying the unique ID of the device the weblib runs on
 *
 * **Device Detected** -- type="devicedetected"
 * Contains information about a newly detected device. Format:   
 * * identifier -- the identifier of the newly detected device
 *
 * **Device Proximity Changed** -- type="devicedistancechanged"  
 * Contains information about the new proximity of a previously detected device. Format:  
 * * identifier -- the identifier of the device whose distance changed
 * * distance -- the new distance between this device and the other device, in meters
 *
 * **Device Lost** -- type="devicelost"  
 * Contains information about a device that went out of range or can not be detected anymore for other reasons. Format:  
 * * identifier -- the identifier of the lost device
 *
 * @namespace CWNativeCommunicationParser
 */
var CWNativeMasterCommunication = OOP.createSingleton("Connichiwa", "CWNativeMasterCommunication", {

  "public callOnNative": function(methodName) {
    //If we are not running natively, all native method calls are simply ignored
    if (this.isRunningNative() !== true) return;

    //Grab additional arguments passed to this method, but not methodName
    var args = Array.prototype.slice.call(arguments);
    args.shift();

    //Check if the given method is a valid function and invoke it
    //Obviously, this could be used to call any method, but what's the point really?
    var method = window[methodName];
    if (typeof method === "function") {
      method.apply(null, args);
    } else { 
      CWDebug.log(1, "ERROR: Tried to call native method with name " + methodName + ", but it doesn't exist!");
    }
  },


  /**
   * Parses a message from the websocket. If the message is none of the messages described by this class, this method will do nothing. Otherwise the message will trigger an appropiate action.
   *
   * @param {string} message The message from the websocket
   *
   * @memberof CWNativeCommunicationParser
   */
  "public parse": function(message)
  {
    CWDebug.log(4, "Parsing native message (master): " + message);
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "cwdebug":               this._parseDebug(object); break;
      case "connectwebsocket":      this._parseConnectWebsocket(object); break;
      case "localinfo":             this._parseLocalInfo(object); break;
      case "devicedetected":        this._parseDeviceDetected(object); break;
      case "devicedistancechanged": this._parseDeviceDistanceChanged(object); break;
      case "devicelost":            this._parseDeviceLost(object); break;
      case "remoteconnectfailed":   this._parseRemoteConnectFailed(object); break;
      case "remotedisconnected":    this._parseRemoteDisconnected(object); break;
      case "disconnectwebsocket":   this._parseDisconnectWebsocket(object); break;
    }
  },


  _parseDebug: function(message)
  {
    if (message.cwdebug === true) CWDebug.enableDebug();
    else CWDebug.disableDebug();
  },
  
  
  _parseConnectWebsocket: function(message)
  {
    this.package.Connichiwa._connectWebsocket();
  },
  
  
  _parseLocalInfo: function(message)
  {
    var success = CWDeviceManager.createLocalDevice(message);
    if (success)
    {
      this.package.Connichiwa._sendObject(message); //needed so server recognizes us as local weblib
      CWEventManager.trigger("ready");
    }
  },
  
  
  _parseDeviceDetected: function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    
    //We might re-detect a lost device, so it is possible that the device is already stored
    if (device === null)
    {
      device = new CWDevice(message);
      CWDeviceManager.addDevice(device);
    }
    device.discoveryState = CWDeviceDiscoveryState.DISCOVERED;

    CWDebug.log(2, "Detected device: " + device.getIdentifier());
    CWEventManager.trigger("deviceDetected", device);

    //If autoconnect is enabled, the device that launched first will 
    //automatically connect to all other devices
    if (Connichiwa.autoConnect === true) {
      var localDevice = CWDeviceManager.getLocalDevice();
      if (localDevice.getLaunchDate() < device.getLaunchDate()) {
        device.connect();
      }
    } 
  },
  
  
  _parseDeviceDistanceChanged: function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    if (device === null) return;
    
    device.distance = message.distance;
    CWDebug.log(5, "Updated distance of device " + device.getIdentifier() + " to " + device.distance);
    CWEventManager.trigger("deviceDistanceChanged", device);
  },
  
  
  _parseDeviceLost: function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    device.discoveryState = CWDeviceDiscoveryState.LOST;

    CWDebug.log(2, "Lost device: " + device.getIdentifier());
    CWEventManager.trigger("deviceLost", device);
  },
  
  
  _parseRemoteConnectFailed: function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    device.connectionState = CWDeviceConnectionState.DISCONNECTED;

    CWDebug.log(2, "Connection to remote device failed: " + device.getIdentifier());
    CWEventManager.trigger("connectFailed", device);
  },
  
  
  _parseRemoteDisconnected: function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);
    if (device === null) return;
      
    device.connectionState = CWDeviceConnectionState.DISCONNECTED;

    CWDebug.log(2, "Device disconnected: " + device.getIdentifier());
    CWEventManager.trigger("deviceDisconnected", device);
  },
  
  
  _parseDisconnectWebsocket: function(message)
  {
    this.package.Connichiwa._disconnectWebsocket();  
  },
});
/* global OOP, Connichiwa, CWSwipe, CWSystemInfo, CWUtil, CWDevice, CWDeviceManager, CWEventManager, CWDebug */
"use strict";


OOP.extendSingleton("Connichiwa", "CWStitchManager", {
  "private _swipes"  : {},
  "private _devices" : {},


  "public getDeviceTransformation": function(device, forceRecent) {
    if (device === undefined) device = Connichiwa.getIdentifier();
    if (CWDevice.prototype.isPrototypeOf(device)) device = device.getIdentifier();

    if (forceRecent === undefined) forceRecent = false;

    //For ourselves, we need to make sure we return _deviceTransformation, not our
    //entry from this._devices. The reason for this is timing: When the master is
    //stitched, this._devices is updated immediatly, but this._deviceTransformation is
    //updated only after the wasStitched message was received. Since we want to give
    //applications (and CWLocation) time to react to the stitch, we only want to return
    //the new device transformation after wasStitched was received
    //
    //We can use forceRecent to suppress the use of _deviceTransformation and force
    //the most recent data
    if (device === Connichiwa.getIdentifier() && forceRecent !== true) {
      if (this._deviceTransformation === undefined) {
        return this.DEFAULT_DEVICE_TRANSFORMATION();
      }

      return this._deviceTransformation;
    }

    var data = this._getStitchData(device);
    if (data === undefined) return this.DEFAULT_DEVICE_TRANSFORMATION();

    return { 
      width    : data.width,
      height   : data.height, 
      x        : data.transformX, 
      y        : data.transformY,
      rotation : data.rotation,
      scale    : data.scale
    };
  },


  "package detectedSwipe": function(data) {
    var swipe = {
      date         : new Date(),
      device       : data.device,
      edge         : data.edge,
      width        : data.width,
      height       : data.height,
      x            : data.x,
      y            : data.y
    };

    var device = CWDeviceManager.getDeviceWithIdentifier(swipe.device);
    if (device === null || device.isConnected() === false) return;

    CWDebug.log(3, "Detected swipe on " + swipe.device + " on edge " + swipe.edge );

    //Check if the swipe combines with another swipe to a stitch
    for (var key in this._swipes) {
      var savedSwipe = this._swipes[key];

      CWDebug.log(4, "Checking existing swipe: "+key);

      //We can't create a stitch on a single device
      if (savedSwipe.device === swipe.device) continue;

      CWDebug.log(4, "Checking time constraint");

      //If the existing swipe is too old, it is invalid
      if ((swipe.date.getTime() - savedSwipe.date.getTime()) > 1000) continue;

      CWDebug.log(4, "Checking connection constraint");

      //Check if the other device is still connected
      var savedDevice = CWDeviceManager.getDeviceWithIdentifier(savedSwipe.device);
      if (savedDevice === null || savedDevice.isConnected() === false) continue;

      this._detectedStitch(savedSwipe, swipe);
      return;

      //TODO remove the swipes?
    }

    //If the swipe does not seem to be part of a stitch, remember it for later
    this._swipes[swipe.device] = swipe;
  },


  "package unstitchDevice": function(identifier) {
    if (identifier in this._devices) {
      var unstitchMessage = { 
        type                 : "wasunstitched", 
        deviceTransformation : this.getDeviceTransformation(identifier)
      };
      Connichiwa.send(identifier, unstitchMessage);

      delete this._devices[identifier];
      CWDebug.log(3, "Device was unstitched: " + identifier);
    }
  },

  "private _detectedStitch": function(firstSwipe, secondSwipe) {     
    //If no device is stitched yet, we automatically stitch the first device
    //This device will then become the reference and its origin and axis will be the origin
    //and axis of the global coordinate system
    if (Object.keys(this._devices).length === 0) {
      //If one of the devices is the master, make sure we stitch it first
      //Some applications might rely on that, and those that don't are not harmed
      if (secondSwipe.device === Connichiwa.getIdentifier()) {
        var tempSwipe = firstSwipe;
        firstSwipe = secondSwipe;
        secondSwipe = tempSwipe;
      }
      var stitchData = this._createStitchData(firstSwipe.device);
      stitchData.width  = firstSwipe.width;
      stitchData.height = firstSwipe.height;
      this._devices[firstSwipe.device] = stitchData;

      //Send out messages to the stitched device and the master
      CWDebug.log(3, "First device was auto-stitched: "+JSON.stringify(stitchData));
      CWEventManager.trigger("stitch", secondSwipe.device, firstSwipe.device);

      var wasstitchMessage = {
        type                 : "wasstitched",
        otherDevice          : secondSwipe.device,
        edge                 : firstSwipe.edge, //TODO should this be in here? and if so, should it be relative?
        deviceTransformation : this.getDeviceTransformation(firstSwipe.device, true)
      };
      Connichiwa.send(firstSwipe.device, wasstitchMessage);
    }

    CWDebug.log(3, "STITCHING DATA COMING IN");
    CWDebug.log(3, JSON.stringify(firstSwipe));
    CWDebug.log(3, JSON.stringify(secondSwipe));

    //
    // PREPARATION
    // 
    
    //Exactly one of the two swiped devices need to be stitched already
    //We use that device as a reference to calculate the position of the new device
    var firstStitchData  = this._getStitchData(firstSwipe.device);
    var secondStitchData = this._getStitchData(secondSwipe.device);
    if (firstStitchData === undefined && secondStitchData === undefined) return;
    if (firstStitchData !== undefined && secondStitchData !== undefined) return;

    //Determine which device is already stitched
    //From now on, everything prefixed with "stitched" will describe that device,
    //everthing prefixed with "new" describes the device that should be added
    var stitchedSwipe, newSwipe;
    if (firstStitchData !== undefined) {
      stitchedSwipe = firstSwipe;
      newSwipe      = secondSwipe;
    } else {
      stitchedSwipe = secondSwipe;
      newSwipe      = firstSwipe;
    }

    //Grab the CWDevice objects
    var stitchedDevice = CWDeviceManager.getDeviceWithIdentifier(stitchedSwipe.device);
    var newDevice      = CWDeviceManager.getDeviceWithIdentifier(newSwipe.device);

    var stitchedStitchData = this._getStitchData(stitchedSwipe.device);
    var newStitchData      = this._createStitchData(newSwipe.device);

    // CWDebug.log(3, "Stitched Swipe: "+JSON.stringify(stitchedSwipe));
    // CWDebug.log(3, "New Swipe: "+JSON.stringify(newSwipe));
    // CWDebug.log(3, "Stitched Device: "+JSON.stringify(stitchedDevice));

    //Calculate the scaling of the new device relative to the master
    //This compensates for different PPIs on devices - content should appear the
    //same size on all of them
    newStitchData.scale = newDevice.getPPI() / stitchedDevice.getPPI() * stitchedStitchData.scale;

    //Calculate the rotation of the device relative to the master
    //If a device is rotated and the OS detects an orientation change (portrait/landscape)
    //the OS will take care of rotating the webview. But if the orientation
    //is not changed, for example when the device is rotated on the table, we need
    //to take care of translating and rotating ourselves, so the stitched devices
    //get homogenous content
    var rotation = 0;
    var rotationIndex = this._indexForEdge(stitchedSwipe.edge) - this._indexForEdge(newSwipe.edge);
    if (rotationIndex < 0) rotationIndex += 4;
    if (rotationIndex === 2) rotation = 0;
    if (rotationIndex === 3) rotation = 90;
    if (rotationIndex === 1) rotation = 270;
    if (rotationIndex === 0) rotation = 180;
    newStitchData.rotation = (rotation + stitchedStitchData.rotation) % 360; //make relative to master
    // CWDebug.log(3, "Devices edges: "+this._indexForEdge(stitchedSwipe.edge)+", "+this._indexForEdge(newSwipe.edge));

    //
    // RELATIVE SWIPE DATA
    // 
    // Here is where it gets interesting: We need to translate both device's swipes
    // to compensate for their rotation. This way, the x/y and width/height is adjusted
    // as if both devices had a 0º rotation - and only then can we actually calculate
    // with their values in order to determine their relative position.
    // 
    // The calculations are rather straightforward if you think about it, let's
    // take 90º as an example: The y value of a 90º device is the x-axis of a 0º 
    // device. The x value is the y-axis, but swapped: An x value of 0 becomes a large
    // y value, because its at the top of the device (and therefore a bigger y). An
    // x value of "width" therefore becomes a y value of 0.
    // 
    // Note that we also adjust the relative values by the device's scale - this way,
    // both relative swipes are scaled to the master device and are fully comparable.
    // 
    // Also, we rotate the edges: If a device is rotated 90º and the "top" edge is
    // swiped, this physically is the "left" edge (from a user perspective).
    // 
    
    function rotateSwipe(swipe, rotation) {
      var result = {};
      if (rotation === 0) {
        result.y      = swipe.y;
        result.x      = swipe.x;
        result.width  = swipe.width;
        result.height = swipe.height;
      }
      if (rotation === 90) {
        result.y      = swipe.width - swipe.x;
        result.x      = swipe.y;
        result.width  = swipe.height;
        result.height = swipe.width;
      }
      if (rotation === 180) {
        result.y      = swipe.height - swipe.y;
        result.x      = swipe.width  - swipe.x;
        result.width  = swipe.width;
        result.height = swipe.height;
      }
      if (rotation === 270) {
        result.y      = swipe.x;
        result.x      = swipe.height - swipe.y;
        result.width  = swipe.height;
        result.height = swipe.width;
      }

      return result;
    } 
    
    
    var newRelativeSwipe = rotateSwipe(newSwipe, newStitchData.rotation);
    newRelativeSwipe.edge = (this._indexForEdge(newSwipe.edge) + (newStitchData.rotation/90)) % 4;

    newRelativeSwipe.y      /= newStitchData.scale;
    newRelativeSwipe.x      /= newStitchData.scale;
    newRelativeSwipe.width  /= newStitchData.scale;
    newRelativeSwipe.height /= newStitchData.scale;

    //
    // And the same thing for the stitched device
    //
    
    var stitchedRelativeSwipe = rotateSwipe(stitchedSwipe, stitchedStitchData.rotation);
    stitchedRelativeSwipe.edge = (this._indexForEdge(stitchedSwipe.edge) + (stitchedStitchData.rotation/90)) % 4;

    stitchedRelativeSwipe.y      /= stitchedStitchData.scale;
    stitchedRelativeSwipe.x      /= stitchedStitchData.scale;
    stitchedRelativeSwipe.width  /= stitchedStitchData.scale;
    stitchedRelativeSwipe.height /= stitchedStitchData.scale;

    //
    // DETERMINE THE NEW STITCH DATA
    // 
    // Now we have everything we need and can actually determine the stitch data
    // of the new device: This means we can calculate its translation relative to
    // the origin of the master and its adjusted (relative and scaled) width and height
    // This is the data that will be sent to the device and that the device can use
    // to transform its content
    // 

    //Make sure the stitch data contains original and relative width/height
    newStitchData.width        = newRelativeSwipe.width;
    newStitchData.height       = newRelativeSwipe.height;
    newStitchData.deviceWidth  = newSwipe.width;
    newStitchData.deviceHeight = newSwipe.height;

    //Finally, what we actually wanted all along: The translation now becomes a
    //simple matter of calculating the relative position between the "stitched"
    //and the "new" device. It should, we worked goddamn hard for that!
    newStitchData.transformX = stitchedStitchData.transformX + stitchedRelativeSwipe.x - newRelativeSwipe.x;
    newStitchData.transformY = stitchedStitchData.transformY + stitchedRelativeSwipe.y - newRelativeSwipe.y;

    // CWDebug.log(3, "Stitched Data: "+JSON.stringify(stitchedStitchData));
    // CWDebug.log(3, "New Data: "+JSON.stringify(newStitchData));
    // CWDebug.log(3, "Stitched Relative Swipe: "+JSON.stringify(stitchedRelativeSwipe));
    // CWDebug.log(3, "New Relative Swipe: "+JSON.stringify(newRelativeSwipe));
    
    //Finish it up: Add the device to the stitched data array and send messages
    //to the master ("stitch"), the new device ("wasstitched") and the 
    //other device ("gotstitchneighbor")
    this._devices[newSwipe.device] = newStitchData;

    CWDebug.log(3, "Device was stitched: "+JSON.stringify(newStitchData));
    CWEventManager.trigger("stitch", stitchedSwipe.device, newSwipe.device);

    var wasstitchMessage = {
      type                 : "wasstitched",
      otherDevice          : stitchedSwipe.device,
      edge                 : newSwipe.edge, //TODO should this be in here? and if so, should it be relative?
      deviceTransformation : this.getDeviceTransformation(newSwipe.device, true)
    };
    newDevice.send(wasstitchMessage);

    var gotneighborMessage = {
      type                 : "gotstitchneighbor",
      otherDevice          : newSwipe.device,
      edge                 : stitchedSwipe.edge, //TODO should this be in here? and if so, should it be relative?
    };
    stitchedDevice.send(gotneighborMessage);
  },


  "private _createStitchData": function(device) {
    return {
      device     : device,
      width      : 0,
      height     : 0,
      transformX : 0,
      transformY : 0,
      rotation   : 0,
      scale      : 1.0,
    };
  },


  "private _getStitchData": function(device) {
    if (CWDevice.prototype.isPrototypeOf(device)) device = device.getIdentifier();
    return this._devices[device];
  },


  "private _coordinateForEdge": function(edge, point) {
    var axis = this._axisForEdge(edge);
    if (axis === null) return null;

    return point[axis];
  },


  "private _axisForEdge": function(edge) {
    if (edge === "left" || edge === "right") return "y";
    if (edge === "top" || edge === "bottom") return "x";

    return null;
  },


  "private _invertAxis": function(axis) {
    if (axis === "x") return "y";
    if (axis === "y") return "x";

    return null;
  },


  "private _oppositeEdge": function(edge) {
    switch (edge) {
      case "top":    return "bottom"; 
      case "bottom": return "top";
      case "left":   return "right";
      case "right":  return "left";
    }

    return "invalid";
  },

  "private _indexForEdge": function(edge) {
    switch (edge) {
      case "top":    return 0;
      case "bottom": return 2;
      case "left":   return 1;
      case "right":  return 3;
    }

    return -1;
  },

  "private _edgeForIndex": function(index) {
    switch (index) {
      case 0: return "top";
      case 2: return "bottom";
      case 3: return "right";
      case 1: return "left";
    }

    return "invalid";
  }
});
/* global OOP, Connichiwa, CWEventManager, CWDeviceManager, CWDevice, CWDeviceConnectionState, CWDebug */
/* global nativeCallRemoteDidConnect */
"use strict";


OOP.extendSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parseOnMaster": function(message) {
    switch (message.type) {
      case "remoteinfo"  :  this._parseRemoteInfo(message);  break;
      case "stitchswipe" :  this._parseStitchSwipe(message); break;
      case "quitstitch"  :  this._parseQuitStitch(message);  break;
    }
  },


  _parseRemoteInfo: function(message)
  {
    var device = CWDeviceManager.getDeviceWithIdentifier(message.identifier);

    //If we have a non-native remote no device might exist since
    //no info was sent via BT. If so, create one now.
    if (device === null) {
      device = new CWDevice(message); 
      CWDeviceManager.addDevice(device);
    } else {
      //TODO although unnecessary, for cleanness sake we should probably
      //overwrite any existing device data with the newly received data?
      //If a device exists, that data should be the same as the one we received
      //via BT anyways, so it shouldn't matter
      CWDebug.log(1, "TODO");
    }
    
    device.connectionState = CWDeviceConnectionState.CONNECTED;
    nativeCallRemoteDidConnect(device.getIdentifier());
    
    var connectedCallback = function() { 
      CWEventManager.trigger("deviceConnected", device); 
    };
    
    if (Connichiwa.autoLoadScripts.length > 0) {
      for (var i = 0; i < Connichiwa.autoLoadScripts.length ; i++) {
        var script = Connichiwa.autoLoadScripts[i];
        if (i === (Connichiwa.autoLoadScripts.length - 1)) {
          device.loadScript(script, connectedCallback);
        } else {
          device.loadScript(script);
        }
      }
    } else {
      connectedCallback();
    }
  },


  _parseStitchSwipe: function(message) {
    this.package.CWStitchManager.detectedSwipe(message);
  },


  _parseQuitStitch: function(message) {
    this.package.CWStitchManager.unstitchDevice(message.device);
  },
});
/* global OOP, CWDebug, CWWebsocketMessageParser, CWEventManager, CWUtil, CWDeviceManager */
/* global CONNECTING, OPEN */
/* global nativeCallWebsocketDidOpen, nativeCallWebsocketDidClose */
"use strict";


OOP.extendSingleton("Connichiwa", "Connichiwa", {
  "private _connectionAttempts" : 0,
  "public autoConnect": false,
  "public autoLoadScripts": [],


  // PUBLIC API
  

  "public getIdentifier": function() 
  {
    var localDevice = CWDeviceManager.getLocalDevice();
    if (localDevice === undefined) return undefined;

    return localDevice.getIdentifier();
  },
  

  "public isMaster": function() {
    return true;
  },


  // WEBSOCKET


  "package _connectWebsocket": function()
  {
    if (this._websocket !== undefined && (this._websocket.state === CONNECTING || this._websocket.state === OPEN)) {
      return;
    }

    this._cleanupWebsocket();

    CWDebug.log(3, "Connecting websocket");

    this._websocket           = new WebSocket("ws://127.0.0.1:8001");
    this._websocket.onopen    = this._onWebsocketOpen;
    this._websocket.onmessage = this._onWebsocketMessage;
    this._websocket.onclose   = this._onWebsocketClose;
    this._websocket.onerror   = this._onWebsocketError;

    this._connectionAttempts++;
  },


  _onWebsocketOpen: function()
  {
    CWDebug.log(3, "Websocket opened");
    nativeCallWebsocketDidOpen();
    this._connectionAttempts = 0;
  },


  _onWebsocketMessage: function(e)
  {
    var message = JSON.parse(e.data);
    CWDebug.log(4, "Received message: " + e.data);
    
    //It seems that reacting immediatly to a websocket message
    //sometimes causes crashes in UIWebView. I am unsure why.
    //We use requestAnimationFrame in an attempt to prevent those crashes
    var that = this;
    window.requestAnimationFrame(function() {
      that.package.CWWebsocketMessageParser.parse(message);
      that.package.CWWebsocketMessageParser.parseOnMaster(message);

      if (message.type) CWEventManager.trigger("message" + message.type, message);
    });
  },


  _onWebsocketClose: function()
  {
    CWDebug.log(3, "Websocket closed");
    this._cleanupWebsocket();

    if (this._connectionAttempts >= 5)
    {
      //Give up, guess we are fucked
      nativeCallWebsocketDidClose();
      return;
    }

    //We can't allow this blashphemy! Try to reconnect!
    setTimeout(function() { this._connectWebsocket(); }, this._connectionAttempts * 1000);
  },


  _onWebsocketError: function()
  {
    this._onWebsocketClose();
  },
});
