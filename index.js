var path = require('path');

/*  Hack an instance of Argv with process.argv into Argv
    so people an do
        require('optimist')(['--beeble=1','-z','zizzle']).argv
    to parse a list of args and
        require('optimist').argv
    to get a parsed version of process.argv.
*/
var inst = Argv(process.argv.slice(2));
Object.keys(inst).forEach(function (key) {
    Argv[key] = typeof inst[key] == 'function'
        ? inst[key].bind(inst)
        : inst[key];
});

var exports = module.exports = Argv;
function Argv (args, cwd) {
    var self = {};
    if (!cwd) cwd = process.cwd();
    
    self.$0 = process.argv
        .slice(0,2)
        .map(function (x) {
            var b = rebase(cwd, x);
            return x.match(/^\//) && b.length < x.length
                ? b : x
        })
        .join(' ')
    ;
    
    if (process.argv[1] == process.env._) {
        self.$0 = process.env._.replace(
            path.dirname(process.execPath) + '/', ''
        );
    }
    
    var flags = { bools : {}, strings : {} };
    
    self.boolean = function (bools) {
        if (!Array.isArray(bools)) {
            bools = [].slice.call(arguments);
        }
        
        bools.forEach(function (name) {
            flags.bools[name] = true;
        });
        
        bools.forEach(function (name) {
            if (!self.argv[name]) {
                self.argv[name] = false;
            }
        });
        
        return self;
    };
    
    self.string = function (strings) {
        if (!Array.isArray(strings)) {
            strings = [].slice.call(arguments);
        }
        
        strings.forEach(function (name) {
            flags.strings[name] = true;
        });
        
        return self;
    };
    
    var aliases = {};
    self.alias = function (x, y) {
        if (typeof x === 'object') {
            Object.keys(x).forEach(function (key) {
                aliases[key] = x[key];
                aliases[x[key]] = key;
            });
        }
        else if (Array.isArray(y)) {
            y.forEach(function (yy) {
                self.alias(x, y);
            });
        }
        else {
            aliases[x] = y;
            aliases[y] = x;
        }
        
        return self;
    };
    
    var demanded = {};
    self.demand = function (keys, cb) {
        if (typeof keys == 'number') {
            if (!demanded._) demanded._ = 0;
            demanded._ += keys;
        }
        else if (Array.isArray(keys)) {
            keys.forEach(function (key) {
                self.demand(key);
            });
        }
        else {
            demanded[keys] = true;
        }
        
        return self;
    };
    
    var usage;
    self.usage = function (msg, opts) {
        if (!opts && typeof msg === 'object') {
            opts = msg;
            msg = null;
        }
        
        usage = msg;
        
        if (opts) self.options(opts);
        
        return self;
    };
    
    function fail (msg) {
        self.showHelp();
        if (msg) console.error(msg);
        process.exit(1);
    }
    
    self.check = function (f) {
        try {
            if (f(self.argv) === false) fail(
                'Argument check failed: ' + f.toString()
            );
        }
        catch (err) { fail(err) }
        
        return self;
    };
    
    var defaults = {};
    self.default = function (key, value) {
        if (typeof key === 'object') {
            Object.keys(key).forEach(function (k) {
                defaults[k] = key[k];
            });
        }
        else {
            defaults[key] = value;
        }
        
        return self;
    };
    
    self.parse = function (args) {
        return Argv(args).argv;
    };
    
    self.camelCase = function () {
        for (var key in self.argv) {
            var camelCasedKey = key.replace(/-([a-z])/g, function (_, c) {
                return c.toUpperCase();
            });
            
            if (camelCasedKey !== key) {
                self.argv[camelCasedKey] = self.argv[key];
                delete self.argv[key];
            }
        }
        return self;
    };
    
    function longestElement (a) {
        var l = 0;
        for (var i = 0; i < a.length; i++) {
            if (a[l].length < a[i].length) {
                l = i;
            }
        }

        return a[l].length;
    }
    
    self.options = function (key, opt) {
        if (typeof key === 'object') {
            Object.keys(key).forEach(function (k) {
                self.options(k, key[k]);
            });
        }
        else {
            var opt = opts[key];
            
            if (opt.alias) self.alias(key, opt.alias);
            if (opt.demand) self.demand(key);
            if (opt.default) self.default(key, opt.default);
            
            if (opt.boolean || opt.type === 'boolean') {
                self.boolean(key);
            }
            if (opt.string || opt.type === 'string') {
                self.string(key);
            }
            
            var desc = opt.describe || opt.description || opt.desc;
            if (desc) {
                self.describe(key, desc);
            }
        }
        
        return self;
    };
    
    self.showHelp = function (padding) {
        if (usage) {
            console.error(usage.replace(/\$0/g, self.$0));
        }
        
        if (self.options && Object.keys(self.options).length > 0) {
            var help = Object.keys(self.options).map(function (key) {
                var o = self.options[key];
                var hargs = [o.short, key]; 
                
                hargs = hargs.filter(function (a) { 
                    return a; 
                }).map(function (a) {
                    return a.length === 1 ? '-' + a : '--' + a;
                }).join(', ');
          
                return {
                    args: hargs,
                    description: o.description,
                    default: o.default
                };
            })
            
            padding = padding || 2;
            
            var larg = longestElement(help.map(function (h) { return h.args }));
            var described = help.filter(function (h) { return h.description });
            var more = help.filter(function (h) { return !h.description });
            
            function printOpt (h) {
              var hdesc = h.description || '';
          
              if (h.args.length < larg) {
                  h.args += new Array(larg - h.args.length + 1).join(' ');
              }
          
              if (padding) {
                  hdesc = new Array(padding + 1).join(' ') + hdesc;
              }
          
              return [
                  '  ' + h.args,
                  hdesc,
                  h.default ? '[' + h.default + ']' : ''
              ].join(' ');
            }
        
            if (described.length > 0) {
                console.log('options:');
                console.log(described.map(printOpt).join('\n'));
            }
        
            if (more.length > 0) {
                console.log('\nmore options:');
                console.log(more.map(printOpt).join('\n'));
            }
        }
    }
    
    Object.defineProperty(self, 'argv', {
        get : parseArgs,
        enumerable : true,
    });
    
    function parseArgs () {
        var argv = { _ : [], $0 : self.$0 };
        Object.keys(flags.bools).forEach(function (key) {
            setArg(key, false);
        });
        
        function setArg (key, val) {
            var num = Number(val);
            var value = typeof val !== 'string' || isNaN(num) ? val : num;
            if (flags.strings[key]) value = val;
            
            if (key in argv && !flags.bools[key]) {
                if (!Array.isArray(argv[key])) {
                    argv[key] = [ argv[key] ];
                }
                argv[key].push(value);
            }
            else {
                argv[key] = value;
            }
            
            if (aliases[key]) {
                argv[aliases[key]] = argv[key];
            }
        }
        
        for (var i = 0; i < args.length; i++) {
            var arg = args[i];
            
            if (arg === '--') {
                argv._.push.apply(argv._, args.slice(i + 1));
                break;
            }
            else if (arg.match(/^--.+=/)) {
                var m = arg.match(/^--([^=]+)=(.*)/);
                setArg(m[1], m[2]);
            }
            else if (arg.match(/^--no-.+/)) {
                var key = arg.match(/^--no-(.+)/)[1];
                setArg(key, false);
            }
            else if (arg.match(/^--.+/)) {
                var key = arg.match(/^--(.+)/)[1];
                var next = args[i + 1];
                if (next !== undefined && !next.match(/^-/)
                && !flags.bools[key]) {
                    setArg(key, next);
                    i++;
                }
                else {
                    setArg(key, true);
                }
            }
            else if (arg.match(/^-[^-]+/)) {
                var letters = arg.slice(1,-1).split('');
                
                var broken = false;
                for (var j = 0; j < letters.length; j++) {
                    if (letters[j+1] && letters[j+1].match(/\W/)) {
                        setArg(letters[j], arg.slice(j+2));
                        broken = true;
                        break;
                    }
                    else {
                        setArg(letters[j], true);
                    }
                }
                
                if (!broken) {
                    var key = arg.slice(-1)[0];
                    
                    if (args[i+1] && !args[i+1].match(/^-/)
                    && !flags.bools[key]) {
                        setArg(key, args[i+1]);
                        i++;
                    }
                    else {
                        setArg(key, true);
                    }
                }
            }
            else {
                var n = Number(arg);
                argv._.push(isNaN(n) ? arg : n);
            }
        }
        
        Object.keys(defaults).forEach(function (key) {
            if (!(key in argv)) {
                argv[key] = defaults[key];
            }
        });
        
        if (demanded._ && argv._.length < demanded._) {
            fail('Not enough non-option arguments: got '
                + argv._.length + ', need at least ' + demanded._
            );
        }
        
        var missing = [];
        Object.keys(demanded).forEach(function (key) {
            if (!argv[key]) missing.push(key);
        });
        
        if (missing.length) {
            fail('Missing required arguments: ' + missing.join(', '));
        }
        
        return argv;
    }
    
    return self;
};

// rebase an absolute path to a relative one with respect to a base directory
// exported for tests
exports.rebase = rebase;
function rebase (base, dir) {
    var ds = path.normalize(dir).split('/').slice(1);
    var bs = path.normalize(base).split('/').slice(1);
    
    for (var i = 0; ds[i] && ds[i] == bs[i]; i++);
    ds.splice(0, i); bs.splice(0, i);
    
    var p = path.normalize(
        bs.map(function () { return '..' }).concat(ds).join('/')
    ).replace(/\/$/,'').replace(/^$/, '.');
    return p.match(/^[.\/]/) ? p : './' + p;
}
