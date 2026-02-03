const CACHE_NAME = "smartnotes-cache-v1"
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.ico",
  "./Logo.png",
  "./css/app.css",
  "./css/base/reset.css",
  "./css/base/variables.css",
  "./css/base/typography.css",
  "./css/base/layout.css",
  "./css/ui/buttons.css",
  "./css/ui/modals.css",
  "./css/ui/sidebar.css",
  "./css/ui/toolbar.css",
  "./css/ui/cards.css",
  "./css/ui/toast.css",
  "./css/editor/editor.css",
  "./css/editor/media.css",
  "./css/editor/tags.css",
  "./css/editor/tasks.css",
  "./css/themes/themes.css",
  "./js/core/utils.js",
  "./js/core/state.js",
  "./js/core/auth.js",
  "./js/core/theme.js",
  "./js/index.bootstrap.js",
  "./js/app.runtime.js",
  "./js/ui/ui.core.js",
  "./js/ui/ui.toast.js",
  "./js/ui/ui.modals.js",
  "./js/ui/ui.sidebar.js",
  "./js/ui/ui.settings.js",
  "./js/ui/ui.folders.js",
  "./js/ui/ui.note-actions.js",
  "./js/ui/ui.note-state.js",
  "./js/ui/ui.note-visibility.js",
  "./js/editor/editor.core.js",
  "./js/editor/editor.media.js",
  "./js/editor/editor.tasks.js",
  "./js/features/smart-search.js",
  "./js/features/tags.js",
  "./js/features/share.js",
  "./js/features/lock.js",
  "./js/features/folders.auto.js",
  "./js/features/survey.js",
  "./js/integrations/export.js",
  "./js/integrations/voice.js",
  "./js/integrations/sketch.js",
  "./js/integrations/photo-editor.js",
  "./js/integrations/drive.js"
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => 0)
        return response
      }).catch(() => cached)
    })
  )
})
