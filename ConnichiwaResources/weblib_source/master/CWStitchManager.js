/* global OOP, Connichiwa, CWSystemInfo, CWUtil, CWDevice, CWDeviceManager, CWEventManager, CWDebug */
"use strict";


OOP.extendSingleton("Connichiwa", "CWStitchManager", {
  "private _swipes"  : {},
  "private _devices" : {},


  "public getDeviceTransformation": function(device) {
    if (device === undefined) device = CWDeviceManager.getLocalDevice();

    var stitchedDevice = this._getStitchedDevice(device);
    if (stitchedDevice === undefined) return this.DEFAULT_DEVICE_TRANSFORMATION();

    return { 
      width    : stitchedDevice.width,
      height   : stitchedDevice.height, 
      x        : stitchedDevice.transformX, 
      y        : stitchedDevice.transformY,
      rotation : stitchedDevice.rotation,
      scale    : stitchedDevice.scale
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


  "package detectedSwipe": function(data) {
    var device = CWDeviceManager.getDeviceWithIdentifier(data.device);
    if (device === null || device.isConnected() === false) return;

    CWDebug.log(3, "Detected swipe on " + data.device + " on edge " + data.edge);

    //Check if the swipe combines with another swipe to a stitch
    var now = new Date();
    for (var key in this._swipes) {
      var savedSwipe = this._swipes[key];

      //We can't create a stitch on a single device
      if (savedSwipe.data.device === data.device) continue;

      //If the existing swipe is too old, it is invalid
      if ((now.getTime() - savedSwipe.date.getTime()) > 1000) continue;


      //Check if the other device is still connected
      var otherDevice = CWDeviceManager.getDeviceWithIdentifier(savedSwipe.data.device); 
      if (otherDevice === null || otherDevice.isConnected() === false) continue;

      this._detectedStitch(device, data, otherDevice, savedSwipe.data);
      //TODO remove the swipes?
      return;
    }

    //If the swipe does not seem to be part of a stitch, remember it for later
    this._swipes[data.device] = { date: now, data: data };
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


  "private _detectedStitch": function(firstDevice, firstData, secondDevice, secondData) {
    //Always add the master device as the first device
    if (Object.keys(this._devices).length === 0) {
      var localDevice = CWDeviceManager.getLocalDevice();
      var localData = { width: CWSystemInfo.viewportWidth(), height: CWSystemInfo.viewportHeight() };
      this._devices[localDevice.getIdentifier()] = this._createNewStitchData(localDevice, localData);
      this._isStitched = true;
    }

    //Exactly one of the two devices needs to be stitched already
    //We need this so we can calculate the position of the new device
    var firstStitchedDevice = this._getStitchedDevice(firstDevice);
    var secondStitchedDevice = this._getStitchedDevice(secondDevice);
    if (firstStitchedDevice === undefined && secondStitchedDevice === undefined) return;
    if (firstStitchedDevice !== undefined && secondStitchedDevice !== undefined) return;

    var stitchedDevice, newDevice, stitchedData, newData;
    if (firstStitchedDevice !== undefined) {
      stitchedDevice = firstStitchedDevice;
      stitchedData = firstData;
      newDevice = secondDevice;
      newData = secondData;
    } else {
      stitchedDevice = secondStitchedDevice;
      stitchedData = secondData;
      newDevice = firstDevice;
      newData = firstData;
    }

    //Add the devices to each others neighbors at the relative positions
    //Furthermore, create the stitch data for the new device, including the
    //position relative to the master device
    stitchedDevice[stitchedData.edge][newDevice.getIdentifier()] = this._coordinateForEdge(stitchedData.edge, stitchedData);

    var newStitchDevice = this._createNewStitchData(newDevice, newData);
    newStitchDevice[newData.edge][stitchedDevice.device.getIdentifier()] = this._coordinateForEdge(newData.edge, newData);

    //Calculate the transformation of the new device based on the transformation of the stitched device and the pinched edge
    //We also need to take care of differnet PPIs by performing a scaling:
    //The scale of the new device is calculated so that using that scale content appears the same size as on the master device
    //Dividing coordinates of any device by the devices scale will transform the coordinates into global coordinates
    //To be exact, global coordinates are coordinates in the PPI of the master device
    //transformX and transformY are calculated in a way that they result in global coordinates!
    newStitchDevice.scale = newStitchDevice.device.getPPI() / stitchedDevice.device.getPPI() * stitchedDevice.scale;

    //Determine device rotation based on the two edges
    //This is needed to translate coordinates from one device 
    //into another.
    var rotationDiff = this._edgeIndex(stitchedData.edge) - this._edgeIndex(newData.edge);
    if (rotationDiff < 0) rotationDiff += 4;
    if (rotationDiff === 2) newStitchDevice.rotation = 0;
    if (rotationDiff === 3) newStitchDevice.rotation = 90;
    if (rotationDiff === 1) newStitchDevice.rotation = 270;
    if (rotationDiff === 0) newStitchDevice.rotation = 180;
    newStitchDevice.rotation = (newStitchDevice.rotation + stitchedDevice.rotation) % 360; //make relative to master

    CWDebug.log(3, "NewDevice rotation is "+newStitchDevice.rotation);

    //Adjust device swipe coordinates to rotation
    //This is ugly, but we need it. To illustrate what this does
    //let's make an example:
    //The master device is 1024,768 in size. A new device (same size)
    //is layn to the right of it, but flipped 180º, so the 
    //right edge touches the right edge. Now, 768,1024 in master
    //coordinates (the top right edge of the master) should be
    //0,0 on the new device, but is actually 768,1024. Therefore,
    //we need to flip the coordinates of the new device
    // CWDebug.log(3, JSON.stringify(newData));
    // if (newStitchDevice.rotation === 90) {
    //   if (newData.edge === "left" || newData.edge === "right") {
    //     newData.x = newData.width  - newData.x;
    //     newData.y = newData.height - newData.y;
    //   }
    //   if (newData.edge === "top" || newData.edge === "bottom") {
    //     var temp = newData.y;
    //     newData.y = newData.width - newData.x;
    //     newData.x = temp;
    //   }
    //   var temp = newData.height;
    //   newData.height = newData.width;
    //   newData.width = newData.height;
    // }

    // if (newStitchDevice.rotation === 180) {
    //   if (newData.edge === "left" || newData.edge === "right") {
    //     newData.x = newData.width  - newData.x;
    //     newData.y = newData.height - newData.y;
    //   }
    //   if (newData.edge === "top" || newData.edge === "bottom") {
    //     newData.x = newData.width  - newData.x;
    //     // newData.y = newData.height - newData.y;
    //   }
    // }

    // if (newStitchDevice.rotation === 270) {
    //   if (newData.edge === "top") {
    //     var temp = newData.y;
    //     newData.y = newData.x;
    //     newData.x = temp;
    //   }
    //   if (newData.edge === "bottom") {
    //     var temp = newData.y;
    //     newData.y = newData.x;
    //     newData.x = newData.height - temp;
    //   }
    //   var temp = newData.height;
    //   newData.height = newData.width;
    //   newData.width = newData.height;
    // }

    // CWDebug.log(3, JSON.stringify(stitchedDevice));
    // CWDebug.log(3, JSON.stringify(stitchedData));
    // CWDebug.log(3, JSON.stringify(newData));
    // if (stitchedData.edge === "right") {
    //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedDevice.width / stitchedDevice.scale;
    //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
    // } else if (stitchedData.edge === "bottom") {
    //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
    //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedDevice.height / stitchedDevice.scale;
    // } else if (stitchedData.edge === "left") {
    //   newStitchDevice.transformX = stitchedDevice.transformX - newStitchDevice.width / newStitchDevice.scale;
    //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
    // } else if (stitchedData.edge === "top") {  
    //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
    //   newStitchDevice.transformY = stitchedDevice.transformY - newStitchDevice.height / newStitchDevice.scale;
    // }
    // if (newData.edge === "left") {
    //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedDevice.width / stitchedDevice.scale;
    //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
    // } else if (newData.edge === "top") {
    //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
    //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedDevice.height / stitchedDevice.scale;
    // } else if (newData.edge === "right") {
    //   newStitchDevice.transformX = stitchedDevice.transformX - newStitchDevice.width / newStitchDevice.scale;
    //   newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
    // } else if (newData.edge === "bottom") {  
    //   newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
    //   newStitchDevice.transformY = stitchedDevice.transformY - newStitchDevice.height / newStitchDevice.scale;
    // }
    // 
    function swap(obj, key1, key2) {
      var temp = obj[key1];
      obj[key1] = obj[key2];
      obj[key2] = temp;
    }

    // function adjusted(obj, key) {
    //   return obj[key] / obj.scale;
    // }
    // 
    
    //Just for convenience
    var adjDevice = {
      width  : stitchedDevice.width  / stitchedDevice.scale,
      height : stitchedDevice.height / stitchedDevice.scale,
      origX  : stitchedData.x        / stitchedDevice.scale,
      origY  : stitchedData.y        / stitchedDevice.scale,
    };
    var adjNewDevice  = {
      width  : newStitchDevice.width  / newStitchDevice.scale,
      height : newStitchDevice.height / newStitchDevice.scale,
      origX  : newData.x              / newStitchDevice.scale,
      origY  : newData.y              / newStitchDevice.scale,
    };

    //
    //TODO
    //Instead of using transformX/Y of the stitchedDevice, we need to transform the swipe point of
    //that device to the coordinate system of the master device. I guess four cases (0, 90, 180, 270)
    //should be enough? Furthermore, we need to rotate the edge (so a swipe at the bottom edge on a 
    //90º titled device actually gives us the right edge). Then, the calculations below should actually be
    //acturate
    //
    // adjDevice.x = stitchedDevice.transformX;
    // adjDevice.y = stitchedDevice.transformY;
    adjDevice.x = 0;
    adjDevice.y = 0;
    if (stitchedDevice.rotation === 0) {
      adjDevice.x += adjDevice.origX;
      adjDevice.y += adjDevice.origY;
    }
    if (stitchedDevice.rotation === 90) {
      adjDevice.y += adjDevice.width - adjDevice.origX; //TODO width or height?
      adjDevice.x += adjDevice.origY;
      swap(adjDevice, "width", "height"); //TODO theoretically, we should save them swapped I guess?
    }
    if (stitchedDevice.rotation === 180) {
      adjDevice.y += adjDevice.height - adjDevice.origY;
      adjDevice.x += adjDevice.width  - adjDevice.origX;
    }
    if (stitchedDevice.rotation === 270) {
      adjDevice.x += adjDevice.height  - adjDevice.origY;
      adjDevice.y += adjDevice.origX;
      swap(adjDevice, "width", "height"); //TODO same as before
    }

    var old = stitchedData.edge;
    stitchedData.edge = this._indexEdge((this._edgeIndex(stitchedData.edge) + stitchedDevice.rotation/90) % 4);

    CWDebug.log(3, "Device adjusted swipe is "+JSON.stringify(adjDevice));
    // CWDebug.log(3, "New Edge: "+this._edgeIndex(old)+" + "+(stitchedDevice.rotation/90)+" mod 4 = "+stitchedData.edge);

    //TODO code duplication
    adjNewDevice.x = 0;
    adjNewDevice.y = 0;
    if (newStitchDevice.rotation === 0) {
      adjNewDevice.x += adjNewDevice.origX;
      adjNewDevice.y += adjNewDevice.origY;
    }
    if (newStitchDevice.rotation === 90) {
      adjNewDevice.y += adjNewDevice.width - adjNewDevice.origX; //TODO width or height?
      adjNewDevice.x += adjNewDevice.origY;
      swap(adjNewDevice, "width", "height");
    }
    if (newStitchDevice.rotation === 180) {
      adjNewDevice.y += adjNewDevice.height - adjNewDevice.origY;
      adjNewDevice.x += adjNewDevice.width  - adjNewDevice.origX;
    }
    if (newStitchDevice.rotation === 270) {
      adjNewDevice.x += adjNewDevice.height  - adjNewDevice.origY;
      adjNewDevice.y += adjNewDevice.origX;
      swap(adjNewDevice, "width", "height");
    }

    CWDebug.log(3, "New Device adjusted swipe is "+JSON.stringify(adjNewDevice));

    //TODO
    //alright, here we go, the theory is this:
    //the above four if cases can be used to translate a point on a device to the appropiate orientation
    //therefore, if we transform the stitchedDevice and the newDevice and then just do stitched.x-new.x 
    //and stitched.y-new.y this SHOULD work. then we just add stitched.transformX/Y and we should be good? 
    //we'll see if that works out!
    
    //We always start at the position of the stitched device as a base
    // newStitchDevice.transformX = stitchedDevice.transformX;
    // newStitchDevice.transformY = stitchedDevice.transformY;

    // newStitchDevice.transformX = 0;
    // newStitchDevice.transformY = 0;
    
    newStitchDevice.transformX = adjDevice.x - adjNewDevice.x;
    newStitchDevice.transformY = adjDevice.y - adjNewDevice.y;

    // CWDebug.log(3, "BEFORE: "+JSON.stringify(adjDevice));
     
    // if (stitchedData.edge === "right") {
    //   switch (newData.edge) {
    //     case "left":
    //       newStitchDevice.rotation = 0;
    //       break;

    //     case "top":
    //       newStitchDevice.rotation = 90;
    //       adjNewDevice.x = adjNewDevice.width - adjNewDevice.x;
    //       swap(adjNewDevice, "x", "y");        
    //       swap(adjNewDevice, "width", "height");
    //       break;

    //     case "right":
    //       newStitchDevice.rotation = 180;
    //       adjNewDevice.x = adjNewDevice.width  - adjNewDevice.x;
    //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
    //       break;

    //     case "bottom":
    //       newStitchDevice.rotation = 270;
    //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
    //       swap(adjNewDevice, "x", "y");    
    //       swap(adjNewDevice, "width", "height");
    //       break;
    //   }

    //   // newStitchDevice.transformX += adjDevice.width;
    //   newStitchDevice.transformX += adjDevice.x - adjNewDevice.x;
    //   newStitchDevice.transformY += adjDevice.y - adjNewDevice.y;
    // }

    // if (stitchedData.edge === "left") {
    //   switch (newData.edge) {
    //     case "left":
    //       newStitchDevice.rotation = 180;
    //       adjNewDevice.x = -adjNewDevice.x;
    //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
    //       break;

    //     case "top":
    //       newStitchDevice.rotation = 270;
    //       swap(adjNewDevice, "x", "y");        
    //       swap(adjNewDevice, "width", "height");
    //       break;

    //     case "right":
    //       newStitchDevice.rotation = 0;
    //       adjNewDevice.x = adjNewDevice.x - adjNewDevice.width;
    //       break;

    //     case "bottom":
    //       newStitchDevice.rotation = 90;
    //       adjNewDevice.x = adjNewDevice.width  - adjNewDevice.x;
    //       adjNewDevice.y = adjNewDevice.y      - adjNewDevice.height;
    //       swap(adjNewDevice, "x", "y");    
    //       swap(adjNewDevice, "width", "height");
    //       break;
    //   }

    //   newStitchDevice.transformX += -adjNewDevice.width;
    //   newStitchDevice.transformY += adjDevice.y - adjNewDevice.y;
    // }

    // if (stitchedData.edge === "top") {
    //   switch (newData.edge) {
    //     case "left":
    //       newStitchDevice.rotation = 90;
    //       adjNewDevice.x = -adjNewDevice.x;

    //       swap(adjNewDevice, "x", "y");        
    //       swap(adjNewDevice, "width", "height");
    //       break;

    //     case "top":
    //       newStitchDevice.rotation = 180;
    //       adjNewDevice.x = adjNewDevice.width  - adjNewDevice.x;
    //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
    //       break;

    //     case "right":
    //       newStitchDevice.rotation = 270;  
    //       adjNewDevice.x = adjNewDevice.x       - adjNewDevice.width;
    //       adjNewDevice.y = adjNewDevice.height  - adjNewDevice.y;
    //       swap(adjNewDevice, "x", "y");    
    //       swap(adjNewDevice, "width", "height");
    //       break;

    //     case "bottom":
    //       newStitchDevice.rotation = 0;
    //       adjNewDevice.y = adjNewDevice.y - adjNewDevice.height;
    //       break;
    //   }

    //   newStitchDevice.transformX += adjDevice.x - adjNewDevice.x;
    //   newStitchDevice.transformY += -adjNewDevice.height;      
    // }

    // if (stitchedData.edge === "bottom") {
    //   switch (newData.edge) {
    //     case "left":
    //       newStitchDevice.rotation = 270;
    //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
    //       swap(adjNewDevice, "x", "y");        
    //       swap(adjNewDevice, "width", "height");
    //       break;

    //     case "top":
    //       newStitchDevice.rotation = 0;
    //       break;

    //     case "right":
    //       newStitchDevice.rotation = 90;  
    //       adjNewDevice.x = adjNewDevice.width - adjNewDevice.x;
    //       swap(adjNewDevice, "x", "y");    
    //       swap(adjNewDevice, "width", "height");
    //       break;

    //     case "bottom":
    //       newStitchDevice.rotation = 190;
    //       adjNewDevice.x = adjNewDevice.width  - adjNewDevice.x;
    //       adjNewDevice.y = adjNewDevice.height - adjNewDevice.y;
    //       break;
    //   }

    //   newStitchDevice.transformX += adjDevice.x - adjNewDevice.x;
    //   newStitchDevice.transformY += adjDevice.height;      
    // }

    newStitchDevice.transformX += stitchedDevice.transformX;
    newStitchDevice.transformY += stitchedDevice.transformY;

    CWDebug.log(3, "Transform is: "+JSON.stringify(newStitchDevice));

    // newStitchDevice.width = adjNewDevice.width;
    // newStitchDevice.height = adjNewDevice.height;

    // CWDebug.log(3, JSON.stringify(adjNewDevice));
    // CWDebug.log(3, JSON.stringify(newStitchDevice));

    //Make rotation relative to master, not to the stitched device
    // newStitchDevice.rotation = (newStitchDevice.rotation + stitchedDevice.rotation) % 360;

    this._devices[newDevice.getIdentifier()] = newStitchDevice;

    // var test = this.toMasterCoordinates({x : newStitchDevice.transformX, y: newStitchDevice.transformY }, newDevice);
    // test.x -= newStitchDevice.transformX;
    // test.y -= newStitchDevice.transformY;

    //Trigger both a local (master) event and also send a message to the newly stitched device
    CWDebug.log(3, "Device was stitched: "+JSON.stringify(newStitchDevice));
    // CWDebug.log(3, "TRANSFORMED: "+JSON.stringify(test));
    CWEventManager.trigger("stitch", stitchedDevice.device, newDevice);

    var stitchMessage = {
      type                 : "wasstitched",
      otherDevice          : stitchedDevice.device.getIdentifier(),
      edge                 : newData.edge,
      deviceTransformation : this.getDeviceTransformation(newDevice)
    };
    newDevice.send(stitchMessage);
  },


  "private _getStitchedDevice": function(device) {
    if (device.getIdentifier() in this._devices) {
      return this._devices[device.getIdentifier()];
    } else {
      return undefined;
    }
  },


  "private _createNewStitchData": function(device, data) {
    return {
      device     : device,
      width      : data.width,
      height     : data.height,
      transformX : 0,
      transformY : 0,
      rotation   : 0,
      scale      : 1.0,
      left       : {},
      right      : {},
      top        : {},
      bottom     : {},
    };
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

  "private _edgeIndex": function(edge) {
    switch (edge) {
      case "top":    return 0;
      case "bottom": return 2;
      case "left":   return 1;
      case "right":  return 3;
    }

    return -1;
  },

  "private _indexEdge": function(index) {
    switch (index) {
      case 0: return "top";
      case 2: return "bottom";
      case 3: return "right";
      case 1: return "left";
    }

    return "invalid";
  }
});
