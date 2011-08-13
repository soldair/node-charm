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
    
    if (!output) {
        self.emit('error', new Error('output stream required'));
    }
    
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
    // get/set absolute coordinates
    if (typeof x === 'function') {
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
                cb(pos[1], pos[0]);
                return true;
            }
        });
    }
    else {
        this.output.write(encode('[' + y + ';' + x + 'f'));
    }
    return this;
};

Charm.prototype.move = function (x, y) {
    // set relative coordinates
    var bufs = [];
    
    if (y < 0) this.up(-y)
    else if (y > 0) this.down(y)
    
    if (x > 0) this.right(x)
    else if (x < 0) this.left(-x)
    
    return this;
};

Charm.prototype.up = function (y) {
    this.output.write(encode('[' + Math.floor(y) + 'A'));
    return this;
};

Charm.prototype.down = function (y) {
    this.output.write(encode('[' + Math.floor(y) + 'B'));
    return this;
};

Charm.prototype.right = function (x) {
    this.output.write(encode('[' + Math.floor(x) + 'C'));
    return this;
};

Charm.prototype.left = function (x) {
    this.output.write(encode('[' + Math.floor(x) + 'D'));
    return this;
};

Charm.prototype.push = function (withAttributes) {
    this.output.write(encode(withAttributes ? '7' : '[s'));
};

Charm.prototype.pop = function (withAttributes) {
    this.output.write(encode(withAttributes ? '8' : '[u'));
};

Charm.prototype.destroy = function () {
    if (this.input) this.input.destroy()
};
