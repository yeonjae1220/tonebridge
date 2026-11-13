// Public assets only. Authentication and learning responses must never enter this cache.
const CACHE_NAME = 'tonebridge-v3'
const OFFLINE_URL = '/offline.html'
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('tonebridge-') && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }
  if (!url.pathname.startsWith('/_next/static/') && !url.pathname.startsWith('/icons/') && !url.pathname.startsWith('/samples/')) return
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)))
    }
    return response
  }).catch(async () => (await caches.match(request)) || Response.error()))
})
