/* global OOP, Connichiwa, CWSwipe, CWSystemInfo, CWUtil, CWDevice, CWDeviceManager, CWEventManager, CWDebug */
"use strict";


OOP.extendSingleton("Connichiwa", "CWStitchManager", {
  "private _swipes"  : {},
  "private _devices" : {},


  "public getDeviceTransformation": function(device) {
    if (device === undefined) device = CWDeviceManager.getLocalDevice();

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

  // "public toMasterCoordinates": function(dcoords, device) {
  //   if (device === undefined) return { x: dcoords.x, y: dcoords.y };

  //   //
  //   //TODO
  //   //Code duplication from common/CWStitchManager
  //   //
    
  //   var transformation = this.getDeviceTransformation(device);

  //   var x = dcoords.x;
  //   var y = dcoords.y;
  //   if (transformation.rotation === 180) {
  //     x = transformation.width  - x;
  //     y = transformation.height - y;
  //   }

  //   x += transformation.x;
  //   y += transformation.y;

  //   return { x: x, y: y };
  // },
  // 
  
  //
  //TODO
  //I think we should do it this way:
  //Having a CWSwipe is a good thing, because we want the original swipe data and the
  //rotated swipe data in a common place for easy and understandable access
  //
  //To do that, we just add a .setRotation() method to CWSwipe. Setting the rotation
  //also recalculates things like edge, width, height, x, y
  //
  //Furthermore .setTransformation() and .setScale() allow us to bundle those values
  //with the object. .setScale furthermore recalculated width, height a.s.o.
  //
  //I suppose this way we should be able to bundle everything nicely, and I don't
  //think the user needs direct access. A method like CWStitchManager.toMasterCoordinates
  //or something like that (the name sucks - maybe .translate()?) can use the 
  //local CWSwipe to do the calculations. 
  //
  //We need to think about which values to pass to wasStitched, though. Passing
  //the rotated values makes more sense (because we need them) I suppose
  //


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
      CWDebug.log(3, "Device was unstitched: "+identifier);
      delete this._devices[identifier];

      var unstitchMessage = { type : "wasunstitched" };
      Connichiwa.send(identifier, unstitchMessage);

      //If only one device remains, we also unstitch it. 
      var length = Object.keys(this._devices).length;
      if (length === 1) {
        for (var key in this._devices) {
          this.unstitchDevice(key);
        }
      }
    }
  },

  "private _detectedStitch": function(firstSwipe, secondSwipe) {
    //If no device was stitched yet, automatically add the master (us) as a reference
    if (Object.keys(this._devices).length === 0) {
      var localDevice = CWDeviceManager.getLocalDevice();
      var stitchData = this._createStitchData(localDevice.getIdentifier());
      stitchData.width  = CWSystemInfo.viewportWidth();
      stitchData.height = CWSystemInfo.viewportHeight();
      this._devices[localDevice.getIdentifier()] = stitchData;
      this._isStitched = true;
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

    CWDebug.log(3, "Stitched Swipe: "+JSON.stringify(stitchedSwipe));
    CWDebug.log(3, "New Swipe: "+JSON.stringify(newSwipe));
    CWDebug.log(3, "Stitched Device: "+JSON.stringify(stitchedDevice));

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
    CWDebug.log(3, "Devices edges: "+this._indexForEdge(stitchedSwipe.edge)+", "+this._indexForEdge(newSwipe.edge));

    //
    // RELATIVE SWIPE DATA
    // 
    // Here is where it gets interesting: We need to translate both device's swipes
    // to compensate for their rotation. This way, the x/y and width/height is adjusted
    // as if both devices had a 0º rotation - and only then can we actually calculate
    // with their values in order to determine their relative position.
    // 
    // The calculations are rather straightforward if you think about it hard, let's
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
    
    var newRelativeSwipe = {};

    newRelativeSwipe.edge = (this._indexForEdge(newSwipe.edge) + (newStitchData.rotation/90)) % 4;

    if (newStitchData.rotation === 0) {
      newRelativeSwipe.y      = newSwipe.y;
      newRelativeSwipe.x      = newSwipe.x;
      newRelativeSwipe.width  = newSwipe.width;
      newRelativeSwipe.height = newSwipe.height;
    }
    if (newStitchData.rotation === 90) {
      newRelativeSwipe.y      = newSwipe.width - newSwipe.x;
      newRelativeSwipe.x      = newSwipe.y;
      newRelativeSwipe.width  = newSwipe.height;
      newRelativeSwipe.height = newSwipe.width;
    }
    if (newStitchData.rotation === 180) {
      newRelativeSwipe.y      = newSwipe.height - newSwipe.y;
      newRelativeSwipe.x      = newSwipe.width  - newSwipe.x;
      newRelativeSwipe.width  = newSwipe.width;
      newRelativeSwipe.height = newSwipe.height;
    }
    if (newStitchData.rotation === 270) {
      newRelativeSwipe.y      = newSwipe.x;
      newRelativeSwipe.x      = newSwipe.height - newSwipe.y;
      newRelativeSwipe.width  = newSwipe.height;
      newRelativeSwipe.height = newSwipe.width;
    }

    newRelativeSwipe.y      /= newStitchData.scale;
    newRelativeSwipe.x      /= newStitchData.scale;
    newRelativeSwipe.width  /= newStitchData.scale;
    newRelativeSwipe.height /= newStitchData.scale;

    //
    // And the same thing for the stitched device
    //
    
    var stitchedRelativeSwipe = {};

    stitchedRelativeSwipe.edge = (this._indexForEdge(stitchedSwipe.edge) + (stitchedStitchData.rotation/90)) % 4;

    if (stitchedStitchData.rotation === 0) {
      stitchedRelativeSwipe.y      = stitchedSwipe.y;
      stitchedRelativeSwipe.x      = stitchedSwipe.x;
      stitchedRelativeSwipe.width  = stitchedSwipe.width;
      stitchedRelativeSwipe.height = stitchedSwipe.height;
    }
    if (stitchedStitchData.rotation === 90) {
      stitchedRelativeSwipe.y      = stitchedSwipe.width - stitchedSwipe.x;
      stitchedRelativeSwipe.x      = stitchedSwipe.y;
      stitchedRelativeSwipe.width  = stitchedSwipe.height;
      stitchedRelativeSwipe.height = stitchedSwipe.width;
    }
    if (stitchedStitchData.rotation === 180) {
      stitchedRelativeSwipe.y      = stitchedSwipe.height - stitchedSwipe.y;
      stitchedRelativeSwipe.x      = stitchedSwipe.width  - stitchedSwipe.x;
      stitchedRelativeSwipe.width  = stitchedSwipe.width;
      stitchedRelativeSwipe.height = stitchedSwipe.height;
    }
    if (stitchedStitchData.rotation === 270) {
      stitchedRelativeSwipe.y      = stitchedSwipe.x;
      stitchedRelativeSwipe.x      = stitchedSwipe.height - stitchedSwipe.y;
      stitchedRelativeSwipe.width  = stitchedSwipe.height;
      stitchedRelativeSwipe.height = stitchedSwipe.width;
    }

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
    //to the master ("stitch") and the new device ("wasstitched")
    this._devices[newSwipe.device] = newStitchData;

    CWDebug.log(3, "Device was stitched: "+JSON.stringify(newStitchData));
    CWEventManager.trigger("stitch", stitchedSwipe.device, newSwipe.device);

    var wasstitchMessage = {
      type                 : "wasstitched",
      otherDevice          : stitchedSwipe.device,
      edge                 : newSwipe.edge, //TODO should this be in here? and if so, should it be relative?
      deviceTransformation : this.getDeviceTransformation(newSwipe.device)
    };
    newDevice.send(wasstitchMessage);

    var gotneighborMessage = {
      type                 : "gotstitchneighbor",
      otherDevice          : newSwipe.device,
      edge                 : stitchedSwipe.edge, //TODO should this be in here? and if so, should it be relative?
    };
    stitchedDevice.send(gotneighborMessage);
  },


  // "private _detectedStitch": function(firstSwipe, secondSwipe) {
  //   //Automatically add the master device (us) as the first stitched device
  //   if (Object.keys(this._devices).length === 0) {
  //     var localDevice = CWDeviceManager.getLocalDevice();
  //     var localData = { width: CWSystemInfo.viewportWidth(), height: CWSystemInfo.viewportHeight() };
  //     this._devices[localDevice.getIdentifier()] = this._createNewStitchData(localDevice, localData);
  //     this._isStitched = true;
  //   }

  //   //Exactly one of the two devices needs to be stitched already
  //   //We need this so we can calculate the position of the new device
  //   var firstStitchedDevice = this._getStitchedDevice(firstDevice);
  //   var secondStitchedDevice = this._getStitchedDevice(secondDevice);
  //   if (firstStitchedDevice === undefined && secondStitchedDevice === undefined) return;
  //   if (firstStitchedDevice !== undefined && secondStitchedDevice !== undefined) return;

  //   var stitchedDevice, newDevice, stitchedData, newData;
  //   if (firstStitchedDevice !== undefined) {
  //     stitchedDevice = firstStitchedDevice;
  //     stitchedData = firstData;
  //     newDevice = secondDevice;
  //     newData = secondData;
  //   } else {
  //     stitchedDevice = secondStitchedDevice;
  //     stitchedData = secondData;
  //     newDevice = firstDevice;
  //     newData = firstData;
  //   }

  //   //Add the devices to each others neighbors at the relative positions
  //   //Furthermore, create the stitch data for the new device, including the
  //   //position relative to the master device
  //   stitchedDevice[stitchedData.edge][newDevice.getIdentifier()] = this._coordinateForEdge(stitchedData.edge, stitchedData);

  //   var newStitchDevice = this._createNewStitchData(newDevice, newData);
  //   newStitchDevice[newData.edge][stitchedDevice.device.getIdentifier()] = this._coordinateForEdge(newData.edge, newData);

  //   //Calculate the transformation of the new device based on the transformation of the stitched device and the pinched edge
  //   //We also need to take care of differnet PPIs by performing a scaling:
  //   //The scale of the new device is calculated so that using that scale content appears the same size as on the master device
  //   //Dividing coordinates of any device by the devices scale will transform the coordinates into global coordinates
  //   //To be exact, global coordinates are coordinates in the PPI of the master device
  //   //transformX and transformY are calculated in a way that they result in global coordinates!
  //   newStitchDevice.scale = newStitchDevice.device.getPPI() / stitchedDevice.device.getPPI() * stitchedDevice.scale;

  //   //Determine device rotation based on the two edges
  //   //This is needed to translate coordinates from one device 
  //   //into another.
  //   var rotationDiff = this._edgeIndex(stitchedData.edge) - this._edgeIndex(newData.edge);
  //   if (rotationDiff < 0) rotationDiff += 4;
  //   if (rotationDiff === 2) newStitchDevice.rotation = 0;
  //   if (rotationDiff === 3) newStitchDevice.rotation = 90;
  //   if (rotationDiff === 1) newStitchDevice.rotation = 270;
  //   if (rotationDiff === 0) newStitchDevice.rotation = 180;
  //   newStitchDevice.rotation = (newStitchDevice.rotation + stitchedDevice.rotation) % 360; //make relative to master

  //   CWDebug.log(3, "NewDevice rotation is "+newStitchDevice.rotation);

  //   //Adjust device swipe coordinates to rotation
  //   //This is ugly, but we need it. To illustrate what this does
  //   //let's make an example:
  //   //The master device is 1024,768 in size. A new device (same size)
  //   //is layn to the right of it, but flipped 180º, so the 
  //   //right edge touches the right edge. Now, 768,1024 in master
  //   //coordinates (the top right edge of the master) should be
  //   //0,0 on the new device, but is actually 768,1024. Therefore,
  //   //we need to flip the coordinates of the new device
  //   // CWDebug.log(3, JSON.stringify(newData));
  //   // if (newStitchDevice.rotation === 90) {
  //   //   if (newData.edge === "left" || newData.edge === "right") {
  //   //     newData.x = newData.width  - newData.x;
  //   //     newData.y = newData.height - newData.y;
  //   //   }
  //   //   if (newData.edge === "top" || newData.edge === "bottom") {
  //   //     var temp = newData.y;
  //   //     newData.y = newData.width - newData.x;
  //   //     newData.x = temp;
  //   //   }
  //   //   var temp = newData.height;
  //   //   newData.height = newData.width;
  //   //   newData.width = newData.height;
  //   // }

  //   // if (newStitchDevice.rotation === 180) {
  //   //   if (newData.edge === "left" || newData.edge === "right") {
  //   //     newData.x = newData.width  - newData.x;
  //   //     newData.y = newData.height - newData.y;
  //   //   }
  //   //   if (newData.edge === "top" || newData.edge === "bottom") {
  //   //     newData.x = newData.width  - newData.x;
  //   //     // newData.y = newData.height - newData.y;
  //   //   }
  //   // }

  //   // if (newStitchDevice.rotation === 270) {
  //   //   if (newData.edge === "top") {
  //   //     var temp = newData.y;
  //   //     newData.y = newData.x;
  //   //     newData.x = temp;
  //   //   }
  //   //   if (newData.edge === "bottom") {
  //   //     var temp = newData.y;
  //   //     newData.y = newData.x;
  //   //     newData.x = newData.height - temp;
  //   //   }
  //   //   var temp = newData.height;
  //   //   newData.height = newData.width;
  //   //   newData.width = newData.height;
  //   // }

  //   // CWDebug.log(3, JSON.stringify(stitchedDevice));
  //   // CWDebug.log(3, JSON.stringify(stitchedData));
  //   // CWDebug.log(3, JSON.stringify(newData));
  //   // if (stitchedData.edge === "right") {
  //   //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedDevice.width / stitchedDevice.scale;
  //   //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
  //   // } else if (stitchedData.edge === "bottom") {
  //   //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
  //   //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedDevice.height / stitchedDevice.scale;
  //   // } else if (stitchedData.edge === "left") {
  //   //   newStitchDevice.transformX = stitchedDevice.transformX - newStitchDevice.width / newStitchDevice.scale;
  //   //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
  //   // } else if (stitchedData.edge === "top") {  
  //   //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
  //   //   newStitchDevice.transformY = stitchedDevice.transformY - newStitchDevice.height / newStitchDevice.scale;
  //   // }
  //   // if (newData.edge === "left") {
  //   //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedDevice.width / stitchedDevice.scale;
  //   //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
  //   // } else if (newData.edge === "top") {
  //   //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
  //   //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedDevice.height / stitchedDevice.scale;
  //   // } else if (newData.edge === "right") {
  //   //   newStitchDevice.transformX = stitchedDevice.transformX - newStitchDevice.width / newStitchDevice.scale;
  //   //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
  //   // } else if (newData.edge === "bottom") {  
  //   //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
  //   //   newStitchDevice.transformY = stitchedDevice.transformY - newStitchDevice.height / newStitchDevice.scale;
  //   // }
  //   // 
  //   function swap(obj, key1, key2) {
  //     var temp = obj[key1];
  //     obj[key1] = obj[key2];
  //     obj[key2] = temp;
  //   }

  //   // function adjusted(obj, key) {
  //   //   return obj[key] / obj.scale;
  //   // }
  //   // 
    
  //   //Just for convenience
  //   var adjDevice = {
  //     width  : stitchedDevice.width  / stitchedDevice.scale,
  //     height : stitchedDevice.height / stitchedDevice.scale,
  //     origX  : stitchedData.x        / stitchedDevice.scale,
  //     origY  : stitchedData.y        / stitchedDevice.scale,
  //   };
  //   var adjNewDevice  = {
  //     width  : newStitchDevice.width  / newStitchDevice.scale,
  //     height : newStitchDevice.height / newStitchDevice.scale,
  //     origX  : newData.x              / newStitchDevice.scale,
  //     origY  : newData.y              / newStitchDevice.scale,
  //   };

  //   //
  //   //TODO
  //   //Instead of using transformX/Y of the stitchedDevice, we need to transform the swipe point of
  //   //that device to the coordinate system of the master device. I guess four cases (0, 90, 180, 270)
  //   //should be enough? Furthermore, we need to rotate the edge (so a swipe at the bottom edge on a 
  //   //90º titled device actually gives us the right edge). Then, the calculations below should actually be
  //   //acturate
  //   //
  //   // adjDevice.x = stitchedDevice.transformX;
  //   // adjDevice.y = stitchedDevice.transformY;
  //   adjDevice.x = 0;
  //   adjDevice.y = 0;
  //   if (stitchedDevice.rotation === 0) {
  //     adjDevice.x += adjDevice.origX;
  //     adjDevice.y += adjDevice.origY;
  //   }
  //   if (stitchedDevice.rotation === 90) {
  //     adjDevice.y += adjDevice.width - adjDevice.origX; //TODO width or height?
  //     adjDevice.x += adjDevice.origY;
  //     swap(adjDevice, "width", "height"); //TODO theoretically, we should save them swapped I guess?
  //   }
  //   if (stitchedDevice.rotation === 180) {
  //     adjDevice.y += adjDevice.height - adjDevice.origY;
  //     adjDevice.x += adjDevice.width  - adjDevice.origX;
  //   }
  //   if (stitchedDevice.rotation === 270) {
  //     adjDevice.x += adjDevice.height  - adjDevice.origY;
  //     adjDevice.y += adjDevice.origX;
  //     swap(adjDevice, "width", "height"); //TODO same as before
  //   }

  //   var old = stitchedData.edge;
  //   stitchedData.edge = this._indexEdge((this._edgeIndex(stitchedData.edge) + stitchedDevice.rotation/90) % 4);

  //   CWDebug.log(3, "Device adjusted swipe is "+JSON.stringify(adjDevice));
  //   // CWDebug.log(3, "New Edge: "+this._edgeIndex(old)+" + "+(stitchedDevice.rotation/90)+" mod 4 = "+stitchedData.edge);

  //   //TODO code duplication
  //   adjNewDevice.x = 0;
  //   adjNewDevice.y = 0;
  //   if (newStitchDevice.rotation === 0) {
  //     adjNewDevice.x += adjNewDevice.origX;
  //     adjNewDevice.y += adjNewDevice.origY;
  //   }
  //   if (newStitchDevice.rotation === 90) {
  //     adjNewDevice.y += adjNewDevice.width - adjNewDevice.origX; //TODO width or height?
  //     adjNewDevice.x += adjNewDevice.origY;
  //     swap(adjNewDevice, "width", "height");
  //   }
  //   if (newStitchDevice.rotation === 180) {
  //     adjNewDevice.y += adjNewDevice.height - adjNewDevice.origY;
  //     adjNewDevice.x += adjNewDevice.width  - adjNewDevice.origX;
  //   }
  //   if (newStitchDevice.rotation === 270) {
  //     adjNewDevice.x += adjNewDevice.height  - adjNewDevice.origY;
  //     adjNewDevice.y += adjNewDevice.origX;
  //     swap(adjNewDevice, "width", "height");
  //   }

  //   CWDebug.log(3, "New Device adjusted swipe is "+JSON.stringify(adjNewDevice));

  //   //TODO
  //   //alright, here we go, the theory is this:
  //   //the above four if cases can be used to translate a point on a device to the appropiate orientation
  //   //therefore, if we transform the stitchedDevice and the newDevice and then just do stitched.x-new.x 
  //   //and stitched.y-new.y this SHOULD work. then we just add stitched.transformX/Y and we should be good? 
  //   //we'll see if that works out!
    
  //   //We always start at the position of the stitched device as a base
  //   // newStitchDevice.transformX = stitchedDevice.transformX;
  //   // newStitchDevice.transformY = stitchedDevice.transformY;

  //   // newStitchDevice.transformX = 0;
  //   // newStitchDevice.transformY = 0;
    
  //   newStitchDevice.transformX = adjDevice.x - adjNewDevice.x;
  //   newStitchDevice.transformY = adjDevice.y - adjNewDevice.y;

  //   // CWDebug.log(3, "BEFORE: "+JSON.stringify(adjDevice));
     
  //   // if (stitchedData.edge === "right") {
  //   //   switch (newData.edge) {
  //   //     case "left":
  //   //       newStitchDevice.rotation = 0;
  //   //       break;

  //   //     case "top":
  //   //       newStitchDevice.rotation = 90;
  //   //       adjNewDevice.x = adjNewDevice.width - adjNewDevice.x;
  //   //       swap(adjNewDevice, "x", "y");        
  //   //       swap(adjNewDevice, "width", "height");
  //   //       break;

  //   //     case "right":
  //   //       newStitchDevice.rotation = 180;
  //   //       adjNewDevice.x = adjNewDevice.width  - adjNewDevice.x;
  //   //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
  //   //       break;

  //   //     case "bottom":
  //   //       newStitchDevice.rotation = 270;
  //   //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
  //   //       swap(adjNewDevice, "x", "y");    
  //   //       swap(adjNewDevice, "width", "height");
  //   //       break;
  //   //   }

  //   //   // newStitchDevice.transformX += adjDevice.width;
  //   //   newStitchDevice.transformX += adjDevice.x - adjNewDevice.x;
  //   //   newStitchDevice.transformY += adjDevice.y - adjNewDevice.y;
  //   // }

  //   // if (stitchedData.edge === "left") {
  //   //   switch (newData.edge) {
  //   //     case "left":
  //   //       newStitchDevice.rotation = 180;
  //   //       adjNewDevice.x = -adjNewDevice.x;
  //   //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
  //   //       break;

  //   //     case "top":
  //   //       newStitchDevice.rotation = 270;
  //   //       swap(adjNewDevice, "x", "y");        
  //   //       swap(adjNewDevice, "width", "height");
  //   //       break;

  //   //     case "right":
  //   //       newStitchDevice.rotation = 0;
  //   //       adjNewDevice.x = adjNewDevice.x - adjNewDevice.width;
  //   //       break;

  //   //     case "bottom":
  //   //       newStitchDevice.rotation = 90;
  //   //       adjNewDevice.x = adjNewDevice.width  - adjNewDevice.x;
  //   //       adjNewDevice.y = adjNewDevice.y      - adjNewDevice.height;
  //   //       swap(adjNewDevice, "x", "y");    
  //   //       swap(adjNewDevice, "width", "height");
  //   //       break;
  //   //   }

  //   //   newStitchDevice.transformX += -adjNewDevice.width;
  //   //   newStitchDevice.transformY += adjDevice.y - adjNewDevice.y;
  //   // }

  //   // if (stitchedData.edge === "top") {
  //   //   switch (newData.edge) {
  //   //     case "left":
  //   //       newStitchDevice.rotation = 90;
  //   //       adjNewDevice.x = -adjNewDevice.x;

  //   //       swap(adjNewDevice, "x", "y");        
  //   //       swap(adjNewDevice, "width", "height");
  //   //       break;

  //   //     case "top":
  //   //       newStitchDevice.rotation = 180;
  //   //       adjNewDevice.x = adjNewDevice.width  - adjNewDevice.x;
  //   //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
  //   //       break;

  //   //     case "right":
  //   //       newStitchDevice.rotation = 270;  
  //   //       adjNewDevice.x = adjNewDevice.x       - adjNewDevice.width;
  //   //       adjNewDevice.y = adjNewDevice.height  - adjNewDevice.y;
  //   //       swap(adjNewDevice, "x", "y");    
  //   //       swap(adjNewDevice, "width", "height");
  //   //       break;

  //   //     case "bottom":
  //   //       newStitchDevice.rotation = 0;
  //   //       adjNewDevice.y = adjNewDevice.y - adjNewDevice.height;
  //   //       break;
  //   //   }

  //   //   newStitchDevice.transformX += adjDevice.x - adjNewDevice.x;
  //   //   newStitchDevice.transformY += -adjNewDevice.height;      
  //   // }

  //   // if (stitchedData.edge === "bottom") {
  //   //   switch (newData.edge) {
  //   //     case "left":
  //   //       newStitchDevice.rotation = 270;
  //   //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
  //   //       swap(adjNewDevice, "x", "y");        
  //   //       swap(adjNewDevice, "width", "height");
  //   //       break;

  //   //     case "top":
  //   //       newStitchDevice.rotation = 0;
  //   //       break;

  //   //     case "right":
  //   //       newStitchDevice.rotation = 90;  
  //   //       adjNewDevice.x = adjNewDevice.width - adjNewDevice.x;
  //   //       swap(adjNewDevice, "x", "y");    
  //   //       swap(adjNewDevice, "width", "height");
  //   //       break;

  //   //     case "bottom":
  //   //       newStitchDevice.rotation = 190;
  //   //       adjNewDevice.x = adjNewDevice.width  - adjNewDevice.x;
  //   //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
  //   //       break;
  //   //   }

  //   //   newStitchDevice.transformX += adjDevice.x - adjNewDevice.x;
  //   //   newStitchDevice.transformY += adjDevice.height;      
  //   // }

  //   newStitchDevice.transformX += stitchedDevice.transformX;
  //   newStitchDevice.transformY += stitchedDevice.transformY;

  //   CWDebug.log(3, "Transform is: "+JSON.stringify(newStitchDevice));

  //   // newStitchDevice.width = adjNewDevice.width;
  //   // newStitchDevice.height = adjNewDevice.height;

  //   // CWDebug.log(3, JSON.stringify(adjNewDevice));
  //   // CWDebug.log(3, JSON.stringify(newStitchDevice));

  //   //Make rotation relative to master, not to the stitched device
  //   // newStitchDevice.rotation = (newStitchDevice.rotation + stitchedDevice.rotation) % 360;

  //   this._devices[newDevice.getIdentifier()] = newStitchDevice;

  //   // var test = this.toMasterCoordinates({x : newStitchDevice.transformX, y: newStitchDevice.transformY }, newDevice);
  //   // test.x -= newStitchDevice.transformX;
  //   // test.y -= newStitchDevice.transformY;

  //   //Trigger both a local (master) event and also send a message to the newly stitched device
  //   CWDebug.log(3, "Device was stitched: "+JSON.stringify(newStitchDevice));
  //   // CWDebug.log(3, "TRANSFORMED: "+JSON.stringify(test));
  //   CWEventManager.trigger("stitch", stitchedDevice.device, newDevice);

  //   var stitchMessage = {
  //     type                 : "wasstitched",
  //     otherDevice          : stitchedDevice.device.getIdentifier(),
  //     edge                 : newData.edge,
  //     deviceTransformation : this.getDeviceTransformation(newDevice)
  //   };
  //   newDevice.send(stitchMessage);
  // },


  // "private _getStitchedDevice": function(device) {
  //   if (device.getIdentifier() in this._devices) {
  //     return this._devices[device.getIdentifier()];
  //   } else {
  //     return undefined;
  //   }
  // },


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
