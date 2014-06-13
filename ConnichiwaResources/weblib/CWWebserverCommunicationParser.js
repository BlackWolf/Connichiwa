/* global CWDebug */
"use strict";


/*****
* The Connichiwa Web Library Communication Protocol (Webserver)
*
* Here we describe the protocol used to communicate between this library and the local webserver. These describe messages that are not triggered by the native layer. For those messages see CWNativeCommunicationParser. The communication is done via JSON.
*
*
*
* Debug Flag Information | type="debug"
* Contains information about if we run in debug mode or not
* Format: cwdebug -- true if we are debugging, otherwise false
*****/

var CWWebserverCommunicationParser = (function()
{
  var parse = function(object)
  {
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
