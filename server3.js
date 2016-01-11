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
var delay = 1000;

var timeAtStart = new Date().getTime() / 1000

var beginning = null;
var firstChunk = true;
var colorTable = null;
var connections = new Array();

var encoder = new GIFEncoder(width,height);
encoder.start();
encoder.setRepeat(0);
encoder.setDelay(delay);
encoder.setQuality(10);
encoder.addFrame(getRandomFrame());
encoder.end();
var buf = encoder.out.getData();
fs.writeFile('server3.gif', buf, function(err){
  console.log(err);

  startServer();
});


function ByteArray(){
  this.data = [];
}

ByteArray.prototype.getData = function(){
  return new Buffer(this.data);
};

ByteArray.prototype.writeByte = function(val){
  this.data.push(val);
};

ByteArray.prototype.writeBytes = function(array, offset, length) {
  for (var l = length || array.length, i = offset || 0; i < l; i++)
    this.writeByte(array[i]);
};

ByteArray.prototype.writeUTFBytes = function(string) {
  for (var l = string.length, i = 0; i < l; i++)
    this.writeByte(string.charCodeAt(i));
};

ByteArray.prototype.writeShort = function(pValue) {
  this.writeByte(pValue & 0xFF);
  this.writeByte((pValue >> 8) & 0xFF);
};

function analyzePixels(pixels) {
  var len = pixels.length;
  var nPix = len / 3;

  var indexedPixels = new Uint8Array(nPix);

  var imgq = new NeuQuant(pixels, 10);
  imgq.buildColormap(); // create reduced palette
  colorTable = imgq.getColormap();

  // map image pixels to new palette
  var k = 0;
  for (var j = 0; j < nPix; j++) {
    var index = imgq.lookupRGB(
      pixels[k++] & 0xff,
      pixels[k++] & 0xff,
      pixels[k++] & 0xff
    );
    indexedPixels[j] = index;
  }

  return indexedPixels;
};

function getImagePixels(px) {
  var w = width;
  var h = height;
  var pixels2 = new Uint8Array(w * h * 3);

  var data2 = px;
  var count = 0;

  for (var i = 0; i < h; i++) {
    for (var j = 0; j < w; j++) {
      var b = (i * w * 4) + j * 4;
      pixels2[count++] = data2[b];
      pixels2[count++] = data2[b+1];
      pixels2[count++] = data2[b+2];
    }
  }

  return pixels2;
};

function createNewFrame() {
  var out = new ByteArray();
  //graphical control extension
  out.writeByte(0x21); 
  out.writeByte(0xf9);
  out.writeByte(4); // block size (?)
  out.writeByte(0x00); // packed field for transparent gifs
  out.writeShort(delay);
  out.writeByte(0); // transparent index
  out.writeByte(0); // block terminator

  // image descriptor
  out.writeByte(0x2c);
  out.writeShort(0);
  out.writeShort(0);
  out.writeShort(width);
  out.writeShort(height);
  out.writeByte(
    0x80 | // 1 local color table 1=yes
    0 | // 2 interlace - 0=no
    0 | // 3 sorted - 0=no
    0 | // 4-5 reserved
    7 // 6-8 size of color table
  );


  //create red image
  var w = width;
  var h = height;
  var count = 0;
  var pixels = new Uint8Array(w*h*4);
  for (var i = 0; i < h; i++) {
    for (var j = 0; j < w; j++) {
      pixels[count++] = (frameCount*10)%255
      pixels[count++] = (frameCount*10)%255
      pixels[count++] = (frameCount*10)%255
      pixels[count++] = 255
    }
  }

  var imagePixels = getImagePixels(pixels);
  var indexedPixels = analyzePixels(imagePixels);
  //local color table

  out.writeBytes(colorTable);
  var n = (3 * 256) - colorTable.length;
  for(var i = 0; i < n; i++)
    out.writeByte(0);

  //image data
  var enc = new LZWEncoder(w,h,indexedPixels,8);
  enc.encode(out);

  var finalData = out.getData();

  return finalData;
}

function getRandomFrame(){
  var timeElapsed = Number(new Date().getTime() / 1000) - timeAtStart;
  var buffer = new Buffer(width*height*4);
  for(var i = 0; i < buffer.length; i++){
    buffer[i] = Math.round(Math.random() * 255);
  }
  return buffer;
}

var startTime = null;
var frameCount = 0;

Array.prototype.remove = function(e) {
  for (var i = 0; i < this.length; i++) {
    if (e == this[i]) { return this.splice(i, 1); }
  }
};
function startServer(){
  var startGif = fs.readFileSync('server3.gif');

  http.createServer(function (req, res) {
    console.log('New subscriber: ' + connections.length + " total.\n")
    res.writeHead(200, {'Content-Type': 'image/gif'});
    res.write(startGif,'binary');
    connections.push(res);
    req.on('close', function() {
      res.end();
      connections.remove(res);
      console.log('Subscriber left: ' + connections.length + " total.\n");
    });
  }).listen(8080, '0.0.0.0');

  setInterval(function(){
    frameCount++;
    console.log('yo')
    var newFrame = createNewFrame();
    console.log(newFrame);
    for(var i = 0; i < connections.length;i++){
      connections[i].write(newFrame,'binary');
    }
  },100);
}


