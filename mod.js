/**
* file: mod.js
* ver: 1.0.7
* update: 2014/4/14
*
* https://github.com/zjcqoo/mod
*/
var require, define;

(function(global) {
    var head = document.getElementsByTagName('head')[0],
        loadingMap = {},    //loadScript的回调函数updateNeed
        factoryMap = {},    //模块id对应的factory方法
        modulesMap = {},    //模块id对应的factory返回的结果
        scriptsMap = {},    //已经加载到head的script脚本
        resMap = {},        //资源依赖对象
        pkgMap = {};        //包依赖对象


    function createScript(url, onerror) {
        if (url in scriptsMap) return;
        scriptsMap[url] = true;

        var script = document.createElement('script');
        if (onerror) {
            var tid = setTimeout(onerror, require.timeout);

            script.onerror = function() {
                clearTimeout(tid);
                onerror();
            };

            function onload() {
                clearTimeout(tid);
            }

            if ('onload' in script) {
                script.onload = onload;
            }
            //兼容IE
            else {
                script.onreadystatechange = function() {
                    if (this.readyState == 'loaded' || this.readyState == 'complete') {
                        onload();
                    }
                }
            }
        }
        script.type = 'text/javascript';
        script.src = url;
        head.appendChild(script);
        return script;
    }

    function loadScript(id, callback, onerror) {
        var queue = loadingMap[id] || (loadingMap[id] = []);
        //放入回调函数updateNeed
        queue.push(callback);

        //
        // resource map query
        //
        var res = resMap[id] || {};
        var pkg = res.pkg;
        var url;

        if (pkg) {
            url = pkgMap[pkg].url;
        } else {
            url = res.url || id;
        }

        createScript(url, onerror && function() {
            onerror(id);
        });
    }

    define = function(id, factory) {
        //将方法存储到工厂里
        factoryMap[id] = factory;

        //loadingMap是什么
        var queue = loadingMap[id];
        if (queue) {
            //这里循环遍历n次，实际上只执行了最后一次
            for(var i = 0, n = queue.length; i < n; i++) {
                console.log('two');
                queue[i]();
            }
            delete loadingMap[id];
        }
    };

    require = function(id) {
        id = require.alias(id);

        //如果存在多次require相同module,则这里会直接执行
        var mod = modulesMap[id];
        if (mod) {
            return mod.exports;
        }

        //
        // init module
        //
        var factory = factoryMap[id];
        if (!factory) {
            throw '[ModJS] Cannot find module `' + id + '`';
        }

        mod = modulesMap[id] = {
            exports: {}
        };

        //
        // factory: function OR value {对象}
        //
        var ret = (typeof factory == 'function')
                ? factory.apply(mod, [require, mod.exports, mod])
                : factory;

        if (ret) {
            mod.exports = ret;
        }
        return mod.exports;
    };

    //async的调用不需要define.
    //先把js通过script添加到head中，再load
    require.async = function(names, onload, onerror) {
        //传入的names可以为数组，统一做数组处理
        if (typeof names == 'string') {
            names = [names];
        }
        console.log(names);
        for(var i = 0, n = names.length; i < n; i++) {
            names[i] = require.alias(names[i]);
        }

        var needMap = {};
        var needNum = 0;

        function findNeed(depArr) {
            for(var i = 0, n = depArr.length; i < n; i++) {
                //
                // skip loading or loaded
                //
                var dep = depArr[i];
                //如果已经存在factory中或已加载，则继续
                if (dep in factoryMap || dep in needMap) {
                    continue;
                }

                needMap[dep] = true;
                needNum++;
                loadScript(dep, updateNeed, onerror);

                //查找deps依赖模块，加载到head中
                var child = resMap[dep];
                if (child && 'deps' in child) {
                    findNeed(child.deps);
                }
            }
        }
        //运行factory方法，传入require返回的export
        function updateNeed() {
            console.log('each');
            if (0 == needNum--) {
                var args = [];
                for(var i = 0, n = names.length; i < n; i++) {
                    args[i] = require(names[i]);
                }
                console.log(args);
                console.log('one');
                onload && onload.apply(global, args);
            }
        }
       
        findNeed(names);
        //加载完所有依赖后执行回调
        updateNeed();
    };

    require.resourceMap = function(obj) {
        var k, col;

        // merge `res` & `pkg` fields
        col = obj.res;
        for(k in col) {
            if (col.hasOwnProperty(k)) {
                resMap[k] = col[k];
            }
        }

        col = obj.pkg;
        for(k in col) {
            if (col.hasOwnProperty(k)) {
                pkgMap[k] = col[k];
            }
        }
    };

    require.loadJs = function(url) {
        createScript(url);
    };

    require.loadCss = function(cfg) {
        if (cfg.content) {
            var sty = document.createElement('style');
            sty.type = 'text/css';
           
            if (sty.styleSheet) {       // IE
                sty.styleSheet.cssText = cfg.content;
            } else {
                sty.innerHTML = cfg.content;
            }
            head.appendChild(sty);
        }
        else if (cfg.url) {
            var link = document.createElement('link');
            link.href = cfg.url;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            head.appendChild(link);
        }
    };

    //可重写
    require.alias = function(id) {return id};

    require.timeout = 5000;
   
})(this);