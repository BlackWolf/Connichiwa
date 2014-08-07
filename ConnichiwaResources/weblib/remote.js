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
    if (theClass.private.__constructor) {
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
  var _name = "unknown";
  var _ppi = CWSystemInfo.DEFAULT_PPI();
  var _isLocal = false; 

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


CWDevice.prototype.connect = function()
{
  if (this.canBeConnected() === false) return;

  this.connectionState = CWDeviceConnectionState.CONNECTING;
  nativeCallConnectRemote(this.getIdentifier());
};


CWDevice.prototype.send = function(messageObject)
{
  Connichiwa.send(this.getIdentifier(), messageObject);
  // messageObject.target = this.getIdentifier();
  // Connichiwa._sendObject(messageObject);
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
/* global CWDebug */
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
  var _events = {};

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

    if (!_events[event]) _events[event] = [];
    _events[event].push(callback);
    CWDebug.log(3, "Attached callback to " + event);
  };

  /**
   * Triggers the given events, calling all callback functions that have registered for the event.
   *
   * @param {string} event The name of the event to trigger
   *
   * @memberof CWEventManager
   */
  var trigger = function(event)
  {
    if (!_events[event]) { 
      CWDebug.log(5, "No callbacks  for " + event + " registered"); 
      return; 
    }

    //Get all arguments passed to trigger() and remove the event argument
    var args = Array.prototype.slice.call(arguments);
    args.shift();

    CWDebug.log(4, "Triggering event " + event + " for "+_events[event].length + " callbacks");
    for (var i = 0; i < _events[event].length; i++)
    {
      var callback = _events[event][i];
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
/* global OOP, gyro, CWEventManager, CWDebug */
"use strict";



var CWGyroscope = OOP.createSingleton("Connichiwa", "CWGyroscope", {
  _lastMeasure: undefined,

  __constructor: function() {
    gyro.frequency = 500;

    // var that = this;
    gyro.startTracking(this._onUpdate);
  },

  "private _onUpdate": function(o) {
    if (this._lastMeasure === undefined) this._lastMeasure = o;

    CWDebug.log(1, o.beta);
    
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
    CWEventManager.trigger("gyroscopeUpdate", gyroData);

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
    CWEventManager.trigger("accelerometerUpdate", accelData);

    //We need to copy the values of o because o will be altered by gyro
    this._lastMeasure = { x: o.x, y: o.y, z: o.z, alpha: o.alpha, beta: o.beta, gamma: o.gamma };
  }
});
/* global OOP, Connichiwa, CWEventManager */
"use strict";


 
var CWPinchManager = OOP.createSingleton("Connichiwa", "CWPinchManager", {
  "private _isPinched": false,
  "private _deviceTransformation": { x: 0, y: 0, scale: 1.0 },


  __constructor: function() {
    Connichiwa.onMessage("wasPinched", this._onWasPinched);
    Connichiwa.onMessage("wasUnpinched", this._onWasUnpinched);
    CWEventManager.register("pinchswipe", this._onLocalSwipe);
  },


  _onWasPinched: function(message) {
    this._deviceTransformation = message.deviceTransformation;
    this._isPinched = true;

    CWEventManager.register("gyroscopeUpdate", this._onGyroUpdate);
  },


  _onWasUnpinched: function(message) {
    this._deviceTransformation = { x: 0, y: 0, scale: 1.0 };
    this._isPinched = false;

    //TODO unregister from gyroscopeUpdate
  },


  _onLocalSwipe: function(swipeData) {
    if (this.isPinched()) return;

    //Prepare for the master and send away
    swipeData.type   = "pinchswipe";
    swipeData.device = Connichiwa.getIdentifier();
    swipeData.width  = screen.availWidth;
    swipeData.height = screen.availHeight;
    Connichiwa.send(swipeData);
  },


  _onGyroUpdate: function(gyroData) {
    if (gyroData.beta > 20) {
      var data = {
        type   : "didQuitPinch",
        device : Connichiwa.getIdentifier()
      };
      Connichiwa.send(data);
    }
  },


  "public isPinched": function() {
    return this._isPinched;
  },


  "public getDeviceTransformation": function() {
    return this._deviceTransformation;
  },
});
/* global OOP */
"use strict";



var CWSystemInfo = OOP.createSingleton("Connichiwa", "CWSystemInfo", {
  _ppi : undefined,


  "public PPI": function() {
    if (this._ppi !== undefined) return this._ppi;

    this._ppi = this.DEFAULT_PPI();

    // if (navigator.platform === "iPad") {
    //   if (window.devicePixelRatio > 1) this._ppi = 264;
    //   else this._ppi = 132;
    // }

    // if (navigator.platform === "iPhone" || navigator.platform === "iPod") {
    //   if (window.devicePixelRatio > 1) this._ppi = 326;
    //   else this._ppi = 264;
    // }
     
    if (navigator.platform === "iPad") {
      //TODO usually we would distinguish iPad Mini's (163dpi)
      //but we can't, so we return normal iPad DPI
      this._ppi = 132;
    }

    if (navigator.platform === "iPhone" || navigator.platform === "iPod") {
      this._ppi = 163;
    }

    return this._ppi;
  },

  "public DEFAULT_PPI": function() {
    return 96;
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
    isInt            : isInt,
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


/* global OOP, CWEventManager, CWDebug */
"use strict";



var Connichiwa = OOP.createSingleton("Connichiwa", "Connichiwa", {
  "private _websocket"  : undefined,


  "public getIdentifier": function() 
  {
    //ABSTRACT, OVERWRITE IN SUBCLASSES
  },


  "public send": function(identifier, messageObject) {
    //ABSTRACT, OVERWRITE IN SUBCLASSES
  },


  "public broadcast": function(messageObject) {
    //ABSTRACT, OVERWRITE IN SUBCLASSES
  },


  "public isMaster": function() {
    //ABSTRACT, OVERWRITE IN SUBCLASSES
  },


  "public onMessage": function(type, callback) {
    CWEventManager.register("message" + type, callback);
  },


  "package _disconnectWebsocket": function()
  {
    this._websocket.close();
  },

  "package _sendObject": function(messageObject)
  {
    this._send(JSON.stringify(messageObject));
  },


  "package _send": function(message) {
    CWDebug.log(4, "Sending message: " + message);
    this._websocket.send(message);
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
/* global OOP, Connichiwa, CWEventManager, CWDebug */
"use strict";



var CWMasterCommunication = OOP.createSingleton("Connichiwa", "CWMasterCommunication", 
{
  "public parse": function(message)
  {
    if (message.type === "softdisconnect")
    {
      this.package.Connichiwa._softDisconnectWebsocket();
    }

    if (message.type === "show")
    {
      $("body").append(message.content);
    }

    if (message.type === "update")
    {
      $(message.element).html(message.content);
    }

    if (message.type === "beginPath")
    {
      var context = $(message.element)[0].getContext("2d");
      context.beginPath();
      context.moveTo(message.coords.x, message.coords.y);
    }

    if (message.type === "updatePath")
    {
      var context = $(message.element)[0].getContext("2d");
      context.lineTo(message.coords.x, message.coords.y);
      context.stroke();
    }

    if (message.type === "endPath")
    {
      var context = $(message.element)[0].getContext("2d");
      context.closePath();
    }
    
    if (message.type === "loadScript")
    {
      CWDebug.log(1, "LOADING SCRIPT "+message.url);
      $.getScript(message.url)
        .done(function() {
          CWDebug.log(1, "SCRIPT WAS LOADED");
          //TODO check for AJAX errors n stuff
          var message = {
            type    : "scriptLoaded",
            request : message
          };
          Connichiwa.send(message);
        })
        .fail(function(f, s, t) {
          CWDebug.log(1, "SCRIPT LOAD FAILED HARD: "+t);
        });
    }

    // if (message.type === "wasPinched") {
    //   CWEventManager.trigger("wasPinched", message);
    // }
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
/* global OOP, CWSystemInfo, CWUtil, CWDebug, CWMasterCommunication, CWNativeRemoteCommunication, CWEventManager */
/* global runsNative */
"use strict";


OOP.extendSingleton("Connichiwa", "Connichiwa", {
  "private _localDevice"      : undefined,
  "private _softDisconnected" : false,


  __constructor: function() {
    if (window.RUN_BY_CONNICHIWA_NATIVE !== true) {
      this._connectWebsocket();
    }
    CWEventManager.trigger("ready"); //trigger ready asap on remotes
  },


  "public getIdentifier": function() 
  {
    return this._localDevice.getIdentifier();
  },


  "public isMaster": function() {
    return false;
  },


  "public send": function(identifier, messageObject) {
    if (identifier === "broadcast") {
      this.broadcast(messageObject);
      return;
    }

    if (messageObject === undefined) {
      messageObject = identifier;
      identifier = undefined;
      messageObject.source = this.getIdentifier();
      messageObject.target = "master";
      this._sendObject(messageObject);
      return;
    }

    messageObject.source = this.getIdentifier();
    messageObject.target = identifier;
    this._sendObject(messageObject);
  },


  "public broadcast": function(messageObject) 
  {
    messageObject.source = this.getIdentifier();
    messageObject.target = "broadcast";
    this._sendObject(messageObject);
  },


  // "package _setIdentifier": function(value) 
  // {
  //   if (this._identifier !== undefined) return false;

  //   this._identifier = value;
  //   CWDebug.log(2, "Identifier set to " + this._identifier);

  //   //Pass the new identifier to the master device
  //   var data = { type: "remoteidentifier", identifier: this._identifier };
  //   this.send(data);

  //   return true;
  // },


  "package _setLocalDevice": function(properties) {
    if (this._localDevice !== undefined) return;

    this._localDevice = new CWDevice(properties);

    //var data = { type: "remoteinfo", };
    properties.type = "remoteinfo";
    this.send(properties);
  },


  "package _connectWebsocket": function()
  {
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
    if (runsNative === true) {
      // nativeWebsocketDidOpen();
      CWNativeRemoteCommunication.callOnNative("nativeWebsocketDidOpen");
    } else {
      //We have no native layer that delivers us accurate local device info
      //Therefore, we create as much info as we can ourselves
      var localInfo = {
        identifier : CWUtil.createUUID(),
        ppi        : CWSystemInfo.PPI()
      };
      this._setLocalDevice(localInfo);
      // this._setIdentifier(CWUtil.createUUID());
    }
  },


  _onWebsocketMessage: function(e)
  {
    var message = JSON.parse(e.data);
    CWDebug.log(4, "Received message: " + e.data);

    //It seems that reacting immediatly to a websocket message
    //sometimes causes crashes in Safari. I am unsure why.
    //We use requestAnimationFrame in an attempt to prevent those crashes
    window.requestAnimationFrame(function() {
      CWMasterCommunication.parse(message);
      if (message.type) CWEventManager.trigger("message" + message.type, message);
    });
  },


  _onWebsocketClose: function()
  {
    CWDebug.log(3, "Websocket closed");
    this._cleanupWebsocket();
    // nativeWebsocketDidClose();
    CWNativeRemoteCommunication.callOnNative("nativeWebsocketDidClose");
  },


  _onWebsocketError: function()
  {
    this._onWebsocketClose();
  }
});
