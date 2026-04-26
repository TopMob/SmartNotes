const CACHE_NAME = "smartnotes-static-disabled-v1"

self.addEventListener("install", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
  )
  self.skipWaiting()
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener("fetch", event => {
  const request = event.request
  if (request.method !== "GET") return

  const requestUrl = new URL(request.url)
  if (requestUrl.origin !== self.location.origin) return
  if (requestUrl.pathname.startsWith("/api/")) return

  event.respondWith(fetch(request))
})
