import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function res(body) {
  return { ok: true, body, clone() { return res(body); } };
}

function load() {
  const stores = {};
  const store = (name) => (stores[name] = stores[name] || new Map());
  const cacheApi = (name) => ({
    put(key, r) { store(name).set(key, r); return Promise.resolve(); },
    addAll() { throw new Error('addAll uses the HTTP cache'); },
  });
  const caches = {
    open: (name) => Promise.resolve(cacheApi(name)),
    keys: () => Promise.resolve(Object.keys(stores)),
    delete: (name) => { delete stores[name]; return Promise.resolve(true); },
    match: (key) => {
      for (const name of Object.keys(stores)) if (stores[name].has(key)) return Promise.resolve(stores[name].get(key));
      return Promise.resolve(undefined);
    },
  };
  const fetches = [];
  const timers = [];
  const handlers = {};
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    location: { origin: 'https://x.test', href: 'https://x.test/g/sw.js' },
  };
  const fetch = (url, init) => new Promise((resolve, reject) => fetches.push({ url, init, resolve, reject }));
  const src = readFileSync('web/sw.js', 'utf8').replace(/__CACHE_VERSION__/g, 'v2');
  vm.runInNewContext(src, {
    self, caches, fetch, URL, Promise,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
  });
  return { handlers, fetches, timers, store, stores };
}

const flush = () => new Promise((r) => setImmediate(r));

test('install fetches fresh copies, bypassing the HTTP cache', async () => {
  const sw = load();
  let done;
  sw.handlers.install({ waitUntil: (p) => { done = p; } });
  await flush();
  assert.ok(sw.fetches.length >= 3);
  sw.fetches.forEach((f) => {
    assert.equal(f.init.cache, 'no-store');
    f.resolve(res('new ' + f.url));
  });
  await done;
  assert.equal(sw.store('lower-wacker-v2').get('./index.html').body, 'new ./index.html');
});

test('a navigation that misses the timeout still saves the late page', async () => {
  const sw = load();
  sw.store('lower-wacker-v2').set('./index.html', res('old'));
  let served;
  sw.handlers.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://x.test/g/' },
    respondWith: (p) => { served = p; },
  });
  assert.equal(sw.fetches.length, 1);
  assert.equal(sw.fetches[0].init.cache, 'no-store');
  sw.timers.forEach((fn) => fn());
  assert.equal((await served).body, 'old');
  sw.fetches[0].resolve(res('new'));
  await flush();
  assert.equal(sw.store('lower-wacker-v2').get('./index.html').body, 'new');
});
