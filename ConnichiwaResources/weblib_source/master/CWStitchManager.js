/* global OOP, Connichiwa, CWSystemInfo, CWUtil, CWDevice, CWDeviceManager, CWEventManager, CWDebug */
"use strict";


OOP.extendSingleton("Connichiwa", "CWStitchManager", {
  "private _swipes"  : {},
  "private _devices" : {},


  "public getDeviceTransformation": function(device) {
    if (device === undefined) device = CWDeviceManager.getLocalDevice();

    var stitchedDevice = this._getStitchedDevice(device);
    if (stitchedDevice === undefined) return { x: 0, y: 0, scale: 1.0 };

    return { 
      x     : stitchedDevice.transformX, 
      y     : stitchedDevice.transformY,
      scale : stitchedDevice.scale
    };
  },


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
      delete this._devices[identifier];

      var unstitchMessage = { type : "wasUnstitched" };
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

    if (stitchedData.edge === "right") {
      newStitchDevice.transformX = stitchedDevice.transformX + stitchedDevice.width / stitchedDevice.scale;
      newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
    } else if (stitchedData.edge === "bottom") {
      newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale  - newData.x / newStitchDevice.scale;
      newStitchDevice.transformY = stitchedDevice.transformY + stitchedDevice.height / stitchedDevice.scale;
    } else if (stitchedData.edge === "left") {
      newStitchDevice.transformX = stitchedDevice.transformX - newStitchDevice.width / newStitchDevice.scale;
      newStitchDevice.transformY = stitchedDevice.transformY + stitchedData.y / stitchedDevice.scale - newData.y / newStitchDevice.scale;
    } else if (stitchedData.edge === "top") {  
      newStitchDevice.transformX = stitchedDevice.transformX + stitchedData.x / stitchedDevice.scale - newData.x / newStitchDevice.scale;
      newStitchDevice.transformY = stitchedDevice.transformY - newStitchDevice.height / newStitchDevice.scale;
    }

    this._devices[newDevice.getIdentifier()] = newStitchDevice;

    //Trigger both a local (master) event and also send a message to the newly stitched device
    CWDebug.log(3, "Detected stitch");
    CWEventManager.trigger("stitch", stitchedDevice.device, newDevice);

    var stitchMessage = {
      type                 : "wasStitched",
      otherDevice          : stitchedDevice.device.getIdentifier(),
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
  }
});
