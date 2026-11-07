/* Daymark service worker —— 应用外壳离线可用。
 * 策略：导航请求 network-first（带离线回退），静态资源 cache-first。
 * 版本号变化时旧的缓存会被清理。
 */
/* 缓存名跟着发布走：旧版本缓存的静态资源在 activate 里一次清掉。
 * 一直写死 v1 的话，activate 里那行 filter 永远筛不出东西，缓存只增不减。 */
const CACHE = 'daymark-v2026-11-07'
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // no-store：绕过浏览器的 HTTP 缓存，刷新时一定拿到最新 HTML，
    // 否则新版本要等 max-age 过期才生效（用户会以为改动没上线）。
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html')),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
