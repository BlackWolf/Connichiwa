/* global OOP, Connichiwa, CWUtil, CWDevice, CWDeviceManager, CWEventManager, CWDebug */
"use strict";


var CWPinchManager = OOP.createSingleton("Connichiwa", "CWPinchManager", {
  "private _swipes"       : {},
  "private _devices"      : {},


  "public getDeviceTransformation": function(device) {
    //TODO, for now we just check one level from the master device
    //obviously, this must be fixed
    var masterPinchedDevice = this._getPinchedDevice(CWDeviceManager.getLocalDevice());

    var transform = { x: screen.availWidth, y: screen.availHeight };
    var edges = [ "top", "left", "bottom", "right" ];
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (device.getIdentifier() in masterPinchedDevice[edge]) {
        var axis = this._axisForEdge(edge);
        transform[axis] = masterPinchedDevice[edge][device.getIdentifier()];
        return transform;
      }
    }
  },


  "package detectedSwipe": function(data) {
    CWDebug.log(3, "Detected swipe on " +data.edge+", device "+data.device);
    var device = CWDeviceManager.getDeviceWithIdentifier(data.device);
    if (device === null || device.isConnected() === false) return;

    //Check if the swipe corresponds with another swipe in the database to form a pinch
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
    CWDebug.log(3, "Adding swipe " + data.device);
    this._swipes[data.device] = { date: now, data: data };
  },


  "private _detectedPinch": function(firstDevice, firstData, secondDevice, secondData) {
    //Always add the master device as the first device
    if (Object.keys(this._devices).length === 0) {
      var localDevice = CWDeviceManager.getLocalDevice();
      this._devices[localDevice.getIdentifier()] = this._createPinchData(localDevice);
    }

    CWDebug.log(3, "Detected pinch");

    //Exactly one of the two devices needs to be pinched
    //We need this so we can get the relative position of the new device
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

    //Add the new device to the pinch data of the existing device
    //Also, create pinch data for the new device
    pinchedDevice[pinchedData.edge][newDevice.getIdentifier()] = this._coordinateForEdge(pinchedData.edge, pinchedData);
    var newPinchDevice = this._createPinchData(newDevice);
    newPinchDevice[newData.edge][pinchedDevice.device.getIdentifier()] = this._coordinateForEdge(newData.edge, newData);
    this._devices[newDevice.getIdentifier()] = newPinchDevice;

    CWDebug.log(1, "Got pinch, devices look like this: " + JSON.stringify(this._devices));
    CWEventManager.trigger("pinch", newDevice);
  },


  "private _getPinchedDevice": function(device) {
    if (device.getIdentifier() in this._devices) {
      return this._devices[device.getIdentifier()];
    } else {
      return undefined;
    }
  },


  "private _createPinchData": function(device) {
    return {
      device      : device,
      left        : {},
      right       : {},
      top         : {},
      bottom      : {},
      orientation : "unknown"
    };
  },


  "private _coordinateForEdge": function(edge, point) {
    // if (edge === "left" || edge === "right") return point.y;
    // if (edge === "top" || edge === "bottom") return point.x;
     
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
