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
        else if (arg.stdin || arg.input) setInput(arg.stdin || arg.input)
        
        if (arg.writable) setOutput(arg)
        else if (arg.stdout || arg.output) setOutput(arg.stdout || arg.output)
        
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

Charm.prototype.destroy = function () {
    if (this.input) this.input.destroy()
};

Charm.prototype.write = function (msg) {
    this.output.write(msg);
    return this;
};

Charm.prototype.reset = function (cb) {
    this.write(encode('c'));
    return this;
};

Charm.prototype.position = function (x, y) {
    // get/set absolute coordinates
    if (typeof x === 'function') {
        var cb = x;
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
        this.write(encode('[6n'));
    }
    else {
        this.write(encode(
            '[' + Math.floor(y) + ';' + Math.floor(x) + 'f'
        ));
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
    this.write(encode('[' + Math.floor(y) + 'A'));
    return this;
};

Charm.prototype.down = function (y) {
    this.write(encode('[' + Math.floor(y) + 'B'));
    return this;
};

Charm.prototype.right = function (x) {
    this.write(encode('[' + Math.floor(x) + 'C'));
    return this;
};

Charm.prototype.left = function (x) {
    this.write(encode('[' + Math.floor(x) + 'D'));
    return this;
};

Charm.prototype.push = function (withAttributes) {
    this.write(encode(withAttributes ? '7' : '[s'));
    return this;
};

Charm.prototype.pop = function (withAttributes) {
    this.write(encode(withAttributes ? '8' : '[u'));
    return this;
};

Charm.prototype.erase = function (s) {
    if (s === 'end' || s === '$') {
        this.write(encode('[K'));
    }
    else if (s === 'start' || s === '^') {
        this.write(encode('[1K'));
    }
    else if (s === 'line') {
        this.write(encode('[2K'));
    }
    else if (s === 'down') {
        this.write(encode('[J'));
    }
    else if (s === 'up') {
        this.write(encode('[1J'));
    }
    else if (s === 'screen') {
        this.write(encode('[1J'));
    }
    else {
        this.emit('error', new Error('Unknown erase type: ' + s));
    }
    return this;
};

Charm.prototype.display = function (attr) {
    var c = {
        reset : 0,
        bright : 1,
        dim : 2,
        underscore : 4,
        blink : 5,
        reverse : 7,
        hidden : 8
    }[attr];
    if (c === undefined) {
        this.emit('error', new Error('Unknown attribute: ' + attr));
    }
    this.write(encode('[' + s + 'm'));
    return this;
};

Charm.prototype.foreground = function (color) {
    var c = {
        black : 30,
        red : 31,
        green : 32,
        yellow : 33,
        blue : 34,
        magenta : 35,
        cyan : 36,
        white : 37
    }[color.toLowerCase()];
    if (!c) this.emit('error', new Error('Unknown color: ' + color));
    
    this.write(encode('[' + c + 'm'));
    return this;
};

Charm.prototype.background = function (color) {
    var c = {
        black : 40,
        red : 41,
        green : 42,
        yellow : 43,
        blue : 44,
        magenta : 45,
        cyan : 46,
        white : 47
    }[color.toLowerCase()];
    if (!c) this.emit('error', new Error('Unknown color: ' + color));
    
    this.write(encode('[' + c + 'm'));
    return this;
};
