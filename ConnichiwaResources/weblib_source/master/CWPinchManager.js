/* global OOP, Connichiwa, CWUtil, CWDevice, CWDeviceManager, CWEventManager, CWDebug */
"use strict";


OOP.extendSingleton("Connichiwa", "CWPinchManager", {
  "private _swipes"  : {},
  "private _devices" : {},


  "public getDeviceTransformation": function(device) {
    if (device === undefined) device = CWDeviceManager.getLocalDevice();

    var pinchedDevice = this._getPinchedDevice(device);
    if (pinchedDevice === undefined) return { x: 0, y: 0, scale: 1.0 };

    return { 
      x     : pinchedDevice.transformX, 
      y     : pinchedDevice.transformY,
      scale : pinchedDevice.scale
    };
  },


  "package detectedSwipe": function(data) {
    var device = CWDeviceManager.getDeviceWithIdentifier(data.device);
    if (device === null || device.isConnected() === false) return;

    CWDebug.log(3, "Detected swipe on " + data.device + " on edge " + data.edge);

    //Check if the swipe corresponds with another swipe in the array
    //to form a pinch
    var now = new Date();
    for (var key in this._swipes) {
      var savedSwipe = this._swipes[key];

      //We can't create a pinch on a single device
      if (savedSwipe.data.device === data.device) continue;

      //If the existing swipe is too old, it is invalid
      if ((now.getTime() - savedSwipe.date.getTime()) > 1000) continue;


      //Check if the other device is still connected
      var otherDevice = CWDeviceManager.getDeviceWithIdentifier(savedSwipe.data.device); 
      if (otherDevice === null || otherDevice.isConnected() === false) continue;

      this._detectedPinch(device, data, otherDevice, savedSwipe.data);
      return;
    }

    //If the swipe does not seem to be part of a pinch, remember it for later
    this._swipes[data.device] = { date: now, data: data };

    //TODO remove the swipes?
  },


  "package unpinchDevice": function(identifier) {
    if (identifier in this._devices) {
      delete this._devices[identifier];

      var unpinchMessage = { type : "wasUnpinched" };
      Connichiwa.send(identifier, unpinchMessage);
    }
  },


  "private _detectedPinch": function(firstDevice, firstData, secondDevice, secondData) {
    //Always add the master device as the first device
    if (Object.keys(this._devices).length === 0) {
      var localDevice = CWDeviceManager.getLocalDevice();
      var localData = { width: screen.availWidth, height: screen.availHeight };
      this._devices[localDevice.getIdentifier()] = this._createNewPinchData(localDevice, localData);
    }

    //Exactly one of the two devices needs to be pinched already
    //We need this so we can calculate the position of the new device
    var firstPinchedDevice = this._getPinchedDevice(firstDevice);
    var secondPinchedDevice = this._getPinchedDevice(secondDevice);
    if (firstPinchedDevice === undefined && secondPinchedDevice === undefined) return;
    if (firstPinchedDevice !== undefined && secondPinchedDevice !== undefined) return;

    var pinchedDevice, newDevice, pinchedData, newData;
    if (firstPinchedDevice !== undefined) {
      pinchedDevice = firstPinchedDevice;
      pinchedData = firstData;
      newDevice = secondDevice;
      newData = secondData;
    } else {
      pinchedDevice = secondPinchedDevice;
      pinchedData = secondData;
      newDevice = firstDevice;
      newData = firstData;
    }

    //Add the devices to each others neighbors at the relative positions
    //Furthermore, create the pinch data for the new device, including the
    //position relative to the master device
    pinchedDevice[pinchedData.edge][newDevice.getIdentifier()] = this._coordinateForEdge(pinchedData.edge, pinchedData);

    var newPinchDevice = this._createNewPinchData(newDevice, newData);
    newPinchDevice[newData.edge][pinchedDevice.device.getIdentifier()] = this._coordinateForEdge(newData.edge, newData);

    //Calculate the transformation of the new device based on the transformation
    //of the pinched device and the pinched edge on the pinched device
    //In particular, we need to convert between different ppi screens
    newPinchDevice.scale = newPinchDevice.device.getPPI() / pinchedDevice.device.getPPI() * pinchedDevice.scale;
    if (pinchedData.edge === "right") {
      newPinchDevice.transformX = pinchedDevice.transformX + pinchedDevice.width / pinchedDevice.scale;
      newPinchDevice.transformY = pinchedDevice.transformY + pinchedData.y / pinchedDevice.scale - newData.y * newPinchDevice.scale;
    } else if (pinchedData.edge === "bottom") {
      newPinchDevice.transformX = pinchedDevice.transformX + pinchedData.x - newData.x / pinchedDevice.scale * newPinchDevice.scale;
      newPinchDevice.transformY = pinchedDevice.transformY + pinchedDevice.height / pinchedDevice.scale;
    } else if (pinchedData.edge === "left") {
      newPinchDevice.transformX = pinchedDevice.transformX - newPinchDevice.width / pinchedDevice.scale;
      newPinchDevice.transformY = pinchedDevice.transformY + pinchedData.y - newData.y / pinchedDevice.scale * newPinchDevice.scale;
    } else if (pinchedData.edge === "top") {  
      newPinchDevice.transformX = pinchedDevice.transformX + pinchedData.x - newData.x / pinchedDevice.scale * newPinchDevice.scale;
      newPinchDevice.transformY = pinchedDevice.transformY - newPinchDevice.height / pinchedDevice.scale;
    }

    this._devices[newDevice.getIdentifier()] = newPinchDevice;

    //Trigger a local (master) event and send a message to the newly pinched device
    CWDebug.log(3, "Detected pinch");
    CWEventManager.trigger("pinch", pinchedDevice.device, newDevice);

    var pinchMessage = {
      type                 : "wasPinched",
      otherDevice          : pinchedDevice.device.getIdentifier(),
      deviceTransformation : this.getDeviceTransformation(newDevice)
    };
    newDevice.send(pinchMessage);
  },


  "private _getPinchedDevice": function(device) {
    if (device.getIdentifier() in this._devices) {
      return this._devices[device.getIdentifier()];
    } else {
      return undefined;
    }
  },


  "private _createNewPinchData": function(device, data) {
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
