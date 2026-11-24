var CACHE = 'lower-wacker-__CACHE_VERSION__';
var PRECACHE = ['./', './index.html', './apple-touch-icon.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return Promise.all(PRECACHE.map(function (url) {
          return fresh(url).then(function (res) {
            if (!res.ok) throw new Error('precache failed: ' + url);
            return cache.put(url, res);
          });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) {
          return k.indexOf('lower-wacker-') === 0 && k !== CACHE;
        }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function fresh(url) {
  return fetch(url, { cache: 'no-store', credentials: 'same-origin' });
}

// The network fetch keeps going after the timeout, so a slow connection still
// refreshes the saved copy for the next launch.
function navigate(url, ms) {
  var network = fresh(url).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      return caches.open(CACHE)
        .then(function (cache) { return cache.put('./index.html', copy); })
        .then(function () { return res; });
    }
    return res;
  });
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
    network.then(function (res) { clearTimeout(timer); resolve(res); },
      function (err) { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith(
      navigate(req.url, 3000)
        .catch(function () {
          return caches.match('./index.html').then(function (hit) {
            return hit || caches.match('./');
          });
        })
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok && new URL(req.url).origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
