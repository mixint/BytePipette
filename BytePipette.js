const fs = require('fs')
const Transflect = require('@mixint/transflect')
const extraStat = require('@mixint/extrastat')

/**
 * @extends Transflect
 *
 */
module.exports = class BytePipette extends Transflect {

    constructor(){ super() }

    /**
     * @param {ParsedMessage} source
     * @return {(ReadStream|undefined)}
     *
     * _open will try to match 'bytes 0-100', 'bytes 100-' etc from 'Content-Range'
     * if bytesRange.test fails to match a pattern / Content-Range is undefined, stream whole file.
     *
     * if the request method was HEAD, don't open a stream, if it was GET, open file readstream 
     * if opening the stream throws an error, hand it to destroy - get caught by serverfailsoft, it'll know what to do.
     */
    _open(source){
        let bytesRange = /^bytes\s(\d{1,})-(\d*)$/

        if(bytesRange.test(source.headers['content-range'])){
            let [match, start, end] = source.headers['content-range'].match(bytesRange).map(Number)
            this.range = { start, end: end || Infinity }
            console.log(this.range)
            this.statusCode = 206
        } else {
            this.range = {start: 0, end: Infinity}
            this.statusCode = 200
        }

        if(/GET/i.test(source.method)){
            try {
                return this.stream = fs.createReadStream(source.pathname, this.range)
            } catch(error){
                // can't synchronously emit errors here!
                // _open is called on pipe from source, before a destination is piped to
                // no destination, no one to receive the error. put the error on the event stack:
                process.nextTick(() => this.destroy(error))
            }
        }
    }

    _flush(done){
        extraStat(this.source.pathname, (error, stat) => {
            if(error) return this.destroy(error)

            let headers = {
                'Connection': 'close',
                'Accept-Ranges' : 'bytes',
                'Content-Length': stat.filestat.size,    
                'Content-Type'  : stat.mimetype,
                'x-Content-Mode': stat.filemode,
                'x-Mode-Owner'  : stat.filestat.uid,
                'x-Mode-Group'  : stat.filestat.gid,
            }

            let { start, end } = this.range
            let { size } = stat.filestat

            if(start != 0 || end != Infinity){
                if(end == Infinity){ end = size }

                Object.assign(headers, {
                    'Content-Range': `bytes ${start}-${end - 1}/${size}`,
                    'Content-Length': end - start,
                })
            }

            this.writeHead(this.statusCode, headers)

            // if there's a stream, pipe data to client, else, close connection via done(null)
            this.stream ? this.stream.on('data', data => {
                this.push(data) || (this.stream.pause(), this.pipes.on('drain', () => this.stream.resume()))
            }).on('error', done).on('end', done) : done()
        })
    }
}
