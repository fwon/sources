// JSDeferred 0.4.0 Copyright (c) 2007 cho45 ( www.lowreal.net )
// See http://github.com/cho45/jsdeferred
function Deferred () { return (this instanceof Deferred) ? this.init() : new Deferred() }
Deferred.ok = function (x) { return x };
Deferred.ng = function (x) { throw  x };
Deferred.prototype = {
    
    _id : 1111,

    
    init : function () {
        this._next    = null;
        this.callback = {
            ok: Deferred.ok,
            ng: Deferred.ng
        };
        return this;
    },

    // 当new Deferred()时，会调用该next函数
    next  : function (fun) { 
        //this为第一个next返回的deferred，这里写死了ok
        return this._post("ok", fun) },

    
    error : function (fun) { return this._post("ng", fun) },

    // call的参数会传给本Deferred的callback,也即next中的function
    call  : function (val) { 
        //这里写死了ok
        // console.log('call ' + val);
        return this._fire("ok", val) },

    
    fail  : function (err) { return this._fire("ng", err) },

    
    cancel : function () {
        (this.canceller || function () {})();
        return this.init();
    },

    _post : function (okng, fun) {
        this._next =  new Deferred();
        this._next.callback[okng] = fun;
        // 返回this._next，形成链式调用
        return this._next;
    },

    _fire : function (okng, value) {
        var next = "ok";
        try {
            value = this.callback[okng].call(this, value);
            // console.log(value);
        } catch (e) {
            next  = "ng";
            value = e;
            if (Deferred.onerror) Deferred.onerror(e);
        }
        if (Deferred.isDeferred(value)) {
            // 此时value为wait,wait执行后再执行_next(如果value为deferred对象，则先执行其call方法，延迟this._next)
            value._next = this._next;
        } else {
            // console.log('not deferred');
            if (this._next) this._next._fire(next, value);
        }
        return this;
    }
};
Deferred.isDeferred = function (obj) {
    return !!(obj && obj._id === Deferred.prototype._id);
};

Deferred.next_default = function (fun) {
    var d = new Deferred();
    var id = setTimeout(function () { d.call() }, 0);
    d.canceller = function () { clearTimeout(id) };
    if (fun) d.callback.ok = fun;
    return d;
};
Deferred.next_faster_way_readystatechange = ((typeof window === 'object') && (location.protocol == "http:") && !window.opera && /\bMSIE\b/.test(navigator.userAgent)) && function (fun) {
    var d = new Deferred();
    var t = new Date().getTime();
    if (t - arguments.callee._prev_timeout_called < 150) {
        var cancel = false;
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src  = "data:text/javascript,";
        script.onreadystatechange = function () {
            if (!cancel) {
                d.canceller();
                d.call();
            }
        };
        d.canceller = function () {
            if (!cancel) {
                cancel = true;
                script.onreadystatechange = null;
                document.body.removeChild(script);
            }
        };
        document.body.appendChild(script);
    } else {
        arguments.callee._prev_timeout_called = t;
        var id = setTimeout(function () { d.call() }, 0);
        d.canceller = function () { clearTimeout(id) };
    }
    if (fun) d.callback.ok = fun;
    return d;
};
Deferred.next_faster_way_Image = ((typeof window === 'object') && (typeof(Image) != "undefined") && !window.opera && document.addEventListener) && function (fun) {
    //这里是new Deferred，获得了prototype中的方法
    var d = new Deferred();
    var img = new Image();
    var handler = function () {
        d.canceller();
        //链式完next后，才执行第一个next的call
        d.call();
    };
    img.addEventListener("load", handler, false);
    img.addEventListener("error", handler, false);
    d.canceller = function () {
        img.removeEventListener("load", handler, false);
        img.removeEventListener("error", handler, false);
    };
    img.src = "data:image/png," + Math.random();
    if (fun) d.callback.ok = fun;
    // console.log('first');
    return d;
};
//nodejs
Deferred.next_tick = (typeof process === 'object' && typeof process.nextTick === 'function') && function (fun) {
    var d = new Deferred();
    process.nextTick(function() { d.call() });
    if (fun) d.callback.ok = fun;
    return d;
};

// 当使用Deferred.define()时，会调用该next函数
Deferred.next = 
    Deferred.next_faster_way_readystatechange ||
    Deferred.next_faster_way_Image ||
    Deferred.next_tick ||
    Deferred.next_default;

