"use strict";

//Because having everything in one file is seriosuly annoying, we split our code into pieces
//We don't do real OOP, though - since all files are loaded in one global context they can all access every global variable 'n' stuff
$.when(
    $.getScript("./deviceManager.js"),
    $.getScript("./nativeCommunicationParser.js")
).done(function()
{
	var deviceManager = new DeviceManager();
	
	//Create the websocket connection to Nodelike on load
	var websocket = new WebSocket("ws://127.0.0.1:8001");

	/** Called when the websocket connection is established **/
	websocket.onopen = function() {
		console.log("open");
	};

	/** Called when we receive a message over the websocket **/
	websocket.onmessage = function(e) {
		var message = e.data;
		console.log("message: "+message);
	};

	websocket.onerror = function() {
		console.log("error");
	};

	websocket.onclose = function() {
		console.log("close");
	};

	//send stuff via websocket.send();
	//close the connection via websocket.close();
});
