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
/* global OOP, CWDebug */
"use strict";



//TODO refactor into common, remote, master parts
//rename to CWNativeBridge or something like that
var CWNativeRemoteCommunication = OOP.createSingleton("Connichiwa", "CWNativeRemoteCommunication", 
{
  _runsNative: false,


  __constructor: function() {
    if (window.RUN_BY_CONNICHIWA_NATIVE === true) {
      this._runsNative = true;
    }
  },


  "public isRunningNative": function() {
    return (this._runsNative === true);
  },


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


  "public parse": function(message)
  {
    CWDebug.log(4, "Parsing native message (remote): " + message);
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "runsnative":          this._parseRunsNative(object); break;
      case "connectwebsocket":    this._parseConnectWebsocket(object); break;
      case "cwdebug":             this._parseDebug(object); break;
      case "localinfo":           this._parseLocalInfo(object); break;
      case "disconnectwebsocket": this._parseDisconnectWebsocket(object); break;
    }
  },


  _parseRunsNative: function(message) {
    CWDebug.log(1, "RUNS NATIVE SET TO "+JSON.stringify(message));
    this._runsNative = true;
  },


  _parseConnectWebsocket: function(message)
  {
    this.package.Connichiwa._connectWebsocket();
  },


  _parseDebug: function(message)
  {
    CWDebug.enableDebug();
  },


  _parseLocalInfo: function(message) 
  {
    this.package.Connichiwa._setLocalDevice(message);
    //this.package.Connichiwa._setIdentifier(message.identifier);
  },


  _parseDisconnectWebsocket: function(message)
  {
    this.package.Connichiwa._disconnectWebsocket();  
  },
});
/* global OOP, CWEventManager */
"use strict";


OOP.extendSingleton("Connichiwa", "CWWebsocketMessageParser", 
{
  "package parseOnRemote": function(message) {
    switch (message.type) {
      case "softdisconnect" : this._parseSoftDisconnect(message); break;
    }
  },


  _parseSoftDisconnect: function(message) {
    this.package.Connichiwa._softDisconnectWebsocket();
  },
});
/* global OOP, CWWebsocketMessageParser, CWDevice, CWSystemInfo, CWUtil, CWDebug, CWMasterCommunication, CWNativeRemoteCommunication, CWEventManager */
"use strict";


OOP.extendSingleton("Connichiwa", "Connichiwa", {
  "private _localDevice"      : undefined,
  "private _softDisconnected" : false,
  "private _isReconnecting"   : false,


  __constructor: function() {
    //If no native layer runs in the background, we have to take care of 
    //establishing a connection ourselves
    var runsNative = this.package.CWNativeRemoteCommunication.isRunningNative();
    if (runsNative !== true) this._connectWebsocket();

    CWEventManager.trigger("ready"); //trigger ready asap on remotes
  },


  "public getIdentifier": function() 
  {
    return this._localDevice.getIdentifier();
  },


  "public isMaster": function() {
    return false;
  },


  "package _setLocalDevice": function(properties) {
    if (this._localDevice === undefined) {
      this._localDevice = new CWDevice(properties);
    }

    //Let the master know about our new device information
    properties.type = "remoteinfo";
    this.send(properties);
  },


  "package _connectWebsocket": function()
  {
    CWDebug.log(3, "Connecting");
    //If we replace the websocket (or re-connect) we don't want to call onWebsocketClose
    //Therefore, first cleanup, then close
    var oldWebsocket = this._websocket;
    this._cleanupWebsocket();    
    if (oldWebsocket !== undefined) oldWebsocket.close();

    var parsedURL = new CWUtil.parseURL(document.URL);

    this._websocket           = new WebSocket("ws://" + parsedURL.hostname + ":" + (parseInt(parsedURL.port) + 1));
    this._websocket.onopen    = this._onWebsocketOpen;
    this._websocket.onmessage = this._onWebsocketMessage;
    this._websocket.onclose   = this._onWebsocketClose;
    this._websocket.onerror   = this._onWebsocketError;
  },


  _softDisconnectWebsocket: function()
  {
    this._softDisconnected = true;
    // nativeSoftDisconnect();
    CWNativeRemoteCommunication.callOnNative("nativeSoftDisconnect");
  },


  _onWebsocketOpen: function()
  {
    CWDebug.log(3, "Websocket opened");
    this._softDisconnected = false;

    var runsNative = this.package.CWNativeRemoteCommunication.isRunningNative();

    CWNativeRemoteCommunication.callOnNative("nativeWebsocketDidOpen");

    if (runsNative === false) {
      //If we have no native layer and are reconnecting we now need to refresh the
      //page to reset the remote's state
      if (this._isReconnecting === true) {
        location.reload(true);
        return;
      }

      //We have no native layer that delivers us accurate local device info
      //Therefore, we create as much info as we can ourselves
      var localInfo = {
        identifier : CWUtil.createUUID(),
        launchDate : Date.now() / 1000.0,
        ppi        : CWSystemInfo.PPI()
      };
      this._setLocalDevice(localInfo);
    }
  },


  _onWebsocketMessage: function(e)
  {
    var message = JSON.parse(e.data);
    CWDebug.log(4, "Received message: " + e.data);

    //It seems that reacting immediatly to a websocket message
    //sometimes causes crashes in Safari. I am unsure why.
    //We use requestAnimationFrame in an attempt to prevent those crashes
    var that = this;
    window.requestAnimationFrame(function() {
      that.package.CWWebsocketMessageParser.parse(message);
      that.package.CWWebsocketMessageParser.parseOnRemote(message);

      if (message.type) CWEventManager.trigger("message" + message.type, message);
    });
  },


  _onWebsocketClose: function()
  {
    CWDebug.log(3, "Websocket closed");
    this._cleanupWebsocket();
    // nativeWebsocketDidClose();
    CWNativeRemoteCommunication.callOnNative("nativeWebsocketDidClose");

    var runsNative = this.package.CWNativeRemoteCommunication.isRunningNative();

    //If we are running natively, the remote webview will be cleared and a connection
    //can be reestablished over Bluetooth. If we are running native-less we
    //try to reconnect to the master
    if (runsNative === false) {
      // this._tryWebsocketReconnect();
      window.setTimeout(this._tryWebsocketReconnect, 5000);
    }
  },


  _onWebsocketError: function()
  {
    CWDebug.log(3, "Error");
    this._onWebsocketClose();
  },

  _tryWebsocketReconnect: function() {
    if (this._websocket !== undefined && 
       (this._websocket.readyState === WebSocket.OPEN || this._websocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._isReconnecting = true;

    // if (this._websocket !== undefined && this._websocket.readyState === WebSocket.CONNECTING) {
    //   window.setTimeout(this._tryWebsocketReconnect(), 1000);
    //   return;
    // }


    CWDebug.log(3, "Try reconnect");
    this._connectWebsocket();
    // window.setTimeout(this._tryWebsocketReconnect, 5000);
  }
});
