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

      if (window.firebase?.auth) {
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
      }
    })
  }

  window.bootstrapSmartNotes = bootstrapSmartNotes
  bootstrapSmartNotes()
})()
