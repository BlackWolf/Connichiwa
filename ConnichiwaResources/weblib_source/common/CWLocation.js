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
  CWDebug.log(3, JSON.stringify(transformation));
  
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
