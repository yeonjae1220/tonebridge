const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../frontend/public/sw.js'), 'utf8');
function worker() {
  const handlers = {}, writes = [], removed = [], waits = [];
  let offline = false, response;
  const cache = { add: async url => writes.push(url), put: async request => writes.push(request.url) };
  const self = { location: { origin: 'https://tonebridge.test' }, addEventListener: (name, fn) => handlers[name] = fn, skipWaiting: async () => {}, clients: { claim: async () => {} } };
  vm.runInNewContext(source, { self, URL, Response,
    caches: { open: async () => cache, keys: async () => ['tonebridge-v1', 'tonebridge-v2', 'tonebridge-v3', 'unrelated'], delete: async key => removed.push(key), match: async url => url === '/offline.html' ? new Response('offline guidance') : undefined },
    fetch: async () => { if (offline) throw new Error('offline'); return { ok: true, type: 'basic', clone: () => ({}) } },
  });
  return { writes, removed, handlers, async settle() { await Promise.all(waits); },
    async request(url, mode = 'cors', method = 'GET') {
      response = undefined;
      handlers.fetch({ request: { url, mode, method }, respondWith: promise => response = promise, waitUntil: p => waits.push(p) });
      const result = response ? await response : undefined; await Promise.all(waits); return result;
    }, offline() { offline = true }, event() { return { waitUntil: p => waits.push(p) } },
  };
}
test('activation removes only obsolete ToneBridge caches', async () => {
  const w = worker(); w.handlers.activate(w.event()); await w.settle();
  assert.deepEqual(w.removed, ['tonebridge-v1', 'tonebridge-v2']);
});
test('API, writes, foreign origins and private non-navigation requests are not intercepted', async () => {
  const w = worker();
  for (const [url, method] of [['https://tonebridge.test/api/users/me','GET'], ['https://tonebridge.test/api/compositions/123','POST'], ['https://storage.test/audio','GET'], ['https://tonebridge.test/study/private?_rsc=a','GET']]) {
    assert.equal(await w.request(url, 'cors', method), undefined);
  }
  assert.deepEqual(w.writes, []);
});
test('online account pages are never cached; offline unseen routes receive a public fallback', async () => {
  const w = worker(); await w.request('https://tonebridge.test/auth/callback?code=private', 'navigate');
  assert.deepEqual(w.writes, []);
  w.offline(); const result = await w.request('https://tonebridge.test/study/new-card', 'navigate');
  assert.equal(await result.text(), 'offline guidance');
});
test('only allowlisted static assets are cached', async () => {
  const w = worker(); await w.request('https://tonebridge.test/_next/static/example.js');
  assert.deepEqual(w.writes, ['https://tonebridge.test/_next/static/example.js']);
});
