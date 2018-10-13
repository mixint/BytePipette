let BytePipette = require('../BytePipette')
let http = require('http')

http.createServer({
    IncomingMessage: require('parsedmessage'),
    ServerResponse: require('serverfailsoft'),
}, (req, res) => {
	console.log(req.headers)
    req.pipe(new BytePipette).pipe(res)
}).listen(3000)