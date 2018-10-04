let transflect = require('@mixint/transflect')
let fs = require('fs')
let mimemap = require('@mixint/mimemap')

/**
 * @extends Transflect
 *
 */
module.exports = class PipetteReader extends Transflect {

    constructor(opt){ super(opt) }

    /**
     * @param {ParsedMessage} source
     * @return {ReadStream}
     */
    _open(source){
        let rangeMatch = /^bytes=(\d{1,})-(\d*)$/
        let [match, start, end] = [null, 0, Infinity] //defaults for no match

        if(rangeMatch.test(source.headers.range)){
            [match, start, end] = source.headers.range.match(rangeMatch).map(Number) // coerced match to type Number
            this.setHeader('Content-Length', (end || stat.size) - start)
            this.setHeader('Content-Range', `bytes ${start}-${end || stat.size - 1}/${stat.size}`)
            this.statusCode = 206
        }

        /* what happens if I call createReadStream with invalid range? Can I just propogate that instead of making my own? */
        /* if the request method was HEAD, don't open a stream, if it was GET, open file readstream */
        if(/HEAD/i.test(souce.method)){
            return null
        } else {
            return this.stream = fs.createReadStream(source.pathname, {start, end})
        }
    }

    _flush(done){
        mimemap.extraStat(this.source.pathname, (error, stat) => {
            if(error) return this.destroy(error)

            this.writeHead(200, {
                'Accept-Ranges' : 'bytes',
                'Content-Length': stat.filestat.size,
                'Content-Type'  : stat.mimetype,
                'x-Content-Mode': stat.filemode,
                'x-Mode-Owner'  : stat.filestat.uid,
                'x-Mode-Group'  : stat.filestat.gid,
            })

            // if there's a stream, pipe data to client, else, close connection via done(null)
            this.stream ? this.stream.on('data', data => {
                this.push(data) || (this.stream.pause(), this.pipes.on('drain', () => this.stream.resume()))
            }).on('end', done) : done()
        })
    }
}
