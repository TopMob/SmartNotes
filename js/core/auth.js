export function createAuthManager({ auth }) {
    const REDIRECT_KEY = "smartnotes.auth.redirect.in.progress"
    return {
        _appUserId: null,
        _authObserverAttached: false,
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
        _setRedirectInProgress(value) {
            try {
                if (value) sessionStorage.setItem(REDIRECT_KEY, "1")
                else sessionStorage.removeItem(REDIRECT_KEY)
            } catch {
                return
            }
        },
        _isRedirectInProgress() {
            try {
                return sessionStorage.getItem(REDIRECT_KEY) === "1"
            } catch {
                return false
            }
        },
        _isEmbeddedContext() {
            return window.self !== window.top
        },
        async _setBestPersistence() {
            if (typeof firebase === "undefined" || !auth || typeof auth.setPersistence !== "function") return
            const modes = [
                firebase.auth.Auth.Persistence.LOCAL,
                firebase.auth.Auth.Persistence.SESSION,
                firebase.auth.Auth.Persistence.NONE
            ]
            for (const mode of modes) {
                try {
                    await auth.setPersistence(mode)
                    return
                } catch {
                    continue
                }
            }
        },
        handleAuthError(e) {
            const code = e && e.code ? e.code : "auth/unknown"
            const message = e && e.message ? String(e.message) : ""
            const map = {
                "auth/network-request-failed": this._t("auth_network_failed", "No internet connection"),
                "auth/web-storage-unsupported": this._t("auth_unavailable", "Authentication unavailable"),
                "auth/operation-not-supported-in-this-environment": this._t("auth_unavailable", "Authentication unavailable"),
                "auth/unauthorized-domain": this._t("auth_unavailable", "Authentication unavailable"),
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
            if (this._isEmbeddedContext()) {
                this._toast(this._t("auth_unavailable", "Authentication unavailable"))
                return
            }
            const provider = this._provider()
            await this._setBestPersistence()
            try {
                this._setRedirectInProgress(true)
                await auth.signInWithRedirect(provider)
            } catch (e) {
                this._setRedirectInProgress(false)
                this.handleAuthError(e)
            }
        },
        async logout() {
            if (!auth) return
            try {
                await auth.signOut()
                this._appUserId = null
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
            this._appUserId = null
            this.clearState()
            this.applySignedOutUI()
        },
        async _handleRedirectResult() {
            try {
                await auth.getRedirectResult()
            } catch (e) {
                this.handleAuthError(e)
            } finally {
                this._setRedirectInProgress(false)
            }
        },
        async _bootApp(user) {
            if (!user || this._appUserId === user.uid) return
            if (typeof window.initApp === "function") {
                this._appUserId = user.uid
                await window.initApp()
                return
            }
            const maxWaitMs = 3000
            const stepMs = 100
            let waited = 0
            while (waited < maxWaitMs) {
                await new Promise(resolve => setTimeout(resolve, stepMs))
                waited += stepMs
                if (typeof window.initApp === "function") {
                    this._appUserId = user.uid
                    await window.initApp()
                    return
                }
            }
        },
        async _handleAuthState(user) {
            if (typeof StateStore !== "undefined" && StateStore.update) StateStore.update("user", user || null)
            if (user) {
                this.applySignedInUI(user)
                await this._bootApp(user)
                return
            }
            this.resetSession()
        },
        async init() {
            if (!auth || this._authObserverAttached) return
            this._authObserverAttached = true
            auth.onAuthStateChanged((user) => {
                this._handleAuthState(user).catch((e) => this.handleAuthError(e))
            })
            if (this._isRedirectInProgress()) {
                await this._handleRedirectResult()
                return
            }
            this._setRedirectInProgress(false)
        }
    }
}
