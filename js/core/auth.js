import { planAuthMethods } from "./authFlowPlanner.js"
import { createLocalAuthManager } from "./localAuth.js"
import { requestGoogleIdentityToken } from "./googleIdentityAuth.js"

export function createAuthManager({ auth }) {
    const state = {
        initialized: false,
        loginInFlight: false,
        authReady: false,
        currentUser: null,
        authActionElements: [],
        googleSignInPendingTimeoutId: null,
        localAuthManager: null,
        persistenceReady: false,
        authStateResolved: false
    }

    const manager = {
        _t(key, fallback) {
            return (typeof UI !== "undefined" && UI.getText) ? UI.getText(key, fallback) : (fallback || key)
        },
        _toast(text) {
            if (typeof UI !== "undefined" && UI.showToast) UI.showToast(text)
            else console.error(text)
        },
        _provider() {
            const provider = new firebase.auth.GoogleAuthProvider()
            provider.setCustomParameters({ prompt: "select_account" })
            return provider
        },
        _getGoogleClientId() {
            const configuredClientId = auth?.app?.options?.clientId
            return String(configuredClientId || "").trim()
        },
        async _signInWithGoogleIdentity() {
            const googleClientId = this._getGoogleClientId()
            if (!googleClientId) {
                throw { code: "auth/google-identity-client-id-missing", message: "Google client id is missing" }
            }
            const token = await requestGoogleIdentityToken({ clientId: googleClientId })
            const credential = firebase.auth.GoogleAuthProvider.credential(token)
            await auth.signInWithCredential(credential)
        },
        _collectAuthActionElements() {
            const selector = [
                "[data-action='login']",
                "#email-signin-form button[type='submit']",
                "#email-signup-form button[type='submit']",
                "[data-auth-action='forgot-password']",
                ".btn-auth-tab",
                ".btn-auth-toggle-password"
            ].join(",")
            state.authActionElements = Array.from(document.querySelectorAll(selector))
        },
        _setAuthFeedback(message, type = "info") {
            const feedbackElement = document.getElementById("email-auth-feedback")
            if (!feedbackElement) return
            feedbackElement.textContent = String(message || "")
            feedbackElement.classList.remove("is-error", "is-success", "is-info")
            if (type) feedbackElement.classList.add(`is-${type}`)
        },
        _clearGoogleSignInPendingTimeout() {
            if (!state.googleSignInPendingTimeoutId) return
            clearTimeout(state.googleSignInPendingTimeoutId)
            state.googleSignInPendingTimeoutId = null
        },
        _showGoogleSignInPendingFeedback() {
            this._clearGoogleSignInPendingTimeout()
            this._setAuthFeedback(this._t("auth_google_starting", "Открываем окно входа Google..."), "info")
            state.googleSignInPendingTimeoutId = setTimeout(() => {
                this._setAuthFeedback(this._t("auth_google_waiting", "Если окно не появилось, проверьте блокировку всплывающих окон"), "info")
            }, 2200)
        },
        _setLoginBusy(flag) {
            state.loginInFlight = !!flag
            this._collectAuthActionElements()
            for (const actionElement of state.authActionElements) {
                actionElement.disabled = !!flag
                actionElement.setAttribute("aria-busy", flag ? "true" : "false")
                actionElement.classList.toggle("is-loading", !!flag)
            }
            if (!flag) {
                this._clearGoogleSignInPendingTimeout()
                this._setAuthFeedback("")
            }
        },

        _resolveStartupScreen() {
            if (state.authStateResolved) return
            state.authStateResolved = true
            if (typeof window.hideSplashScreen === "function") {
                window.hideSplashScreen()
            }
        },
        handleAuthError(err) {
            const code = err && err.code ? err.code : "auth/unknown"
            const message = err && err.message ? String(err.message).toLowerCase() : ""
            const map = {
                "auth/popup-closed-by-user": this._t("auth_popup_closed", "Sign-in canceled"),
                "auth/popup-blocked": this._t("auth_popup_blocked", "Popup was blocked by the browser"),
                "auth/network-request-failed": this._t("auth_network_failed", "No internet connection"),
                "auth/internal-error": this._t("auth_network_failed", "No internet connection"),
                "auth/web-storage-unsupported": this._t("auth_storage_failed", "Storage is blocked in this browser"),
                "auth/operation-not-supported-in-this-environment": this._t("auth_env_failed", "Authentication is blocked in this browser"),
                "auth/invalid-email": this._t("auth_fill_required", "Fill in all required fields"),
                "auth/wrong-password": this._t("login_failed", "Sign-in failed"),
                "auth/user-not-found": this._t("auth_email_not_found", "No account found for this email"),
                "auth/email-already-in-use": this._t("auth_email_exists", "An account with this email already exists. Please sign in"),
                "auth/account-exists-with-different-credential": this._t("auth_email_provider_conflict", "A different sign-in method is used for this email"),
                "auth/google-identity-script-timeout": this._t("auth_network_failed", "No internet connection"),
                "auth/google-identity-script-failed": this._t("auth_network_failed", "No internet connection"),
                "auth/google-identity-timeout": this._t("auth_network_failed", "No internet connection"),
                "auth/google-identity-not-displayed": this._t("auth_popup_blocked", "Popup was blocked by the browser")
            }
            const serviceUnavailable = message.includes("503") || message.includes("unavailable")
            const text = map[code] || (serviceUnavailable
                ? this._t("auth_service_unavailable", "Service temporarily unavailable")
                : `${this._t("login_failed", "Sign-in failed")}: ${code}`)
            this._toast(text)
            console.error("[Auth] login error", code, err)
        },
        _getPersistenceEnum() {
            if (typeof firebase === "undefined") return null
            if (!firebase.auth || !firebase.auth.Auth || !firebase.auth.Auth.Persistence) return null
            return firebase.auth.Auth.Persistence
        },
        async _ensureLocalPersistence() {
            if (state.persistenceReady) return true
            const persistenceEnum = this._getPersistenceEnum()
            if (!persistenceEnum || !auth) return false
            try {
                await auth.setPersistence(persistenceEnum.LOCAL)
                state.persistenceReady = true
                return true
            } catch {
                return false
            }
        },
        async _preparePersistenceForMethod() {
            return this._ensureLocalPersistence()
        },
        async _preparePersistenceForRedirectResult() {
            return this._ensureLocalPersistence()
        },
        async _signInWithMethod(method) {
            if (method === "redirect") {
                await auth.signInWithRedirect(this._provider())
                return
            }
            await auth.signInWithPopup(this._provider())
        },
        _isRedirectDomainAllowed() {
            const currentHost = String(window?.location?.hostname || "").toLowerCase()
            const authDomainHost = String(auth?.app?.options?.authDomain || "").toLowerCase()
            if (!currentHost || !authDomainHost) return false
            if (currentHost === authDomainHost) return true
            if (currentHost.endsWith(".firebaseapp.com") || currentHost.endsWith(".web.app")) return true
            return false
        },
        _canRecoverWithRedirect(error) {
            if (!this._isRedirectDomainAllowed()) return false
            const errorCode = String(error?.code || "")
            return errorCode === "auth/internal-error"
                || errorCode === "auth/network-request-failed"
                || errorCode === "auth/popup-blocked"
        },
        async _attemptRedirectRecovery(error) {
            if (!this._canRecoverWithRedirect(error)) return false
            const selectedPersistence = await this._preparePersistenceForMethod("redirect")
            if (!selectedPersistence) return false
            try {
                await this._signInWithMethod("redirect")
                return true
            } catch (redirectError) {
                throw redirectError
            }
        },
        async login() {
            if (!auth || typeof firebase === "undefined") {
                console.error("[Auth] Firebase auth is unavailable: SDK not initialized")
                this._toast(this._t("auth_unavailable", "Authentication unavailable"))
                return
            }
            if (state.loginInFlight) return

            const existingUser = state.currentUser || auth.currentUser || null
            if (existingUser) {
                await this._handleAuthState(existingUser)
                return
            }

            this._setLoginBusy(true)
            this._showGoogleSignInPendingFeedback()

            await this._ensureLocalPersistence()
            try {
                await this._signInWithGoogleIdentity()
                this._setLoginBusy(false)
                return
            } catch (googleIdentityError) {
                const googleIdentityErrorCode = String(googleIdentityError?.code || "")
                const googleIdentityRecoverableCodes = new Set([
                    "auth/google-identity-script-timeout",
                    "auth/google-identity-script-failed",
                    "auth/google-identity-timeout",
                    "auth/google-identity-not-displayed",
                    "auth/google-identity-skipped",
                    "auth/google-identity-unavailable",
                    "auth/google-identity-empty-token"
                ])
                if (!googleIdentityRecoverableCodes.has(googleIdentityErrorCode)) {
                    this._setLoginBusy(false)
                    this.handleAuthError(googleIdentityError)
                    return
                }
            }
            const { methods } = planAuthMethods()
            let lastError = null

            for (const method of methods) {
                const selectedPersistence = await this._preparePersistenceForMethod(method)
                if (!selectedPersistence) continue

                try {
                    await this._signInWithMethod(method)
                    this._setLoginBusy(false)
                    return
                } catch (error) {
                    const errorCode = String(error?.code || "")
                    lastError = error
                    if (errorCode === "auth/popup-closed-by-user") {
                        this._setLoginBusy(false)
                        this.handleAuthError(error)
                        return
                    }
                }
            }

            if (lastError) {
                try {
                    const redirectRecoveryStarted = await this._attemptRedirectRecovery(lastError)
                    if (redirectRecoveryStarted) {
                        this._setLoginBusy(false)
                        return
                    }
                } catch (redirectRecoveryError) {
                    this._setLoginBusy(false)
                    this.handleAuthError(redirectRecoveryError)
                    return
                }
                this._setLoginBusy(false)
                this.handleAuthError(lastError)
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
        async loginWithEmail() {
            await this._ensureLocalPersistence()
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
        async _startSessionWhenReady(user, attempt = 0) {
            const maxAttempts = 20
            if (typeof SessionService !== "undefined" && typeof SessionService.startUserSession === "function") {
                await SessionService.startUserSession(user)
                return true
            }
            if (attempt >= maxAttempts) {
                this._toast(this._t("sync_error", "Sync error"))
                console.error("[Session] error", { code: "session-service-unavailable", message: "SessionService is not ready" })
                return false
            }
            await new Promise(resolve => setTimeout(resolve, 100))
            return this._startSessionWhenReady(user, attempt + 1)
        },
        _stopSessionWhenReady(attempt = 0) {
            const maxAttempts = 20
            if (typeof SessionService !== "undefined" && typeof SessionService.stopUserSession === "function") {
                SessionService.stopUserSession()
                return
            }
            if (attempt >= maxAttempts) return
            setTimeout(() => this._stopSessionWhenReady(attempt + 1), 100)
        },
        async _handleAuthState(user) {
            const normalizedUser = user || auth.currentUser || null
            const previousUserUid = String(state.currentUser?.uid || "")
            const nextUserUid = String(normalizedUser?.uid || "")
            const shouldSkipSessionRestart = !!nextUserUid && previousUserUid === nextUserUid && state.authReady
            state.currentUser = normalizedUser
            console.info("[Auth] state changed", normalizedUser ? "logged in" : "logged out")
            state.authReady = true
            StateActions.setUser(normalizedUser)

            if (normalizedUser) {
                this.applySignedInUI(normalizedUser)
                if (shouldSkipSessionRestart) return
                await this._startSessionWhenReady(normalizedUser)
                return
            }

            this._stopSessionWhenReady()
            this.clearState()
            this.applySignedOutUI()
        },
        async init() {
            if (!auth || state.initialized) return
            state.initialized = true

            this._setLoginBusy(false)
            this._ensureLocalAuthManager().bindUi()
            await this._ensureLocalPersistence()

            auth.onAuthStateChanged(async user => {
                this._setLoginBusy(false)
                this._resolveStartupScreen()
                await this._handleAuthState(user)
            }, error => {
                this._setLoginBusy(false)
                this._resolveStartupScreen()
                this.handleAuthError(error)
            })

            if (auth.currentUser) {
                this._resolveStartupScreen()
                await this._handleAuthState(auth.currentUser)
            }

            await this._preparePersistenceForRedirectResult()

            try {
                await auth.getRedirectResult()
            } catch (error) {
                const errorCode = String(error?.code || "")
                if (errorCode && errorCode !== "auth/no-auth-event" && errorCode !== "auth/internal-error") {
                    this.handleAuthError(error)
                } else {
                    console.warn("[Auth] Redirect result skipped", error)
                }
            } finally {
                this._setLoginBusy(false)
                this._resolveStartupScreen()
            }
        }
    }

    return manager
}
