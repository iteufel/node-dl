//The MIT License (MIT)
//Copyright (c) 2016 Allan Amstadt
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var fs = require('fs')
var path = require('upath')
var events  = require('events');
var util    = require('util');
var request = require('request');

function Download(options) {
  events.EventEmitter.call( this );
  var active = false
  var self = this
  this.url = null;
  this.name = ""
  this.resume = true
  for (i in options) {
    this[i] = options[i]
  }
  this.size = {
    estimated : 0,
    downloaded : 0
  }
  this.time = {
    start : new Date(),
    estimated : 0
  }
  this.options = {headers:{}}
  this.request = null
  if (typeof options.path == "string")
    this.path = options.path
  else {
    this.path = ""
  }
  Object.defineProperty(this, "active", {
    get: function () {
      return active
    }
  })
  this.stop = function () {}
  Object.defineProperty(this, "done", {get:function () {
    return (this.size.downloaded == this.size.estimated)
  }})
}

util.inherits( Download, events.EventEmitter );

Download.prototype.abort = function () {
  if (this.request) {
    this.request.abort()
  }
}

Download.prototype._doHeadRequest = function (callback) {
  var opts = JSON.parse(JSON.stringify(this.options))
  opts.method = "HEAD"
  request(opts,function (err,response) {
    if (!err) {
      callback(response)
    }
    else {
      callback(false)
    }
  })
}


Download.prototype._updateProgress = function () {
  this.emit("progress",this)
}

Download.prototype.start = function () {
  var self = this
  this.options.url = this.url
  if (typeof this.headers == "object") {
    for (i in this.headers) {
      this.options.headers[i] = this.headers[i]
    }
  }
  if (typeof this.path == "undefined" || this.path.length <= 0) {
    this.path = __dirname
  }
  this._doHeadRequest(function (response) {
    if (response) {
      if (self.name.length <= 0) {
        var name = "UNKNOWN"
        if (typeof response.headers["Content-Disposition"] == "string") {
          name = response.headers["Content-Disposition"].split(";").pop().trim()
        }else {
          name = response.req.path.split("/").pop()
        }
        self.name = name
      }
      self.file = path.join(self.path, self.name)
      if (self.resume) {
        try{
          var stat = fs.statSync(self.file)
          self.size.downloaded = stat.size
        }catch(e){self.size.downloaded = 0}
      }
      if (parseInt(response.headers["content-length"]) == self.size.downloaded) {
        self.emit("end")
      }else {
        self._download()
      }
    }
  })
  return this
}

Download.prototype._download = function () {
  var self = this
  this.active = true
  if (this.resume) {
    this.options.headers["Range"] = "bytes="+self.size.downloaded+"-"
  }
  var writeStream;
  var progressInterval;
  this.request = request(this.options)
  .on('response', function(response) {
    self.size.estimated = parseInt(response.headers["content-length"]) + self.size.downloaded
    self._writeStream = fs.createWriteStream(path.join(self.path, self.name),{flags: self.resume ? "a" : "w"})
    progressInterval = setInterval(function () {self._updateProgress()}, 500)
  })
  .on('end', function () {
    clearInterval(progressInterval)
    self._updateProgress()
    self.emit("end",null)
  }).on('error', function (e) {
    clearInterval(progressInterval)
    self._updateProgress()
    self.emit("error",e)
  }).on('data', function (data) {
    self._writeStream.write(data)
    self.emit("data",data)
    self.size.downloaded += data.length
  })
  self.emit("start",null)
}

module.exports = Download