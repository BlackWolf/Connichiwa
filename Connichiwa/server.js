var http = require('http');
var server = http.createServer(function(req, res) {
  console.log((new Date()) + ' Received request for ' + req.url);

  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write("HALLO DU!");
  res.end();
});

server.listen(8000);
