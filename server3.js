var webshot = require('webshot');
var LZWEncoder = require('./lib/LZWEncoder.js');
var NeuQuant = require('./lib/TypedNeuQuant');
var PNG = require('png-js');
var pngFileStream = require('png-file-stream');
var GIFEncoder = require('gifencoder');
var fs = require('fs');
var http = require('http');

var width = 320;
var height = 200;


var timeAtStart = new Date().getTime() / 1000

var beginning = null;
var firstChunk = true;
var connections = new Array();

var encoder = new GIFEncoder(width,height);
encoder.createReadStream().pipe(fs.createWriteStream('server3.gif'));
encoder.createReadStream().on('data',function(chunk){
  if(firstChunk == true){
    console.log(chunk);
    beginning = chunk;
    firstChunk = false;
  }
  else {
    for(var i = 0; i < connections.length; i++){
      connections[i].write(chunk);
    }
  }
})

encoder.start();
encoder.setRepeat(0);
encoder.setDelay(100);
encoder.setQuality(10);

setInterval(function(){
  encoder.addFrame(getRandomFrame());
},1000)

function getRandomFrame(){
  var timeElapsed = Number(new Date().getTime() / 1000) - timeAtStart;
  var buffer = new Buffer(width*height*4);
  for(var i = 0; i < buffer.length; i++){
    if(i < timeElapsed){
      buffer[i] = 255;
    }
    else
      buffer[i] = 0;
  }
  return buffer;
}


http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'image/gif'});
  connections.push(res);
  encoder.createReadStream().pipe(res);
  
}).listen(8080, '0.0.0.0');
