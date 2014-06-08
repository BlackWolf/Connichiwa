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
