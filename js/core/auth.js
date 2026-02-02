;(() => {
  const existing = window.Auth
  if (existing) return

  const Auth = {
    async login() {
      if (!window.firebase || !firebase.auth) {
        alert("Firebase не загружен")
        return
      }
      const provider = new firebase.auth.GoogleAuthProvider()
      provider.setCustomParameters({ prompt: "select_account" })
      try {
        await firebase.auth().signInWithPopup(provider)
      } catch (e) {
        const code = e && e.code ? e.code : "auth/unknown"
        const map = {
          "auth/popup-closed-by-user": "Вход отменен",
          "auth/network-request-failed": "Нет соединения с интернетом",
          "auth/cancelled-popup-request": "Запрос отменен"
        }
        const msg = map[code] || `Ошибка входа: ${code}`
        if (window.UI && UI.showToast) UI.showToast(msg)
        else alert(msg)
      }
    },
    async logout() {
      if (!window.firebase || !firebase.auth) return
      try {
        await firebase.auth().signOut()
      } catch {
        if (window.UI && UI.showToast) UI.showToast("Ошибка при выходе")
      }
    },
    async switchAccount() {
      await this.logout()
      await this.login()
    }
  }

  window.Auth = Auth
})()
