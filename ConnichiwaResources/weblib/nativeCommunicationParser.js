/* global deviceManager */
"use strict";



/*****
* The Connichiwa Web Library Communication Protocol (Native Layer)
*
* Here we describe the protocol used to communicate between this library and the native layer. The communication is done via JSON.
*
*
*
* Local Device Information | type="localinfo"
* Contains information about the local device
* Format: major -- the major number of this device
*         minor -- the minor number of this device
*
*
* iBeacon Detected | type="ibeacon"
* When an iBeacon was detected by the native layer, or iBeacon data changed, it will send us the beacon data.
* Format: major -- The major number of the beacon
*         minor -- The minor number of the beacon
*         proximity -- a string describing the distance to the beacon (either "far", "near", "immediate" or "unknown")
*
*/

function NativeCommunicationParser()
{
  throw "NativeCommunicationParser should not be instantiated. Use the static .parse()";
}

NativeCommunicationParser.parse = function(object)
{
  switch (object.type)
	{
    case "localinfo":
      deviceManager.initLocalDeviceWithData(object);
      break;
    case "ibeacon":
      deviceManager.addOrUpdateDevice(object);
      break;
  }
};
