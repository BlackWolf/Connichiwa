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

      //We can't create a stitch on a single device
      if (savedSwipe.device === swipe.device) continue;

      //If the existing swipe is too old, it is invalid
      if ((swipe.date.getTime() - savedSwipe.date.getTime()) > 1000) continue;

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
