;(() => {
  if (window.bootstrapSmartNotes) return

  const safeCall = (fn) => {
    try { fn() } catch {}
  }

  const bootstrapSmartNotes = () => {
    document.addEventListener("DOMContentLoaded", () => {
      safeCall(() => ThemeManager?.init?.())
      safeCall(() => UI?.init?.())
      safeCall(() => Editor?.init?.())
    })
  }

  window.bootstrapSmartNotes = bootstrapSmartNotes
  bootstrapSmartNotes()
})()
