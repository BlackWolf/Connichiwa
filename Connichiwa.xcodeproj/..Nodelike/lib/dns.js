// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// 'Software'), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var net = require('net');
var util = require('util');

var cares = process.binding('cares_wrap');
var uv = process.binding('uv');

var isIp = net.isIP;


function errnoException(err, syscall, hostname) {
  // FIXME(bnoordhuis) Remove this backwards compatibility shite and pass
  // the true error to the user. ENOTFOUND is not even a proper POSIX error!
  if (err === uv.UV_EAI_MEMORY ||
      err === uv.UV_EAI_NODATA ||
      err === uv.UV_EAI_NONAME) {
    err = 'ENOTFOUND';
  }
  var ex = null;
  if (typeof err === 'string') {  // c-ares error code.
    ex = new Error(syscall + ' ' + err);
    ex.code = err;
    ex.errno = err;
    ex.syscall = syscall;
  } else {
    ex = util._errnoException(err, syscall);
  }
  if (hostname) {
    ex.hostname = hostname;
  }
  return ex;
}


// c-ares invokes a callback either synchronously or asynchronously,
// but the dns API should always invoke a callback asynchronously.
//
// This function makes sure that the callback is invoked asynchronously.
// It returns a function that invokes the callback within nextTick().
//
// To avoid invoking unnecessary nextTick(), `immediately` property of
// returned function should be set to true after c-ares returned.
//
// Usage:
//
// function someAPI(callback) {
//   callback = makeAsync(callback);
//   channel.someAPI(..., callback);
//   callback.immediately = true;
// }
function makeAsync(callback) {
  if (!util.isFunction(callback)) {
    return callback;
  }
  return function asyncCallback() {
    if (asyncCallback.immediately) {
      // The API already returned, we can invoke the callback immediately.
      callback.apply(null, arguments);
    } else {
      var args = arguments;
      process.nextTick(function() {
        callback.apply(null, args);
      });
    }
  };
}


function onlookup(err, addresses) {
  if (err) {
    return this.callback(errnoException(err, 'getaddrinfo', this.hostname));
  }
  if (this.family) {
    this.callback(null, addresses[0], this.family);
  } else {
    this.callback(null, addresses[0], addresses[0].indexOf(':') >= 0 ? 6 : 4);
  }
}


// Easy DNS A/AAAA look up
// lookup(hostname, [family,] callback)
exports.lookup = function(hostname, family, callback) {
  // parse arguments
  if (arguments.length === 2) {
    callback = family;
    family = 0;
  } else if (!family) {
    family = 0;
  } else {
    family = +family;
    if (family !== 4 && family !== 6) {
      throw new Error('invalid argument: `family` must be 4 or 6');
    }
  }
  callback = makeAsync(callback);

  if (!hostname) {
    callback(null, null, family === 6 ? 6 : 4);
    return {};
  }

  var matchedFamily = net.isIP(hostname);
  if (matchedFamily) {
    callback(null, hostname, matchedFamily);
    return {};
  }

  var req = {
    callback: callback,
    family: family,
    hostname: hostname,
    oncomplete: onlookup
  };
  var err = cares.getaddrinfo(req, hostname, family);
  if (err) throw errnoException(err, 'getaddrinfo', hostname);

  callback.immediately = true;
  return req;
};


function onresolve(err, result) {
  if (err)
    this.callback(errnoException(err, this.bindingName, this.hostname));
  else
    this.callback(null, result);
}


function resolver(bindingName) {
  var binding = cares[bindingName];

  return function query(name, callback) {
    callback = makeAsync(callback);
    var req = {
      bindingName: bindingName,
      callback: callback,
      hostname: name,
      oncomplete: onresolve
    };
    var err = binding(req, name);
    if (err) throw errnoException(err, bindingName);
    callback.immediately = true;
    return req;
  }
}


var resolveMap = {};
exports.resolve4 = resolveMap.A = resolver('queryA');
exports.resolve6 = resolveMap.AAAA = resolver('queryAaaa');
exports.resolveCname = resolveMap.CNAME = resolver('queryCname');
exports.resolveMx = resolveMap.MX = resolver('queryMx');
exports.resolveNs = resolveMap.NS = resolver('queryNs');
exports.resolveTxt = resolveMap.TXT = resolver('queryTxt');
exports.resolveSrv = resolveMap.SRV = resolver('querySrv');
exports.resolveNaptr = resolveMap.NAPTR = resolver('queryNaptr');
exports.resolveSoa = resolveMap.SOA = resolver('querySoa');
exports.reverse = resolveMap.PTR = resolver('getHostByAddr');


exports.resolve = function(hostname, type_, callback_) {
  var resolver, callback;
  if (util.isString(type_)) {
    resolver = resolveMap[type_];
    callback = callback_;
  } else {
    resolver = exports.resolve4;
    callback = type_;
  }

  if (util.isFunction(resolver)) {
    return resolver(hostname, callback);
  } else {
    throw new Error('Unknown type "' + type_ + '"');
  }
};


exports.getServers = function() {
  return cares.getServers();
};


exports.setServers = function(servers) {
  // cache the original servers because in the event of an error setting the
  // servers cares won't have any servers available for resolution
  var orig = cares.getServers();

  var newSet = [];

  servers.forEach(function(serv) {
    var ver = isIp(serv);

    if (ver)
      return newSet.push([ver, serv]);

    var match = serv.match(/\[(.*)\](:\d+)?/);

    // we have an IPv6 in brackets
    if (match) {
      ver = isIp(match[1]);
      if (ver)
        return newSet.push([ver, match[1]]);
    }

    var s = serv.split(/:\d+$/)[0];
    ver = isIp(s);

    if (ver)
      return newSet.push([ver, s]);

    throw new Error('IP address is not properly formatted: ' + serv);
  });

  var r = cares.setServers(newSet);

  if (r) {
    // reset the servers to the old servers, because ares probably unset them
    cares.setServers(orig.join(','));

    var err = cares.strerror(r);
    throw new Error('c-ares failed to set servers: "' + err +
                    '" [' + servers + ']');
  }
};


// ERROR CODES
exports.NODATA = 'ENODATA';
exports.FORMERR = 'EFORMERR';
exports.SERVFAIL = 'ESERVFAIL';
exports.NOTFOUND = 'ENOTFOUND';
exports.NOTIMP = 'ENOTIMP';
exports.REFUSED = 'EREFUSED';
exports.BADQUERY = 'EBADQUERY';
exports.ADNAME = 'EADNAME';
exports.BADFAMILY = 'EBADFAMILY';
exports.BADRESP = 'EBADRESP';
exports.CONNREFUSED = 'ECONNREFUSED';
exports.TIMEOUT = 'ETIMEOUT';
exports.EOF = 'EOF';
exports.FILE = 'EFILE';
exports.NOMEM = 'ENOMEM';
exports.DESTRUCTION = 'EDESTRUCTION';
exports.BADSTR = 'EBADSTR';
exports.BADFLAGS = 'EBADFLAGS';
exports.NONAME = 'ENONAME';
exports.BADHINTS = 'EBADHINTS';
exports.NOTINITIALIZED = 'ENOTINITIALIZED';
exports.LOADIPHLPAPI = 'ELOADIPHLPAPI';
exports.ADDRGETNETWORKPARAMS = 'EADDRGETNETWORKPARAMS';
exports.CANCELLED = 'ECANCELLED';
