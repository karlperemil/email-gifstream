var webshot = require('webshot');
var GIFEncoder = require('gifencoder');
var pngFileStream = require('png-file-stream');
var NeuQuant = require('lib/TypedNeuQuant.js');
var LZWEncoder = require('lib/LZWEncoder.js');

var width = 320;
var height = 200;
var delay = 100; // 100 = 1 second
var encoder = new GIFEncoder(width,height);


var fs = require('fs');
var http = require('http');

var options = {
  siteType:'html',
  screenSize: {
    width: width,
    height: height
  },
  shotSize: {
    width: width,
    height: height
  }
};

function getGif(){

  var htmlstring = '<html><body><h1 style="color:red; text-align=center;">' + String(new Date().getTime() / 1000) + '</h1></body></html>';

  var renderStream = webshot( htmlstring, options);

  var file = fs.createWriteStream('test.png', {encoding:'binary'});
  renderStream.on('data',function(data){
    file.write(data.toString('binary'), 'binary');
  });

  renderStream.on('end', function(){
    return new Buffer().write(pngFileStream('test.png')
    .pipe(encoder.createWriteStream({ repeat: -1, delay: 500, quality: 10 })),'binary')
    //.pipe(fs.createWriteStream('animated.gif'));
  });

}

function ByteArray(){
  this.data = [];
}

ByteArray.prototype.getData = function(){
  return new Buffer(this.data);
};

ByteArray.prototype.writeByte = function(val){
  this.data.push(val);
};

ByteArray.prototype.writeBytes = function(array, offset, length){
  for (var l = length || array.length, i = offset || 0; i < l; i++)
    this.writeByte(array[i]);
};

ByteArray.prototype.writeUTFBytes = function(string) {
  for (var l = string.length, i = 0; i < l; i++)
    this.writeByte(string.charCodeAt(i));
};

GIFEncoder.prototype.writeShort = function(pValue) {
  this.out.writeByte(pValue & 0xFF);
  this.out.writeByte((pValue >> 8) & 0xFF);
};

function createGif(){
  this.out = new ByteArray();
  //header
  this.out.writeBytes("GIF89a");
  //Logical Screen Descriptor
  this.out.writeShort(width);
  this.out.writeShort(height);
    // packed fields
  this.out.writeByte(
    0x80 | // 1 : global color table flag = 1 (gct used)
    0x70 | // 2-4 : color resolution = 7
    0x00 | // 5 : gct sort flag = 0
    7 // 6-8 : gct size, 7 = 256 colors used
  );

  this.out.writeByte(0); // background color index
  this.out.writeByte(0); // pixel aspect ratio - assume 1:1

  // Global Color Table
  // each color = 3 bytes of color = R G B
  // we have 256 colors defined in LSD

  for(var i = 0; i < 256; i++){
    var r = Math.round(Math.random()*255);
    var g = Math.round(Math.random()*255);
    var b = Math.round(Math.random()*255);
    this.out.writeBytes([r,g,b]);
  }

  return this.out;

}

function createFrame(){

  var frame = new ByteArray()
  // GCE - Graphical Control Extension
  frame.writeByte(0x21); // extension introducer
  frame.writeByte(0xf9); // graphical constrol label
  frame.writeByte(4); // data block size
  frame.writeByte(0 | 0 | 0 | 0);
  frame.writeByte(delay); // delay
  frame.writeByte(0); // transparent color index
  frame.writeByte(0); // block terminator


  // ID = Image Descriptor block
  frame.writeByte(0x2c) // always same, image separator
  frame.writeByte([0,0,0,0]) // image left, image top
  frame.writeBytes([width,height]) // width and height
  frame.writeBytes(0) // packed field, see http://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp

  // local color table, skip

  // image data


}



function writeLoop(req,res,callback){
  var gif = getGif();
  res.write( gig );
  writeLoop();
}

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'image/gif'});
  res.write( getGif() );
}).listen(8080, '0.0.0.0');


console.log('Server running at http://127.0.0.1:8080/'); 
