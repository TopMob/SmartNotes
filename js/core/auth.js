const AUTH_REDIRECT_PENDING_KEY = "smartnotes.auth.redirect.pending"
const AUTH_REDIRECT_TS_KEY = "smartnotes.auth.redirect.pending.ts"
const AUTH_REDIRECT_TTL_MS = 60 * 1000

export function createAuthManager({ auth }) {
    const state = {
        initialized: false,
        isRedirecting: false,
        redirectHandled: false,
        authReady: false,
        currentUser: null,
        authSub: null,
        loginButton: null
    }

    const manager = {
        _t(key, fallback) {
            return (typeof UI !== "undefined" && UI.getText) ? UI.getText(key, fallback) : (fallback || key)
        },
        _toast(text) {
            if (typeof UI !== "undefined" && UI.showToast) UI.showToast(text)
            else alert(text)
        },
        _provider() {
            const provider = new firebase.auth.GoogleAuthProvider()
            provider.setCustomParameters({ prompt: "select_account" })
            return provider
        },
        _setRedirectPending(flag) {
            try {
                if (flag) {
                    sessionStorage.setItem(AUTH_REDIRECT_PENDING_KEY, "1")
                    sessionStorage.setItem(AUTH_REDIRECT_TS_KEY, String(Date.now()))
                } else {
                    sessionStorage.removeItem(AUTH_REDIRECT_PENDING_KEY)
                    sessionStorage.removeItem(AUTH_REDIRECT_TS_KEY)
                }
            } catch {
                return
            }
        },
        _getRedirectPending() {
            try {
                if (sessionStorage.getItem(AUTH_REDIRECT_PENDING_KEY) !== "1") return false
                const startedAt = Number(sessionStorage.getItem(AUTH_REDIRECT_TS_KEY) || 0)
                if (!startedAt || (Date.now() - startedAt) > AUTH_REDIRECT_TTL_MS) {
                    this._setRedirectPending(false)
                    return false
                }
                return true
            } catch {
                return false
            }
        },
        _setLoginBusy(flag) {
            state.isRedirecting = !!flag
            if (!state.loginButton) {
                state.loginButton = document.querySelector("[data-action='login']")
            }
            if (!state.loginButton) return
            state.loginButton.disabled = !!flag
            state.loginButton.setAttribute("aria-busy", flag ? "true" : "false")
            state.loginButton.classList.toggle("is-loading", !!flag)
        },
        handleAuthError(err) {
            const code = err && err.code ? err.code : "auth/unknown"
            const message = err && err.message ? String(err.message).toLowerCase() : ""
            const map = {
                "auth/network-request-failed": this._t("auth_network_failed", "No internet connection"),
                "auth/web-storage-unsupported": this._t("auth_storage_failed", "Storage is blocked in this browser"),
                "auth/operation-not-supported-in-this-environment": this._t("auth_env_failed", "Authentication is blocked in this browser")
            }
            const serviceUnavailable = message.includes("503") || message.includes("unavailable")
            const text = map[code] || (serviceUnavailable
                ? this._t("auth_service_unavailable", "Service temporarily unavailable")
                : `${this._t("login_failed", "Sign-in failed")}: ${code}`)
            this._toast(text)
        },
        async login() {
            if (!auth || typeof firebase === "undefined") {
                console.error("[Auth] Firebase auth is unavailable: SDK not initialized")
                this._toast(this._t("auth_unavailable", "Authentication unavailable"))
                return
            }
            if (state.isRedirecting) return

            try {
                this._setLoginBusy(true)
                this._setRedirectPending(true)
                await auth.signInWithRedirect(this._provider())
            } catch (err) {
                this._setLoginBusy(false)
                this._setRedirectPending(false)
                this.handleAuthError(err)
            }
        },
        async logout() {
            if (!auth) return
            this._setLoginBusy(false)
            this._setRedirectPending(false)
            try {
                await auth.signOut()
            } catch {
                this._toast(this._t("logout_failed", "Sign out failed"))
            }
        },
        async switchAccount() {
            await this.logout()
            await this.login()
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
            const loginScreen = document.getElementById("login-screen")
            const appScreen = document.getElementById("app")
            const userPhoto = document.getElementById("user-photo")
            const userName = document.getElementById("user-name")

            if (userPhoto) userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || "User")}&background=random&color=fff`
            if (userName) userName.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "User")

            if (loginScreen) {
                loginScreen.classList.remove("active")
                loginScreen.style.opacity = "0"
                loginScreen.style.display = "none"
            }
            if (appScreen) {
                appScreen.style.display = "flex"
                appScreen.classList.add("active")
                appScreen.style.opacity = "1"
            }
        },
        applySignedOutUI() {
            const loginScreen = document.getElementById("login-screen")
            const appScreen = document.getElementById("app")

            if (appScreen) {
                appScreen.style.opacity = "0"
                appScreen.classList.remove("active")
                appScreen.style.display = "none"
            }
            if (loginScreen) {
                loginScreen.style.display = "flex"
                loginScreen.classList.add("active")
                loginScreen.style.opacity = "1"
            }
        },
        async _processRedirectResultOnce() {
            if (!auth || state.redirectHandled) return
            state.redirectHandled = true

            try {
                await auth.getRedirectResult()
            } catch (err) {
                this.handleAuthError(err)
            } finally {
                this._setRedirectPending(false)
            }
        },
        async _handleAuthState(user) {
            const normalizedUser = user || auth.currentUser || null
            state.currentUser = normalizedUser
            state.authReady = true
            StateActions.setUser(normalizedUser)

            if (normalizedUser) {
                this.applySignedInUI(normalizedUser)
                if (typeof window.startUserSession === "function") {
                    await window.startUserSession(normalizedUser)
                }
                return
            }

            if (typeof window.stopUserSession === "function") {
                window.stopUserSession()
            }
            this.clearState()
            this.applySignedOutUI()
        },
        async init() {
            if (!auth || state.initialized) return
            state.initialized = true
            this._setLoginBusy(false)
            if (!this._getRedirectPending()) {
                this._setRedirectPending(false)
            }

            await this._processRedirectResultOnce()

            state.authSub = auth.onAuthStateChanged(async user => {
                this._setLoginBusy(false)
                await this._handleAuthState(user)
            }, err => {
                this._setLoginBusy(false)
                this.handleAuthError(err)
            })
        }
    }

    return manager
}
