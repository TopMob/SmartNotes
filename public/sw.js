const CACHE_NAME = "smartnotes-static-v2-auth-fix"
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/Logo.png",
  "/css/base.css?v=2026-04-19-final",
  "/css/layout.css?v=2026-04-19-final",
  "/css/components.css?v=2026-04-19-final",
  "/css/responsive.css?v=2026-04-19-final",
  "/js/load-foundation.js?v=2026-04-19-final"
]

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(() => null)
  )
  self.skipWaiting()
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key === CACHE_NAME ? null : caches.delete(key))
    ))
  )
  self.clients.claim()
})

self.addEventListener("fetch", event => {
  const request = event.request
  if (request.method !== "GET") return

  const requestUrl = new URL(request.url)
  if (requestUrl.origin !== self.location.origin) return
  if (requestUrl.pathname.startsWith("/api/")) return

   const acceptHeader = request.headers.get("accept") || ""
   const isNavigationRequest = request.mode === "navigate"
     || request.destination === "document"
     || acceptHeader.includes("text/html")

   if (isNavigationRequest) {
     event.respondWith(
       fetch(request)
         .then(networkResponse => {
           if (networkResponse && networkResponse.status === 200) {
             const responseCopy = networkResponse.clone()
             caches.open(CACHE_NAME).then(cache => cache.put(request, responseCopy)).catch(() => null)
           }
           return networkResponse
         })
         .catch(() => caches.match(request).then(cachedResponse => cachedResponse || caches.match("/")))
     )
     return
   }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse
      return fetch(request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) return networkResponse
        const responseCopy = networkResponse.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseCopy)).catch(() => null)
        return networkResponse
      })
    }).catch(() => caches.match("/"))
  )
})
