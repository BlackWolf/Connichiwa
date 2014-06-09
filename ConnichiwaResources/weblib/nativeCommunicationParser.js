"use strict";

/*****
* The Connichiwa Web Library Communication Protocol (Native Layer)
*
* Here we describe the protocol used to communicate between this library and the native layer. The communication is done via JSON.
* All messages to or from the native layer must contain "type": "native"
*
* iBeacon Detected
* When an iBeacon was detected by the native layer, or iBeacon data changed, it will send us the beacon data.
* Format: major -- The major number of the beacon
*         minor -- The minor number of the beacon
*         proximity -- a string describing the distance to the beacon (either "far", "near", "immediate" or "unknown")
*
*/

function NativeCommunicationParser()
{
	return this;
}

NativeCommunicationParser.prototype.parse = function(message)
{
	if (message.type === "ibeacon") {
		//Do stuff with ibeacon data
	}
};
