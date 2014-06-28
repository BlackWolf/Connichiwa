/* global CWDebug, CWDeviceManager, CWDeviceState, CWEventManager, Connichiwa */
"use strict";


/**
 * The Connichiwa Communication Protocol Parser (Remote Device).  
 * Here the protocol used to communicate between this library and a connected remote device is parsed. The communication is done via JSON.
 *
 * **Remote ID Information** -- type="remoteidentifier"  
 * Contains the identifier of a connected remote device. Format:
 * * identifier -- a string identifying the unique ID of the device the weblib runs on
 *
 * @namespace CWRemoteCommunicationParser
 */
var CWRemoteCommunicationParser = (function()
{
  /**
   * Parses a message from the websocket. If the message is none of the messages described by this class, this method will do nothing. Otherwise the message will trigger an appropiate action.
   *
   * @param {string} message The message from the websocket
   *
   * @memberof CWRemoteCommunicationParser
   */
  var parse = function(message)
  {
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "didconnect":
        var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
        if (device === null) return;
        
        device.state = CWDeviceState.CONNECTED;
        
        native_remoteDidConnect(device.getIdentifier());
        CWEventManager.trigger("deviceConnected", device);
        break;
      case "willdisconnect":
        var device = CWDeviceManager.getDeviceWithIdentifier(object.identifier);
        if (device === null) return;
          
        device.state = CWDeviceState.DISCONNECTED;
          
        var data = { type: "remoteDisconnected", identifier: object.identifier };
        Connichiwa._send(JSON.stringify(data)); 
        
        CWEventManager.trigger("deviceDisconnected", device);
        break;
    }
  };

  return {
    parse : parse
  };
})();
