;(() => {
  const existing = window.bootstrapSmartNotes
  if (existing) return

  const bootstrapSmartNotes = () => {
    const safeCall = (fn) => {
      try { fn() } catch {}
    }

    document.addEventListener("DOMContentLoaded", () => {
      safeCall(() => window.ThemeManager && ThemeManager.init && ThemeManager.init())
      safeCall(() => window.UI && UI.init && UI.init())
      safeCall(() => window.Editor && Editor.init && Editor.init())

      if (window.firebase && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
          if (window.state) state.user = user || null
          if (user && typeof window.initApp === "function") safeCall(() => window.initApp())
        })
      }
    })
  }

  window.bootstrapSmartNotes = bootstrapSmartNotes
  bootstrapSmartNotes()
})()
