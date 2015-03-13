'use strict';

/**
 * Constructs a new CWVector object from a start and an end point
 * @param {Point} p1  Start point of the vector
 * @param {Point} p2 End point of the vector
 * @class
 * @classdesc Represents a two-dimensional vector with a start and an end point
 */
function CWVector(p1, p2) {
  if (p1 === undefined || p2 === undefined) throw 'Cannot instantiate Vector without 2 points';

  /**
   * Start point of the vector
   * 
   * @type {Point}
   * @private
   */
  this._p1 = p1;

  /**
   * End point of the vector
   * 
   * @type {Point}
   * @private
   */
  this._p2 = p2;
}


/**
 * Returns the delta between the x values of the two points of the vector
 * 
 * @return {Number}
 *         The delta x value
 */
CWVector.prototype.deltaX = function() {
  return this._p2.x - this._p1.x;
};


/**
 * Returns the delta between the y values of the two points of the vector
 * 
 * @return {Number}
 *         The delta y value
 */
CWVector.prototype.deltaY = function() {
  return this._p2.y - this._p1.y;
};


/**
 * Returns the length of the vector
 * 
 * @return {Number}
 *         The vector's length
 */
CWVector.prototype.length = function() {
  return Math.sqrt(Math.pow(this._deltaX, 2) + Math.pow(this._deltaY, 2));
};


/**
 * Returns the angle between this vector and the given vector
 * 
 * @param  {CWVector} otherVector 
 *         The vector to measure the angle to
 * @return {Number}
 *         The angle between this vector and the given vector
 */
CWVector.prototype.angleBetween = function(otherVector) {
  var vectorsProduct = this.deltaX() * otherVector.deltaX() + this.deltaY() * otherVector.deltaY();
  var vectorsLength = this.length() * otherVector.length();
  return Math.acos(vectorsProduct / vectorsLength) * (180.0 / Math.PI);
};



/**
 * Returns the start point of the vector
 *
 * @return {Point}
 *         The start point of the vector
 */
CWVector.prototype.getP1 = function() {
  return this._p1;
};

/**
 * Returns the end point of the vector
 * 
 * @return {Point}
 *         The end point of the vector
 */
CWVector.prototype.getP2 = function() {
  return this._p2;
};
