/* global CWDevice, CWDeviceConnectionState */
/* global nativeCallConnectRemote */
"use strict";

CWDevice.prototype.connect = function()
{
  if (this.canBeConnected() === false) return;

  this.connectionState = CWDeviceConnectionState.CONNECTING;
  nativeCallConnectRemote(this.getIdentifier());
};
