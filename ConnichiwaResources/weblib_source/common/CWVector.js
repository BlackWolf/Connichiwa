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


