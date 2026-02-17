import { setAuthPersistenceFromOrder, setupAuthPersistence } from "./authSafariFix.js"
import { planAuthMethods } from "./authFlowPlanner.js"
import { detectBrowserProfile } from "./authBrowserProfiles.js"
import { createLocalAuthManager } from "./localAuth.js"
import { requestGoogleIdentityToken } from "./googleIdentityAuth.js"

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
        _shouldUseGoogleIdentity(browserProfile) {
            if (!browserProfile) return false
            if (browserProfile.isMobile) return false
            if (browserProfile.isSafari) return true
            return false
        },
        _getGoogleIdentityTimeouts(browserProfile) {
            if (browserProfile?.isSafari) {
                return {
                    scriptTimeoutMilliseconds: 9000,
                    promptTimeoutMilliseconds: 12000
                }
            }
            return {
                scriptTimeoutMilliseconds: 2500,
                promptTimeoutMilliseconds: 2500
            }
        },
        async _signInWithGoogleIdentity() {
            const googleClientId = this._getGoogleClientId()
            if (!googleClientId) {
                throw { code: "auth/google-identity-client-id-missing", message: "Google client id is missing" }
            }
            const browserProfile = detectBrowserProfile()
            if (!this._shouldUseGoogleIdentity(browserProfile)) {
                throw { code: "auth/google-identity-skipped", message: "Google identity is skipped for this browser" }
            }
            const timeouts = this._getGoogleIdentityTimeouts(browserProfile)
            const token = await requestGoogleIdentityToken({
                clientId: googleClientId,
                scriptTimeoutMilliseconds: timeouts.scriptTimeoutMilliseconds,
                promptTimeoutMilliseconds: timeouts.promptTimeoutMilliseconds
            })
            const credential = firebase.auth.GoogleAuthProvider.credential(token)
            await auth.signInWithCredential(credential)
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
                "auth/internal-error": this._t("auth_network_failed", "No internet connection"),
                "auth/web-storage-unsupported": this._t("auth_storage_failed", "Storage is blocked in this browser"),
                "auth/operation-not-supported-in-this-environment": this._t("auth_env_failed", "Authentication is blocked in this browser"),
                "auth/invalid-email": this._t("auth_fill_required", "Fill in all required fields"),
                "auth/wrong-password": this._t("login_failed", "Sign-in failed"),
                "auth/user-not-found": this._t("auth_email_not_found", "No account found for this email"),
                "auth/email-already-in-use": this._t("auth_email_exists", "An account with this email already exists. Please sign in"),
                "auth/account-exists-with-different-credential": this._t("auth_email_provider_conflict", "A different sign-in method is used for this email"),
                "auth/redirect-persistence-unavailable": this._t("auth_storage_failed", "Storage is blocked in this browser"),
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
        async _preparePersistenceForMethod(method) {
            const persistenceEnum = this._getPersistenceEnum()
            if (!persistenceEnum) return null
            if (method === "redirect") {
                return setAuthPersistenceFromOrder(auth, [persistenceEnum.SESSION, persistenceEnum.LOCAL])
            }
            return setAuthPersistenceFromOrder(auth, [persistenceEnum.LOCAL, persistenceEnum.SESSION, persistenceEnum.NONE])
        },
        async _preparePersistenceForRedirectResult() {
            const persistenceEnum = this._getPersistenceEnum()
            if (!persistenceEnum) return null
            return setAuthPersistenceFromOrder(auth, [persistenceEnum.SESSION, persistenceEnum.LOCAL, persistenceEnum.NONE])
        },
        async _signInWithMethod(method) {
            if (method === "redirect") {
                await auth.signInWithRedirect(this._provider())
                return
            }
            await auth.signInWithPopup(this._provider())
        },
        async _setNoStoragePersistence() {
            const persistenceEnum = this._getPersistenceEnum()
            if (!persistenceEnum || !auth) return false
            try {
                await auth.setPersistence(persistenceEnum.NONE)
                return true
            } catch (error) {
                console.warn("[Auth] Failed to switch to NONE persistence", error)
                return false
            }
        },
        _createRedirectPersistenceError() {
            return {
                code: "auth/redirect-persistence-unavailable",
                message: "Redirect auth requires session or local persistence"
            }
        },
        _canRecoverWithRedirect(error) {
            const errorCode = String(error?.code || "")
            return errorCode === "auth/internal-error"
                || errorCode === "auth/network-request-failed"
                || errorCode === "auth/popup-blocked"
        },
        async _attemptRedirectRecovery(error, allowRedirectRecovery) {
            if (!allowRedirectRecovery) return false
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

            this._setLoginBusy(true)

            await setupAuthPersistence(auth)
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
            const authMethodPlan = planAuthMethods()
            const methods = authMethodPlan.methods
            const allowRedirectRecovery = methods.includes("redirect")
            const storageErrorCodes = new Set([
                "auth/web-storage-unsupported",
                "auth/operation-not-supported-in-this-environment"
            ])
            let lastError = null

            for (const method of methods) {
                const selectedPersistence = await this._preparePersistenceForMethod(method)
                if (method === "redirect" && !selectedPersistence) {
                    lastError = this._createRedirectPersistenceError()
                    continue
                }

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
                    if (storageErrorCodes.has(errorCode)) {
                        await this._setNoStoragePersistence()
                    }
                }
            }

            if (lastError) {
                const errorCode = String(lastError?.code || "")
                if (storageErrorCodes.has(errorCode)) {
                    await this._setNoStoragePersistence()
                    try {
                        const selectedPersistence = await this._preparePersistenceForMethod("popup")
                        if (!selectedPersistence) {
                            this._setLoginBusy(false)
                            this.handleAuthError(lastError)
                            return
                        }
                        await this._signInWithMethod("popup")
                        this._setLoginBusy(false)
                        return
                    } catch (retryError) {
                        this._setLoginBusy(false)
                        this.handleAuthError(retryError)
                        return
                    }
                }
                try {
                    const redirectRecoveryStarted = await this._attemptRedirectRecovery(lastError, allowRedirectRecovery)
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
            await setupAuthPersistence(auth)
            await this._ensureLocalAuthManager().loginWithEmail()
        },
        async logout() {
            if (!auth) return
            this._setLoginBusy(false)
            try {
                await auth.signOut()
                await this._setNoStoragePersistence()
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
            }

            auth.onAuthStateChanged(async user => {
                this._setLoginBusy(false)
                await this._handleAuthState(user)
            }, error => {
                this._setLoginBusy(false)
                this.handleAuthError(error)
            })
        }
    }

    return manager
}
