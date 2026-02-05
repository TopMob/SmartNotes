export function createAuthManager({ auth }) {
    return {
        _t(key, fallback) {
            return (typeof UI !== "undefined" && UI.getText) ? UI.getText(key, fallback) : (fallback || key)
        },
        _toast(text) {
            if (typeof UI !== "undefined" && UI.showToast) UI.showToast(text)
            else alert(text)
        },
        _provider() {
            const p = new firebase.auth.GoogleAuthProvider()
            p.setCustomParameters({ prompt: "select_account" })
            return p
        },
        handleAuthError(e) {
            const code = e && e.code ? e.code : "auth/unknown"
            const message = e && e.message ? String(e.message) : ""
            const map = {
                "auth/network-request-failed": this._t("auth_network_failed", "No internet connection"),
                "-40": this._t("auth_network_failed", "No internet connection")
            }
            const serviceUnavailable = message.includes("503") || message.toLowerCase().includes("unavailable")
            const msg = map[code] || (serviceUnavailable ? this._t("auth_service_unavailable", "Service temporarily unavailable") : `${this._t("login_failed", "Sign-in failed")}: ${code}`)
            this._toast(msg)
        },
        async login() {
            if (!auth || typeof firebase === "undefined") {
                this._toast(this._t("auth_unavailable", "Authentication unavailable"))
                return
            }
            const provider = this._provider()
            try {
                await auth.signInWithRedirect(provider)
            } catch (e) {
                this.handleAuthError(e)
            }
        },
        async logout() {
            if (!auth) return
            try {
                await auth.signOut()
            } catch {
                this._toast(this._t("logout_failed", "Sign out failed"))
            }
        },
        async switchAccount() {
            if (!auth) return
            try {
                await auth.signOut()
                await this.login()
            } catch (e) {
                this.handleAuthError(e)
            }
        },
        clearState() {
            if (typeof StateStore !== "undefined" && StateStore.resetSession) StateStore.resetSession()
            if (typeof UI !== "undefined") {
                UI.visibleNotes = []
                UI.currentNoteActionId = null
                UI.draggedNoteId = null
                UI.dragTargetId = null
                UI.dragPosition = null
                if (UI.closeAllModals) UI.closeAllModals()
                if (UI.renderFolders) UI.renderFolders()
                if (UI.updateViewTitle) UI.updateViewTitle()
                if (UI.updatePrimaryActionLabel) UI.updatePrimaryActionLabel()
            }
            const search = document.getElementById("search-input")
            if (search) search.value = ""
            if (typeof Editor !== "undefined" && Editor && typeof Editor.close === "function") {
                try { Editor.close() } catch {}
            }
        },
        applySignedInUI(user) {
            if (!user) return
            const loginScreen = document.getElementById("login-screen")
            const appScreen = document.getElementById("app")
            const userPhoto = document.getElementById("user-photo")
            const userName = document.getElementById("user-name")
            if (userPhoto) userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || "User")}&background=random&color=fff`
            if (userName) userName.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "User")
            if (loginScreen) {
                loginScreen.style.opacity = "0"
                loginScreen.style.display = "none"
                loginScreen.classList.remove("active")
            }
            if (appScreen) {
                appScreen.style.display = "flex"
                appScreen.style.opacity = "1"
                appScreen.classList.add("active")
            }
        },
        applySignedOutUI() {
            const loginScreen = document.getElementById("login-screen")
            const appScreen = document.getElementById("app")
            if (appScreen) {
                appScreen.style.opacity = "0"
                appScreen.style.display = "none"
                appScreen.classList.remove("active")
            }
            if (loginScreen) {
                loginScreen.style.display = "flex"
                loginScreen.classList.add("active")
                loginScreen.style.opacity = "1"
            }
        },
        resetSession() {
            this.clearState()
            this.applySignedOutUI()
        },
        async init() {
            if (!auth) return
            auth.getRedirectResult().catch(e => {
                this.handleAuthError(e)
                return null
            })
            auth.onAuthStateChanged(async user => {
                if (typeof StateStore !== "undefined" && StateStore.update) StateStore.update("user", user || null)
                if (user) {
                    this.applySignedInUI(user)
                    if (typeof window.initApp === "function") window.initApp()
                    return
                }
                this.resetSession()
            })
        }
    }
}
