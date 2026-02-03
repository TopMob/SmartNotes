;(() => {
  if (window.bootstrapSmartNotes) return

  const safeCall = (fn) => {
    try { fn() } catch {}
  }

  const handleAuthState = (user) => {
    if (window.state) state.user = user || null

    if (user) {
      document.body.classList.add("is-authenticated")
      if (window.UIModals) UIModals.close("auth-modal")
      if (window.UI) UI.render()
    } else {
      document.body.classList.remove("is-authenticated")
      if (window.UIModals) UIModals.open("auth-modal")
    }
  }

  const bootstrapSmartNotes = () => {
    document.addEventListener("DOMContentLoaded", () => {
      safeCall(() => ThemeManager?.init?.())
      safeCall(() => UI?.init?.())
      safeCall(() => Editor?.init?.())

      if (window.firebase?.auth) {
        firebase.auth().onAuthStateChanged(handleAuthState)
      }
    })
  }

  window.bootstrapSmartNotes = bootstrapSmartNotes
  bootstrapSmartNotes()
})()
