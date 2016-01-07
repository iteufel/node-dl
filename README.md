#node-dl

node-dl is a simple file downloader with resuming support.



	var Download = require("node-dl").download
  
	var dl = new Download({url:"..."})
		.on("start",function () {
    		console.log("start");
		})
		.on("progress",function(){
    		console.log(((100 / this.size.estimated) * this.size.downloaded).toFixed(0) + "%")
		})
		.on("end",function () {
			console.log("end" + this.file);
		})
		.start()
  
	setTimeout(function () {
		dl.abort()
	}, 5000)