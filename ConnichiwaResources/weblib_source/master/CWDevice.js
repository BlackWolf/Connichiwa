/* global CWDevice, CWNativeBridge */
'use strict';



/**
 * (Available on master device only)
 *
 * Tries to establish a HTTP connection to the device. This is only possible
 *    if the device has been discovered over Bluetooth ({@link
 *    CWDevice#isNearby} returns `true`). If the device is already connected,
 *    calling this method will have no effect.
 */
CWDevice.prototype.connect = function() {
  if (this._canBeConnected() === false) return;

  this._connectionState = CWDevice.ConnectionState.CONNECTING;
  CWNativeBridge.callOnNative('nativeCallConnectRemote', this.getIdentifier());
};
