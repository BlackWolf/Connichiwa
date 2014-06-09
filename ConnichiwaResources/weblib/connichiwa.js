/* global RemoteDevice, DeviceManager, NativeCommunicationParser */
"use strict";

//Code is splitted among a few files, get them all together
$.when(
	$.getScript("./remoteDevice.js"),
	$.getScript("./deviceManager.js"),
	$.getScript("./nativeCommunicationParser.js")
).done(function()
{
	var deviceManager = new DeviceManager();
	var websocket = new WebSocket("ws://127.0.0.1:8001");

	/**
	 * Called when the websocket connection is established
	 */
	websocket.onopen = function()
	{
		console.log("open");
	};

	/**
	 * Called when we receive a message over the websocket
	 */
	websocket.onmessage = function(e)
	{
		var message = e.data;
		NativeCommunicationParser.parse(message);

		console.log("message: "+message);
	};

	/**
	 * Called when the websocket connection errors
	 */
	websocket.onerror = function()
	{
		console.log("error");
	};

	/**
	 * Called when the websocket connection to a remote device is closed
	 */
	websocket.onclose = function()
	{
		console.log("close");
	};
});