// 将多个函数拚装成next next next的形式
Deferred.chain = function () {
    var chain = Deferred.next();
    for (var i = 0, len = arguments.length; i < len; i++) (function (obj) {
        switch (typeof obj) {
            case "function":
                var name = null;
                try {
                    name = obj.toString().match(/^\s*function\s+([^\s()]+)/)[1];
                } catch (e) { }
                if (name != "error") {
                    chain = chain.next(obj);
                } else {
                    chain = chain.error(obj);
                }
                break;
            case "object":
                chain = chain.next(function() { return Deferred.parallel(obj) });
                break;
            default:
                throw "unknown type in process chains";
        }
    })(arguments[i]);
    return chain;
};

Deferred.wait = function (n) {
    var d = new Deferred(), t = new Date();
    var id = setTimeout(function () {
        // console.log('wait');
        d.call((new Date()).getTime() - t.getTime());
    }, n * 1000);
    d.canceller = function () { clearTimeout(id) };
    //先返回再执行
    // console.log('return wait');
    return d;
};

Deferred.call = function (fun) {
    var args = Array.prototype.slice.call(arguments, 1);
    return Deferred.next(function () {
        return fun.apply(this, args);
    });
};

Deferred.parallel = function (dl) {
    // dl传进来的时候已经是返回了Deferred对象，也就是已经执行了
    var isArray = false;
    // console.log('here');
    if (arguments.length > 1) {
        dl = Array.prototype.slice.call(arguments);
        isArray = true;
    } else if (Array.isArray && Array.isArray(dl) || typeof dl.length == "number") {
        isArray = true;
    }
    var ret = new Deferred(), values = {}, num = 0;
    // 将parallel的数组封装为一个链
    for (var i in dl) if (dl.hasOwnProperty(i)) (function (d, i) {
        // if (typeof d == "function") {
        //     console.log('function');
        //     dl[i] = d = Deferred.next(d);
        // }
        // console.log('start');
        d.next(function (v) {
            values[i] = v;
            // console.log('num='+num);
            if (--num <= 0) {
                if (isArray) {
                    values.length = dl.length;
                    values = Array.prototype.slice.call(values, 0);
                }
                // console.log('ret call');
                // 循环运行到最后才执行call,并传入所有结果
                ret.call(values);
            }
            // console.log('num='+num);
        //error是next的this._next
        }).error(function (e) {
            ret.fail(e);
        });
        // console.log('end');
        num++;
    })(dl[i], i);
    // console.log('!num start');
    if (!num) {
        // console.log('next next');
        Deferred.next(function () { ret.call() });
    }
    // console.log('!num end');
    ret.canceller = function () {
        for (var i in dl) if (dl.hasOwnProperty(i)) {
            dl[i].cancel();
        }
    };
    // console.log('return');
    return ret;
};

// 最先执行的deferred将会传入value给next,然后调用canceller取消其他deferred
Deferred.earlier = function (dl) {
    var isArray = false;
    if (arguments.length > 1) {
        dl = Array.prototype.slice.call(arguments);
        isArray = true;
    } else if (Array.isArray && Array.isArray(dl) || typeof dl.length == "number") {
        isArray = true;
    }
    var ret = new Deferred(), values = {}, num = 0;
    for (var i in dl) if (dl.hasOwnProperty(i)) (function (d, i) {
        d.next(function (v) {
            values[i] = v;
            if (isArray) {
                values.length = dl.length;
                values = Array.prototype.slice.call(values, 0);
            }
            ret.call(values);
            //取消其他deferred
            ret.canceller();
        }).error(function (e) {
            ret.fail(e);
        });
        num++;
    })(dl[i], i);

    if (!num) Deferred.next(function () { ret.call() });
    ret.canceller = function () {
        for (var i in dl) if (dl.hasOwnProperty(i)) {
            dl[i].cancel();
        }
    };
    return ret;
};


