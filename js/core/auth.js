import { isSafari } from "./authSafariFix.js"
import { createLocalAuthManager } from "./localAuth.js"

export function createAuthManager({ auth }) {
    const state = {
        initialized: false,
        loginInFlight: false,
        authReady: false,
        currentUser: null,
        loginButton: null,
        localAuthManager: null
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
        _isIOS() {
            const ua = (navigator.userAgent || "").toLowerCase()
            return /iphone|ipad|ipod/.test(ua)
        },
        _setLoginBusy(flag) {
            state.loginInFlight = !!flag
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
                "auth/popup-closed-by-user": this._t("auth_popup_closed", "Sign-in canceled"),
                "auth/popup-blocked": this._t("auth_popup_blocked", "Popup was blocked by the browser"),
                "auth/network-request-failed": this._t("auth_network_failed", "No internet connection"),
                "auth/web-storage-unsupported": this._t("auth_storage_failed", "Storage is blocked in this browser"),
                "auth/operation-not-supported-in-this-environment": this._t("auth_env_failed", "Authentication is blocked in this browser"),
                "auth/invalid-email": this._t("auth_fill_required", "Fill in all required fields"),
                "auth/wrong-password": this._t("login_failed", "Sign-in failed"),
                "auth/user-not-found": this._t("auth_email_not_found", "No account found for this email"),
                "auth/email-already-in-use": this._t("auth_email_exists", "An account with this email already exists. Please sign in"),
                "auth/account-exists-with-different-credential": this._t("auth_email_provider_conflict", "A different sign-in method is used for this email")
            }
            const serviceUnavailable = message.includes("503") || message.includes("unavailable")
            const text = map[code] || (serviceUnavailable
                ? this._t("auth_service_unavailable", "Service temporarily unavailable")
                : `${this._t("login_failed", "Sign-in failed")}: ${code}`)
            this._toast(text)
            console.error("[Auth] login error", code, err)
        },
        async _signInWithRedirect() {
            await auth.signInWithRedirect(this._provider())
        },
        async login() {
            if (!auth || typeof firebase === "undefined") {
                console.error("[Auth] Firebase auth is unavailable: SDK not initialized")
                this._toast(this._t("auth_unavailable", "Authentication unavailable"))
                return
            }
            if (state.loginInFlight) return

            this._setLoginBusy(true)

            try {
                if (isSafari()) {
                    await auth.signInWithPopup(this._provider())
                    return
                }

                if (this._isIOS()) {
                    await this._signInWithRedirect()
                    return
                }

                await auth.signInWithPopup(this._provider())
            } catch (err) {
                const popupFallbackCodes = new Set([
                    "auth/popup-blocked",
                    "auth/popup-closed-by-user",
                    "auth/cancelled-popup-request",
                    "auth/operation-not-supported-in-this-environment",
                    "auth/web-storage-unsupported"
                ])
                if (popupFallbackCodes.has(err?.code)) {
                    try {
                        await this._signInWithRedirect()
                        return
                    } catch (redirectErr) {
                        this._setLoginBusy(false)
                        this.handleAuthError(redirectErr)
                        return
                    }
                }
                this._setLoginBusy(false)
                this.handleAuthError(err)
                return
            }

            this._setLoginBusy(false)
        },
        _ensureLocalAuthManager() {
            if (state.localAuthManager) return state.localAuthManager
            state.localAuthManager = createLocalAuthManager({
                auth,
                setLoginBusy: (flag) => this._setLoginBusy(flag),
                handleAuthError: (error) => this.handleAuthError(error),
                getText: (key, fallback) => this._t(key, fallback)
            })
            return state.localAuthManager
        },
        async loginGuest() {
            await this._ensureLocalAuthManager().loginGuest()
        },
        async loginWithEmail() {
            await this._ensureLocalAuthManager().loginWithEmail()
        },
        async logout() {
            if (!auth) return
            this._setLoginBusy(false)
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
            if (typeof window.SmartNotesEditor?.close === "function") {
                try { window.SmartNotesEditor.close() } catch {}
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
            this._ensureLocalAuthManager().bindUi()

            try {
                await auth.getRedirectResult()
            } catch (err) {
                this.handleAuthError(err)
            } finally {
                this._setLoginBusy(false)
            }

            auth.onAuthStateChanged(async user => {
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
