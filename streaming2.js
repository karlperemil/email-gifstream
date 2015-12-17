var GIFEncoder = require('gifencoder');
var Canvas = require('canvas');
var fs = require('fs');
var http = require('http');

var encoder = new GIFEncoder(320, 240);
// stream the results as they are available into myanimated.gif
encoder.createReadStream().pipe(fs.createWriteStream('myanimated.gif'));

encoder.start();
encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
encoder.setDelay(500);  // frame delay in ms
encoder.setQuality(10); // image quality. 10 is default.

var canvas = new Canvas(320, 240);
var ctx = canvas.getContext('2d');




http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'image/gif'});
  var gif  = fs.createReadStream('myanimated.gif')
  .pipe(res.write(gif));
  
}).listen(8080, '0.0.0.0');

console.log('Server started at port 8080')