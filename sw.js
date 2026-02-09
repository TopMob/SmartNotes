const CACHE_NAME = "SmartNotes"
const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/Logo.png",
  "/favicon.ico"
]
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_URLS)
    })
  )
  self.skipWaiting()
})
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return response
      })
      .catch(() => {
        return caches.match(event.request).then(match => {
          return match || caches.match("/index.html")
        })
      })
  )
})
