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
firebase.auth().onAuthStateChanged((user) => {
  if (window.state) state.user = user || null

  const login = document.getElementById("login-screen")
  const app = document.getElementById("app")

  if (user) {
    login?.classList.remove("active")
    app?.classList.add("active")
    document.body.classList.add("is-authenticated")

    if (window.UI) UI.render()
  } else {
    login?.classList.add("active")
    app?.classList.remove("active")
    document.body.classList.remove("is-authenticated")
  }
})

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

