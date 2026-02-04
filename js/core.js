import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"

const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    snap: (value, step) => Math.round(value / step) * step,
    debounce: (func, wait) => {
        let timeout = null
        return function (...args) {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => func.apply(this, args), wait)
        }
    },
    formatDate: (timestamp) => {
        if (!timestamp) return ""
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
        const lang = (window.StateStore && StateStore.read().config && StateStore.read().config.lang) || "ru"
        try {
            return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
        } catch {
            return date.toLocaleDateString()
        }
    },
    stripHtml: (html) => {
        if (!html) return ""
        const tmp = document.createElement("div")
        tmp.innerHTML = html
        return tmp.textContent || tmp.innerText || ""
    },
    escapeHtml: (value) => {
        if (value === null || value === undefined) return ""
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
    },
    serverTimestamp: () => {
        if (typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue) {
            return firebase.firestore.FieldValue.serverTimestamp()
        }
        return Date.now()
    },
    sanitizeHtml: (html) => {
        const allowedTags = new Set(["b", "strong", "i", "em", "u", "br", "p", "div", "ul", "ol", "li", "span", "img", "a", "input"])
        const allowedClasses = new Set(["task-item", "task-checkbox", "task-text", "completed", "media-wrapper", "media-resize-handle", "align-left", "align-right"])
        const allowAttrs = {
            a: new Set(["href"]),
            img: new Set(["src", "alt"]),
            input: new Set(["type", "checked"])
        }
        const wrapper = document.createElement("div")
        wrapper.innerHTML = String(html || "")
        const isSafeUrl = (value) => {
            const v = String(value || "").trim()
            if (!v) return false
            if (v.startsWith("data:image")) return true
            if (v.startsWith("https://")) return true
            if (v.startsWith("http://")) return true
            if (v.startsWith("mailto:")) return true
            return false
        }
        const walk = (node) => {
            const children = Array.from(node.childNodes)
            children.forEach(child => {
                if (child.nodeType !== Node.ELEMENT_NODE) return
                const tag = child.tagName.toLowerCase()
                if (!allowedTags.has(tag)) {
                    const textNode = document.createTextNode(child.textContent || "")
                    child.replaceWith(textNode)
                    return
                }
                Array.from(child.attributes).forEach(attr => {
                    const name = attr.name.toLowerCase()
                    if (name.startsWith("on") || name === "style") {
                        child.removeAttribute(attr.name)
                        return
                    }
                    if (name === "class") {
                        const safe = String(attr.value || "")
                            .split(/\s+/)
                            .filter(cls => allowedClasses.has(cls))
                        if (safe.length) child.setAttribute("class", safe.join(" "))
                        else child.removeAttribute("class")
                        return
                    }
                    const allowed = allowAttrs[tag]
                    if (!allowed || !allowed.has(name)) child.removeAttribute(attr.name)
                })
                if (tag === "a") {
                    const href = child.getAttribute("href")
                    if (!isSafeUrl(href) || String(href || "").startsWith("data:")) {
                        child.removeAttribute("href")
                    } else if (String(href || "").startsWith("http")) {
                        child.setAttribute("rel", "noopener noreferrer")
                        child.setAttribute("target", "_blank")
                    }
                }
                if (tag === "img") {
                    const src = child.getAttribute("src")
                    const s = String(src || "")
                    if (!isSafeUrl(s) || (s.startsWith("data:") && !s.startsWith("data:image")) || s.startsWith("http:")) {
                        child.removeAttribute("src")
                    }
                }
                if (tag === "input") {
                    const type = String(child.getAttribute("type") || "").toLowerCase()
                    if (type !== "checkbox") child.removeAttribute("type")
                    if (child.hasAttribute("checked")) child.setAttribute("checked", "")
                }
                walk(child)
            })
        }
        walk(wrapper)
        return wrapper.innerHTML
    }
}

const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56",
    clientId: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
}

let auth = null
let db = null

if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)
    auth = firebase.auth()
    db = firebase.firestore()
    db.enablePersistence({ synchronizeTabs: true }).catch(() => null)
}

window.Utils = Utils
window.auth = auth
window.db = db

const Auth = {
    _mobileEnv() {
        const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches
        const ua = (navigator.userAgent || "").toLowerCase()
        const mobileUa = /android|iphone|ipad|ipod|iemobile|opera mini|mobile/.test(ua)
        const touchDevice = typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1
        const uaMobile = navigator.userAgentData && navigator.userAgentData.mobile
        return !!(coarse || mobileUa || touchDevice || uaMobile)
    },
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
            "auth/popup-closed-by-user": this._t("auth_popup_closed", "Sign-in canceled"),
            "auth/network-request-failed": this._t("auth_network_failed", "No internet connection"),
            "auth/cancelled-popup-request": this._t("auth_cancelled", "Request canceled"),
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
        const redirect = async () => {
            await auth.signInWithRedirect(provider)
        }
        try {
            if (this._mobileEnv()) {
                await redirect()
                return
            }
            await auth.signInWithPopup(provider)
        } catch (e) {
            const code = e && e.code ? e.code : ""
            const redirectCodes = new Set([
                "auth/popup-blocked",
                "auth/operation-not-supported-in-this-environment",
                "auth/cancelled-popup-request"
            ])
            const shouldRedirect = redirectCodes.has(code) || (this._mobileEnv() && code === "auth/popup-closed-by-user")
            if (shouldRedirect) {
                try {
                    await redirect()
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
        } catch (e) {
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
            setTimeout(() => {
                loginScreen.style.display = "none"
                loginScreen.classList.remove("active")
            }, 320)
        }
        if (appScreen) {
            appScreen.style.display = "flex"
            setTimeout(() => {
                appScreen.style.opacity = "1"
                appScreen.classList.add("active")
            }, 30)
        }
    },
    applySignedOutUI() {
        const loginScreen = document.getElementById("login-screen")
        const appScreen = document.getElementById("app")
        if (appScreen) {
            appScreen.style.opacity = "0"
            setTimeout(() => {
                appScreen.style.display = "none"
                appScreen.classList.remove("active")
            }, 220)
        }
        if (loginScreen) {
            loginScreen.style.display = "flex"
            setTimeout(() => {
                loginScreen.classList.add("active")
                loginScreen.style.opacity = "1"
            }, 30)
        }
    },
    resetSession() {
        this.clearState()
        this.applySignedOutUI()
    },
    async init() {
        if (!auth) return
        const redirectPromise = auth.getRedirectResult().catch(e => {
            this.handleAuthError(e)
            return null
        })
        let initialCheck = true
        auth.onAuthStateChanged(async user => {
            if (initialCheck) {
                await redirectPromise
                user = auth.currentUser
                initialCheck = false
            }
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

window.Auth = Auth

document.addEventListener("DOMContentLoaded", () => {
    if (typeof ThemeManager !== "undefined" && ThemeManager && typeof ThemeManager.init === "function") {
        ThemeManager.init()
    }
    if (typeof UI !== "undefined" && UI.captureShareFromHash) UI.captureShareFromHash()
    const loginButton = document.querySelector("[data-action='login']")
    if (loginButton) {
        loginButton.addEventListener("click", () => Auth.login())
    }
    Auth.init().catch(() => null)
    document.addEventListener("dblclick", (event) => {
        event.preventDefault()
    }, { passive: false })
})
