/* global CWDebug */
"use strict";


/**
 * The Connichiwa Communication Protocol Parser (Webserver).  
 * Here the protocol used to communicate between this library and the webserver is parsed. Although all websocket messages are (obvisouly) send by the webserver, this class parses messages that are triggered by the webserver itself and not relayed through the webserver. The communication is done via JSON.
 *
 * **Debug Flag Information** -- type="debug"  
 * Contains a flag telling us if we run in debug mode or not. Format:
 * * cwdebug -- true if we are debugging, otherwise false
 *
 * @namespace CWWebserverCommunicationParser
 */
var CWWebserverCommunicationParser = (function()
{
  /**
   * Parses a message from the websocket. If the message is none of the messages described by this class, this method will do nothing. Otherwise the message will trigger an appropiate action.
   *
   * @param {string} message The message from the websocket
   *
   * @memberof CWWebserverCommunicationParser
   */
  var parse = function(message)
  {
    var object = JSON.parse(message);
    switch (object.type)
    {
      case "debug":
        CWDebug.CWDEBUG = Boolean(object.cwdebug);
        break;
    }
  };

  return {
    parse : parse
  };
})();
