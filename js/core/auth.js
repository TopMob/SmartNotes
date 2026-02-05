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
        _browserMeta() {
            const ua = (navigator.userAgent || "").toLowerCase()
            const isIOS = /iphone|ipad|ipod/.test(ua)
            const isAndroid = /android/.test(ua)
            const isMobile = isIOS || isAndroid || /mobile/.test(ua)
            const isSafari = /safari/.test(ua) && !/chrome|chromium|crios|fxios|edg\//.test(ua)
            const isFirefox = /firefox|fxios/.test(ua)
            const isBrave = !!(navigator.brave && typeof navigator.brave.isBrave === "function")
            return { isIOS, isAndroid, isMobile, isSafari, isFirefox, isBrave }
        },
        _canUsePopup() {
            const meta = this._browserMeta()
            if (meta.isMobile) return false
            if (window.self !== window.top) return false
            const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches
            return !standalone
        },
        _preferPopupFirst() {
            const meta = this._browserMeta()
            return meta.isSafari || meta.isBrave
        },
        _popupFallbackCodes() {
            return new Set([
                "auth/popup-blocked",
                "auth/popup-closed-by-user",
                "auth/cancelled-popup-request",
                "auth/operation-not-supported-in-this-environment",
                "auth/web-storage-unsupported",
                "auth/unauthorized-domain",
                "auth/internal-error"
            ])
        },
        _redirectFallbackCodes() {
            return new Set([
                "auth/operation-not-supported-in-this-environment",
                "auth/unauthorized-domain",
                "auth/internal-error",
                "auth/web-storage-unsupported"
            ])
        },
        handleAuthError(e) {
            const code = e && e.code ? e.code : "auth/unknown"
            const message = e && e.message ? String(e.message) : ""
            const map = {
                "auth/network-request-failed": this._t("auth_network_failed", "No internet connection"),
                "auth/popup-closed-by-user": this._t("auth_popup_closed", "Sign-in canceled"),
                "auth/cancelled-popup-request": this._t("auth_cancelled", "Request canceled"),
                "-40": this._t("auth_network_failed", "No internet connection")
            }
            const serviceUnavailable = message.includes("503") || message.toLowerCase().includes("unavailable")
            const msg = map[code] || (serviceUnavailable ? this._t("auth_service_unavailable", "Service temporarily unavailable") : `${this._t("login_failed", "Sign-in failed")}: ${code}`)
            this._toast(msg)
        },
        async _setPersistence() {
            if (typeof firebase === "undefined" || !auth || typeof auth.setPersistence !== "function") return
            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            } catch {
                return
            }
        },
        async _loginWithPopup(provider) {
            return auth.signInWithPopup(provider)
        },
        async _loginWithRedirect(provider) {
            return auth.signInWithRedirect(provider)
        },
        async login() {
            if (!auth || typeof firebase === "undefined") {
                this._toast(this._t("auth_unavailable", "Authentication unavailable"))
                return
            }
            const provider = this._provider()
            await this._setPersistence()
            const usePopup = this._canUsePopup() && this._preferPopupFirst()
            if (usePopup) {
                try {
                    await this._loginWithPopup(provider)
                    return
                } catch (e) {
                    const code = e && e.code ? e.code : ""
                    if (!this._popupFallbackCodes().has(code)) {
                        this.handleAuthError(e)
                        return
                    }
                    try {
                        await this._loginWithRedirect(provider)
                        return
                    } catch (err) {
                        this.handleAuthError(err)
                        return
                    }
                }
            }
            try {
                await this._loginWithRedirect(provider)
            } catch (e) {
                const code = e && e.code ? e.code : ""
                if (this._canUsePopup() && this._redirectFallbackCodes().has(code)) {
                    try {
                        await this._loginWithPopup(provider)
                        return
                    } catch (err) {
                        this.handleAuthError(err)
                        return
                    }
                }
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