Deferred.loop = function (n, fun) {
    var o = {
        begin : n.begin || 0,
        end   : (typeof n.end == "number") ? n.end : n - 1,
        step  : n.step  || 1,
        last  : false,
        prev  : null
    };
    var ret, step = o.step;
    return Deferred.next(function () {
        function _loop (i) {
            if (i <= o.end) {
                if ((i + step) > o.end) {
                    o.last = true;
                    o.step = o.end - i + 1;
                }
                o.prev = ret;
                ret = fun.call(this, i, o);
                // 如果外面的loop方法的function参数返回的是deferred对象，执行下面操作
                if (Deferred.isDeferred(ret)) {
                    // 等待外面有call调用时，下面的next就会执行，否则不会执行
                    return ret.next(function (r) {
                        ret = r;
                        return Deferred.call(_loop, i + step);
                    });
                } else {
                    return Deferred.call(_loop, i + step);
                }
            } else {
                return ret;
            }
        }
        return (o.begin <= o.end) ? Deferred.call(_loop, o.begin) : null;
    });
};

// 没20ms执行一次，防止柱塞UI线程
Deferred.repeat = function (n, fun) {
    var i = 0, end = {}, ret = null;
    return Deferred.next(function () {
        // alert('call one');
        var t = (new Date()).getTime();
        do {
            if (i >= n) return null;
            ret = fun(i++);
        } while ((new Date()).getTime() - t < 20);
        // arguments.callee不断地调用next中的function方法，即多次执行do while, 确保每次循环在20ms内
        return Deferred.call(arguments.callee);
    });
};

// 添加注册方法到Deferred的prototype中
Deferred.register = function (name, fun) {
    this.prototype[name] = function () {
        var a = arguments;
        return this.next(function () {
            return fun.apply(this, a);
        });
    };
};

Deferred.register("loop", Deferred.loop);
Deferred.register("wait", Deferred.wait);

Deferred.connect = function (funo, options) {
    var target, func, obj;
    if (typeof arguments[1] == "string") {
        target = arguments[0];
        func   = target[arguments[1]];
        obj    = arguments[2] || {};
    } else {
        func   = arguments[0];
        obj    = arguments[1] || {};
        target = obj.target;
    }

    var partialArgs       = obj.args ? Array.prototype.slice.call(obj.args, 0) : [];
    var callbackArgIndex  = isFinite(obj.ok) ? obj.ok : obj.args ? obj.args.length : undefined;
    var errorbackArgIndex = obj.ng;

    return function () {
        var d = new Deferred().next(function (args) {
            var next = this._next.callback.ok;
            this._next.callback.ok = function () {
                return next.apply(this, args.args);
            };
        });

        var args = partialArgs.concat(Array.prototype.slice.call(arguments, 0));
        if (!(isFinite(callbackArgIndex) && callbackArgIndex !== null)) {
            callbackArgIndex = args.length;
        }
        var callback = function () { d.call(new Deferred.Arguments(arguments)) };
        args.splice(callbackArgIndex, 0, callback);
        if (isFinite(errorbackArgIndex) && errorbackArgIndex !== null) {
            var errorback = function () { d.fail(arguments) };
            args.splice(errorbackArgIndex, 0, errorback);
        }
        Deferred.next(function () { func.apply(target, args) });
        return d;
    };
};
Deferred.Arguments = function (args) { this.args = Array.prototype.slice.call(args, 0) };

Deferred.retry = function (retryCount, funcDeferred, options) {
    if (!options) options = {};

    var wait = options.wait || 0;
    var d = new Deferred();
    var retry = function () {
        var m = funcDeferred(retryCount);
        m.
            next(function (mes) {
                // 执行到这里说明函数执行成功，所以执行了next到达这里，接着d.call执行后就能执行到外层的next了，即retry成功
                d.call(mes);
            }).
            error(function (e) {
                if (--retryCount <= 0) {
                    d.fail(['retry failed', e]);
                } else {
                    // 继续retry
                    setTimeout(retry, wait * 1000);
                }
            });
    };
    setTimeout(retry, 0);
    return d;
};

Deferred.methods = ["parallel", "wait", "next", "call", "loop", "repeat", "chain"];
Deferred.define = function (obj, list) {
    if (!list) list = Deferred.methods;
    // 不传obj则闭包执行，将方法都赋给window
    if (!obj)  obj  = (function getGlobal () { return this })();
    for (var i = 0; i < list.length; i++) {
        var n = list[i];
        //赋值给this,全局变量
        obj[n] = Deferred[n];
    }
    return Deferred;
};

this.Deferred = Deferred;