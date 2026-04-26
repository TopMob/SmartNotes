import { createLocalAuthManager } from "./localAuth.js"

export function createAuthManager({ auth }) {
    const state = {
        initialized: false,
        loginInFlight: false,
        authReady: false,
        currentUser: null,
        authActionElements: [],
        localAuthManager: null,
        persistenceReady: false,
        authStateResolved: false,
        googleRedirectFallbackReady: false,
        googleRedirectFallbackTimer: null
    }

    const manager = {
        _t(key, fallback) {
            return (typeof UI !== "undefined" && UI.getText) ? UI.getText(key, fallback) : (fallback || key)
        },
        _toast(text) {
            if (typeof UI !== "undefined" && UI.showToast) UI.showToast(text)
            else console.error(text)
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
        _setLoginBusy(flag) {
            state.loginInFlight = !!flag
            this._collectAuthActionElements()
            for (const actionElement of state.authActionElements) {
                actionElement.disabled = !!flag
                actionElement.setAttribute("aria-busy", flag ? "true" : "false")
                actionElement.classList.toggle("is-loading", !!flag)
            }
            if (!flag) {
                this._setAuthFeedback("")
            }
        },
        async _startRedirectFallback() {
            state.googleRedirectFallbackReady = false
            if (state.googleRedirectFallbackTimer) {
                clearTimeout(state.googleRedirectFallbackTimer)
                state.googleRedirectFallbackTimer = null
            }
            this._setLoginBusy(true)
            this._setAuthFeedback(this._t("auth_google_redirect_starting", "Opening backup Google sign-in..."), "info")
            try {
                await auth.signInWithRedirect()
            } finally {
                this._setLoginBusy(false)
            }
        },
        _scheduleRedirectFallbackRetry() {
            if (state.googleRedirectFallbackTimer) return
            state.googleRedirectFallbackReady = false
            this._setLoginBusy(true)
            this._setAuthFeedback(this._t("auth_google_redirect_ready_soon", "If the Google window did not appear, wait 5 seconds and press the button again"), "info")
            state.googleRedirectFallbackTimer = setTimeout(() => {
                state.googleRedirectFallbackTimer = null
                state.googleRedirectFallbackReady = true
                this._setLoginBusy(false)
                this._setAuthFeedback(this._t("auth_google_redirect_ready", "Google window did not open. Press the button again to continue with backup sign-in"), "info")
            }, 5000)
        },
        _setAuthInteractivity(flag) {
            const interactive = !!flag
            document.querySelectorAll(".auth-panel-switch, #email-signin-form, #email-signup-form").forEach((element) => {
                if (!(element instanceof HTMLElement)) return
                if (interactive) {
                    element.removeAttribute("inert")
                    element.setAttribute("aria-busy", "false")
                    return
                }
                element.setAttribute("inert", "")
                element.setAttribute("aria-busy", "true")
            })
        },
        setAuthReady(flag) {
            const ready = !!flag
            state.authReady = ready
            this._setAuthInteractivity(ready)
            this._collectAuthActionElements()
            for (const actionElement of state.authActionElements) {
                if (!ready) continue
                actionElement.disabled = false
                actionElement.removeAttribute("aria-disabled")
            }
            if (window.SmartNotesAuthUi && typeof window.SmartNotesAuthUi.markReady === "function" && ready) {
                window.SmartNotesAuthUi.markReady()
            }
        },
        setDegradedState(message) {
            this._setAuthInteractivity(false)
            this._collectAuthActionElements()
            for (const actionElement of state.authActionElements) {
                actionElement.disabled = true
                actionElement.setAttribute("aria-disabled", "true")
            }
            const forms = [document.getElementById("email-signin-form"), document.getElementById("email-signup-form")]
            forms.forEach((formElement) => {
                if (!(formElement instanceof HTMLFormElement)) return
                Array.from(formElement.elements).forEach((field) => {
                    if (!(field instanceof HTMLElement)) return
                    if (field instanceof HTMLInputElement || field instanceof HTMLButtonElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
                        field.disabled = true
                        field.setAttribute("aria-disabled", "true")
                    }
                })
            })
            this._setAuthFeedback(message || this._t("auth_service_unavailable", "Service temporarily unavailable"), "error")
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
                "auth/google-identity-client-id-missing": this._t("auth_service_unavailable", "Service temporarily unavailable"),
                "auth/google-identity-script-timeout": this._t("auth_network_failed", "No internet connection"),
                "auth/google-identity-script-failed": this._t("auth_network_failed", "No internet connection"),
                "auth/google-identity-unavailable": this._t("auth_env_failed", "Authentication is blocked in this browser"),
                "auth/google-identity-not-displayed": this._t("auth_popup_blocked", "Popup was blocked by the browser"),
                "auth/google-identity-dismissed": this._t("auth_popup_closed", "Sign-in canceled"),
                "auth/google-identity-skipped": this._t("auth_popup_closed", "Sign-in canceled"),
                "auth/google-identity-timeout": this._t("auth_network_failed", "No internet connection"),
                "auth/google-id-token-sign-in-timeout": this._t("auth_network_failed", "No internet connection"),
                "invalid_credentials": this._t("login_failed", "Sign-in failed")
            }
            const serviceUnavailable = message.includes("503") || message.includes("unavailable")
            const invalidCredentials = message.includes("invalid login credentials") || message.includes("invalid credentials")
            const emailExists = message.includes("already registered") || message.includes("already been registered")
            const emailNotConfirmed = message.includes("email not confirmed")
            const text = (emailNotConfirmed
                ? this._t("auth_email_not_confirmed", "Подтвердите email перед входом")
                : emailExists
                    ? this._t("auth_email_exists", "An account with this email already exists. Please sign in")
                    : invalidCredentials
                        ? this._t("login_failed", "Sign-in failed")
                        : map[code]) || (serviceUnavailable
                ? this._t("auth_service_unavailable", "Service temporarily unavailable")
                : `${this._t("login_failed", "Sign-in failed")}: ${code}`)
            this._toast(text)
            console.error("[Auth] login error", code, err)
        },
        _getPersistenceEnum() {
            return auth?.Auth?.Persistence || null
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
        _shouldUseGoogleRedirectFallback(error) {
            const errorCode = String(error?.code || "")
            const errorMessage = String(error?.message || "").toLowerCase()
            return [
                "auth/google-identity-not-displayed",
                "auth/google-identity-skipped",
                "auth/google-identity-dismissed",
                "auth/google-identity-timeout",
                "auth/google-identity-unavailable",
                "auth/google-identity-script-timeout",
                "auth/google-identity-script-failed",
                "auth/google-identity-empty-token",
                "auth/google-id-token-sign-in-timeout",
                "network_error",
                "request_timeout"
            ].includes(errorCode)
                || errorMessage.includes("client_id and issuer required")
                || errorMessage.includes("fetch failed")
                || errorMessage.includes("failed to fetch")
                || errorMessage.includes("invalid request")
                || errorMessage.includes("issuer required")
                || errorMessage.includes("load failed")
                || errorMessage.includes("network")
                || errorMessage.includes("abort")
                || errorMessage.includes("timeout")
        },
        async login() {
            if (!auth) {
                console.error("[Auth] auth is unavailable: SDK not initialized")
                this._toast(this._t("auth_unavailable", "Authentication unavailable"))
                return
            }
            if (state.loginInFlight) return

            const existingUser = state.currentUser || auth.currentUser || null
            if (existingUser) {
                await this._handleAuthState(existingUser)
                return
            }

            await this._ensureLocalPersistence()
            if (state.googleRedirectFallbackReady && typeof auth.signInWithRedirect === "function") {
                try {
                    await this._startRedirectFallback()
                } catch (error) {
                    this.handleAuthError(error)
                }
                return
            }

            this._setLoginBusy(true)
            this._setAuthFeedback(this._t("auth_google_starting", "Opening Google sign-in..."), "info")
            let keepBusyForRedirectFallback = false
            try {
                const result = typeof auth.signInWithGoogleOneTap === "function"
                    ? await auth.signInWithGoogleOneTap()
                    : await auth.signInWithPopup()
                if (result?.user) {
                    await this._handleAuthState(result.user)
                }
            } catch (error) {
                const canFallbackToRedirect = this._shouldUseGoogleRedirectFallback(error)
                if (canFallbackToRedirect && typeof auth.signInWithRedirect === "function") {
                    keepBusyForRedirectFallback = true
                    this._scheduleRedirectFallbackRetry()
                } else {
                    this.handleAuthError(error)
                }
            } finally {
                if (!keepBusyForRedirectFallback) {
                    this._setLoginBusy(false)
                }
            }
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
                await this._handleAuthState(null)
            } catch {
                this._toast(this._t("logout_failed", "Sign out failed"))
            }
        },
        async switchAccount() {
            await this.logout()
            await this.loginWithEmail()
        },

        async updateDisplayName(nextName = "") {
            const user = auth?.currentUser
            const normalizedName = String(nextName || "").trim()
            if (!user || !normalizedName) return false
            if (normalizedName.length > 50) return false
            let updatedUser = user
            if (typeof user.updateProfile === "function") {
                updatedUser = await user.updateProfile({ displayName: normalizedName }) || user
            }
            const accessToken = String(updatedUser?.accessToken || auth?.currentUser?.accessToken || window.__smartnotesGetSupabaseAccessToken?.() || "")
            if (accessToken) {
                await fetch("/api/supabase/session", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`
                    }
                })
            }
            this.applySignedInUI({ ...updatedUser, displayName: normalizedName })
            return true
        },


        async updateAvatarFromFile(file) {
            const user = auth?.currentUser
            if (!user || !(file instanceof Blob)) return false
            const readDataUrl = () => new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(String(reader.result || ""))
                reader.onerror = () => reject(new Error("read_failed"))
                reader.readAsDataURL(file)
            })
            const source = await readDataUrl()
            const image = await new Promise((resolve, reject) => {
                const img = new Image()
                img.onload = () => resolve(img)
                img.onerror = () => reject(new Error("image_invalid"))
                img.src = source
            })
            const canvas = document.createElement("canvas")
            const maxSize = 256
            const ratio = Math.min(1, maxSize / Math.max(image.width, image.height))
            canvas.width = Math.max(1, Math.round(image.width * ratio))
            canvas.height = Math.max(1, Math.round(image.height * ratio))
            const context = canvas.getContext("2d")
            if (!context) return false
            context.drawImage(image, 0, 0, canvas.width, canvas.height)
            const avatarDataUrl = canvas.toDataURL("image/jpeg", 0.82)
            let updatedUser = user
            if (typeof user.updateProfile === "function") {
                updatedUser = await user.updateProfile({ photoURL: avatarDataUrl }) || user
            }
            const accessToken = String(updatedUser?.accessToken || auth?.currentUser?.accessToken || window.__smartnotesGetSupabaseAccessToken?.() || "")
            if (accessToken) {
                await fetch("/api/supabase/session", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`
                    }
                })
            }
            this.applySignedInUI({ ...updatedUser, photoURL: avatarDataUrl })
            return true
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
            const userUid = document.getElementById("user-uid")

            if (userPhoto) userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || "User")}&background=random&color=fff`
            if (userName) userName.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "User")
            if (userUid) userUid.textContent = "••••••"

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
            const normalizedUser = user === undefined
                ? (auth.currentUser || null)
                : user
            const previousUserUid = String(state.currentUser?.uid || "")
            const nextUserUid = String(normalizedUser?.uid || "")
            const shouldSkipSessionRestart = !!nextUserUid && previousUserUid === nextUserUid && state.authReady
            state.currentUser = normalizedUser
            state.authReady = true
            this.setAuthReady(true)
            this._resolveStartupScreen()
            StateActions.setUser(normalizedUser)

            if (normalizedUser) {
                this.applySignedInUI(normalizedUser)
                if (shouldSkipSessionRestart) {
                    return
                }
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
            this.setAuthReady(false)
            if (!auth.currentUser && typeof auth.preloadGoogleSignIn === "function") {
                auth.preloadGoogleSignIn().catch(() => false)
            }

            auth.onAuthStateChanged(async user => {
                this._setLoginBusy(false)
                await this._handleAuthState(user)
            }, error => {
                this._setLoginBusy(false)
                this.handleAuthError(error)
            })

            try {
                await this._preparePersistenceForRedirectResult()
            } catch (error) {
                console.warn("[Auth] Persistence setup failed", error)
            }

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
        }
    }

    return manager
}
