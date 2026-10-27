// v1 은 /api/* 응답(사용자 데이터)까지 캐싱했다 — 버전을 올려 activate 에서 통째로 지운다.
const CACHE_NAME = 'tonebridge-v2'
const PRECACHE_URLS = ['/', '/feed', '/login']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return
  // API 는 캐싱하지 않는다. 네트워크 실패 시 옛 응답을 돌려주면 수시로 바뀌는 상태(피드·크레딧·좋아요)가
  // 멈춘 채 보이고, 사용자 데이터가 로그아웃 뒤에도 Cache Storage 에 남는다(GLOBAL-PIT-065).
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})
