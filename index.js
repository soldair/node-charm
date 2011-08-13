var tty = require('tty');
var encode = require('./lib/encode');
var EventEmitter = require('events').EventEmitter;

var exports = module.exports = function () {
    var input = null;
    function setInput (s) {
        if (input) throw new Error('multiple inputs specified')
        else input = s
    }
    
    var output = null;
    function setOutput (s) {
        if (output) throw new Error('multiple outputs specified')
        else output = s
    }
    
    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if (!arg) continue;
        if (arg.readable) setInput(arg)
        if (arg.writable) setOutput(arg)
        if (arg.stdin || arg.input) setInput(arg.stdin || arg.input)
        if (arg.stdout || arg.output) setOutput(arg.stdout || arg.output)
    }
    
    return new Charm(input, output);
};

function Charm (input, output) {
    var self = this;
    self.input = input;
    self.output = output;
    self.pending = [];
    
    if (input === process.stdin) {
        tty.setRawMode(true);
        input.resume();
    }
    
    if (input) {
        input.on('data', function (buf) {
            if (self.pending.length && buf[0] === 27) {
                for (var i = 0; i < self.pending.length; i++) {
                    var cb = self.pending[0];
                    if (cb(buf)) {
                        self.pending.shift();
                        return;
                    }
                }
            }
            
            self.emit('data', buf)
        });
    }
}

Charm.prototype = new EventEmitter;

Charm.prototype.position = function (x, y) {
    if (!this.output) {
        this.emit('error', new Error(
            'output stream required to query position'
        ));
    }
    else if (typeof x === 'function') {
        var cb = x;
        this.output.write(encode('[6n'));
        this.pending.push(function (buf) {
            if (buf[0] === 27 && buf[1] === encode.ord('[')
            && buf[buf.length-1] === encode.ord('R')) {
                var pos = buf.toString()
                    .slice(2,-1)
                    .split(';')
                    .map(Number)
                ;
                cb(pos[0], pos[1]);
                return true;
            }
        });
    }
    else {
        this.output.write(encode('[' + x + ';' + y + 'f'));
    }
    return this;
};

Charm.prototype.destroy = function () {
    if (this.input) this.input.destroy()
};
