/* global LazyLoad, RemoteDevice, DeviceManager, NativeCommunicationParser */
"use strict";

var deviceManager, websocket;

//Code is splitted among a few files, get them all together
LazyLoad.js(
[
	"/connichiwa/debug.js",
	"/connichiwa/device.js",
	"/connichiwa/deviceManager.js",
	"/connichiwa/nativeCommunicationParser.js"
], function ()
{
	deviceManager = new DeviceManager();
	websocket = new WebSocket("ws://127.0.0.1:8001");

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
		//Debug.log("message: "+message);

		var object = JSON.parse(message);
		NativeCommunicationParser.parse(object);
	};

	/**
	 * Called when the websocket connection errors
	 */
	websocket.onerror = function()
	{
		alert("WEBSOCKET ERROR");
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
