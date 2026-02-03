(() => {
  if (window.Auth) return

  function setVisibility(id, isVisible) {
    const el = document.getElementById(id)
    if (!el) return
    if (isVisible) {
      el.classList.add("active")
      el.setAttribute("aria-hidden", "false")
    } else {
      el.classList.remove("active")
      el.setAttribute("aria-hidden", "true")
    }
  }

  function showAppShell() {
    setVisibility("login-screen", false)
    const app = document.getElementById("app")
    if (app) app.setAttribute("aria-hidden", "false")
  }

  function showLoginShell() {
    setVisibility("login-screen", true)
    const app = document.getElementById("app")
    if (app) app.setAttribute("aria-hidden", "true")
  }

  function toast(message) {
    if (window.UI && typeof UI.showToast === "function") UI.showToast(message)
    else alert(message)
  }

  function ensureFirebaseAuth() {
    if (!window.firebase || !firebase.auth) return null
    try {
      return firebase.auth()
    } catch {
      return null
    }
  }

  const Auth = {
    async login() {
      const auth = ensureFirebaseAuth()
      if (!auth) {
        toast("Firebase Auth не инициализирован")
        return
      }
      const provider = new firebase.auth.GoogleAuthProvider()
      provider.setCustomParameters({ prompt: "select_account" })
      try {
        await auth.signInWithPopup(provider)
      } catch (e) {
        const code = e && e.code ? String(e.code) : "auth/unknown"
        const map = {
          "auth/popup-blocked": "Браузер заблокировал окно входа",
          "auth/popup-closed-by-user": "Вход отменен",
          "auth/cancelled-popup-request": "Запрос входа отменен",
          "auth/network-request-failed": "Нет соединения с интернетом"
        }
        toast(map[code] || `Ошибка входа: ${code}`)
      }
    },

    async logout() {
      const auth = ensureFirebaseAuth()
      if (!auth) return
      try {
        await auth.signOut()
      } catch {
        toast("Ошибка при выходе")
      }
    },

    async switchAccount() {
      await this.logout()
      await this.login()
    },

    bindAuthState() {
      const auth = ensureFirebaseAuth()
      if (!auth) {
        if (!window.state) window.state = {}
        window.state.user = { uid: "guest", displayName: "Гость", photoURL: "" }
        showAppShell()
        if (window.UI && typeof UI.onAuthReady === "function") UI.onAuthReady(window.state.user)
        return
      }

      auth.onAuthStateChanged(user => {
        if (!window.state) window.state = {}
        window.state.user = user || null

        if (user) {
          showAppShell()
          if (window.UI && typeof UI.onAuthReady === "function") UI.onAuthReady(user)
        } else {
          showLoginShell()
        }
      })
    }
  }

  window.Auth = Auth

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Auth.bindAuthState())
  } else {
    Auth.bindAuthState()
  }
})()
