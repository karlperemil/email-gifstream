var webshot = require('webshot');
var LZWEncoder = require('./lib/LZWEncoder.js');
var NeuQuant = require('./lib/TypedNeuQuant');
var PNG = require('png-js');

var width = 320;
var height = 200;
var delay = 100; // 100 = 1 second
var transIndex = 0;
var repeat = 0;
var pixels = null;
var indexedPixels = null;
var colorTab = null;
var colorDepth = null;
var usedEntry = new Array();
var palSize = 7;
var dispose = -1;
var firstFrame = true;
var sample = 10;
var started = false;
var out = new ByteArray();

var gifHeader = null;
var currentFrame = null;


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
  },
  streamType: 'png'
};

var subscribers = [];

var count = 0;

function createImage(callback){
  var htmlstring = '<html><body style="background:black;"><h1 style="color:red; text-align=center;">' + String(new Date().getTime() / 1000) + '</h1></body></html>';

  webshot( htmlstring, 'test' + count +'.png', options, function(err){
    if(err){
      console.log(err)
    }
    console.log('created test' + count);
    imageDone(callback);
  });
}

function imageDone(callback){
  setTimeout(function(){
    PNG.decode('test'+count+'.png',function(pixels){
      createFrameFromPixels(pixels,callback);

      count++;
      if(count > 10){
        count = 0;
      }

    })

  },1500)
}

function createFrameFromPixels(pixels,callback){

  var pixelArray = new Uint8Array(width * height * 3); //because RGB = 3

  //remove alpha channel
  var count = 0;
  for(var i=0; i < pixels.length;i+=4){
    pixelArray[count++] = pixels[i];
    pixelArray[count++] = pixels[i+1];
    pixelArray[count++] = pixels[i+2];
  }

  analyzePixels(pixelArray,callback);
}

/*
  Analyzes current frame colors and creates color map.
*/
function analyzePixels(pixelArray,callback) {
  var len = pixelArray.length;

  console.log('len:', len);
  var nPix = len / 3;

  indexedPixels = new Uint8Array(nPix);

  var imgq = new NeuQuant(pixelArray, sample);
  imgq.buildColormap(); // create reduced palette
  colorTab = imgq.getColormap();

  // map image pixels to new palette
  var k = 0;
  for (var j = 0; j < nPix; j++) {
    var index = imgq.lookupRGB(
      pixelArray[k++] & 0xff,
      pixelArray[k++] & 0xff,
      pixelArray[k++] & 0xff
    );
    usedEntry[index] = true;
    indexedPixels[j] = index;
  }

  pixels = null;
  colorDepth = 8;
  palSize = 7;

  if(callback){
    callback();
  }
};

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

function createGifHeader(){
  console.log('createGifHeader()');
  gif = new ByteArray();
  //header
  gif.writeUTFBytes("GIF89a");
  //Logical Screen Descriptor
  gif.writeShort(width);
  gif.writeShort(height);
    // packed fields
  gif.writeByte(
    0x80 | // 1 : global color table flag = 1 (gct used)
    0x70 | // 2-4 : color resolution = 7
    0x00 | // 5 : gct sort flag = 0
    7 // 6-8 : gct size, 7 = 256 colors used
  );

  gif.writeByte(0); // background color index
  gif.writeByte(0); // pixel aspect ratio - assume 1:1

  // Global Color Table
  // each color = 3 bytes of color = R G B
  // we have 256 colors defined in LSD

  writeColorTable(gif);

  gifHeader = byteArrayToBuffer(gif);

  createFrame();
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

  // convert latest image to  pixelData
  PNG.decode('test'+count+'.png',function(pixels){
    createFrameFromPixels(pixels);

    // build colorTable if it's not the first frame
    if(firstFrame === false){
      writeColorTable(frame);

    }
    firstFrame = false;

    var enc = new LZWEncoder(width, height, indexedPixels,colorDepth);
    enc.encode(frame);

    addLoop(frame);

    //closing block for the gif, no more frames at this point
    frame.writeByte(0x3b);

    currentFrame = byteArrayToBuffer(frame);

  })
}

function byteArrayToBuffer(byteArray){
  console.log('byteArray length:',byteArray.data.length);
  var buffer = new Buffer(byteArray.data.length);
  console.log(byteArray.data[0]);
  for(var i = 0; i < byteArray.data.length; i++){
    buffer[i] = byteArray.data[i];
  }
  console.log(buffer[0]);
  return buffer;
}

function writeColorTable(byteArray){
  byteArray.writeBytes(colorTab);
  var n = (3 * 256) - colorTab.length;
  for (var i = 0; i < n; i++)
    byteArraywriteByte(0);
}

function addLoop(byteArray){
  byteArray.writeByte(0x21); // extension introducer
  byteArray.writeByte(0xff); // app extension label
  byteArray.writeByte(11); // block size
  byteArray.writeUTFBytes('NETSCAPE2.0'); // app id + auth code
  byteArray.writeByte(3); // sub-block size
  byteArray.writeByte(1); // loop sub-block id
  byteArray.writeShort(repeat); // loop count (extra iterations, 0=repeat forever)
  byteArray.writeByte(0); // block terminator
}

function init(){
  //createImage(createGifHeader); // create initial image and color table
  http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'image/gif'});
    /*
    subscribers.push(res);
    console.log('New subscriber: ' + subscribers.length + " total.\n")
    subscribers.push(res);
    console.log(gifHeader[0]);
    console.log(currentFrame);

    fs.writeFile('server2.gif', gifHeader + currentFrame, function(err){
        if(err){
          console.log(err);
        }

    })
    res.write(gifHeader + currentFrame);
    req.on('close', function() {
        exited = true;
        res.end();
        subscribers.remove(res);
        console.log('Subscriber left: ' + subscribers.length + " total.\n");
      });*/

    var str = "47 49 46 38 39 61 0A 00 0A 00 91 00 00 FF FF FF FF 00 00 00 00 FF 00 00 00 21 F9 04 00 00 00 00 00 2C 00 00 00 00 0A 00 0A 00 00 02 16 8C 2D 99 87 2A 1C DC 33 A0 02 75 EC 95 FA A8 DE 60 8C 04 91 4C 01 00 3B"

    var strArr = str.split(' ','');

    var buffer = new Buffer(strArr.length);
    for(var i = 0; i < strArr.length; i++){
      buffer[i] = Number(strArr[i]);
    }
    res.write(buffer);
  }).listen(8080, '0.0.0.0');
}



Array.prototype.remove = function(e) {
  for (var i = 0; i < this.length; i++) {
    if (e == this[i]) { return this.splice(i, 1); }
  }
};

init();

console.log('Server running at http://127.0.0.1:8080/'); 
