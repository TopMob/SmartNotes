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
    adjustColor: (col, amt) => {
        if (!col) return "#000000"
        let c = String(col).trim()
        let usePound = false
        if (c[0] === "#") {
            c = c.slice(1)
            usePound = true
        }
        if (c.length === 3) c = c.split("").map(x => x + x).join("")
        if (!/^[0-9a-fA-F]{6}$/.test(c)) return (usePound ? "#" : "") + "000000"
        const num = parseInt(c, 16)
        let r = (num >> 16) + amt
        let g = ((num >> 8) & 0x00ff) + amt
        let b = (num & 0x0000ff) + amt
        r = Math.min(255, Math.max(0, r))
        g = Math.min(255, Math.max(0, g))
        b = Math.min(255, Math.max(0, b))
        return (usePound ? "#" : "") + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")
    },
    hexToRgb: (hex) => {
        if (!hex) return null
        let c = String(hex).trim()
        if (c[0] === "#") c = c.slice(1)
        if (c.length === 3) c = c.split("").map(x => x + x).join("")
        if (!/^[0-9a-fA-F]{6}$/.test(c)) return null
        const num = parseInt(c, 16)
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
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

const DRIVE_CLIENT_ID = "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file"

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
window.DRIVE_CLIENT_ID = DRIVE_CLIENT_ID
window.DRIVE_SCOPES = DRIVE_SCOPES

const Auth = {
    _loginInProgress: false,
    _persistenceReady: false,
    _listeners: new Set(),
    _errorListeners: new Set(),
    _currentUser: null,
    _redirectKey: "sn-auth-redirect-v2",
    _redirectTtl: 5 * 60 * 1000,
    _redirectVersion: 2,
    _provider() {
        const p = new firebase.auth.GoogleAuthProvider()
        p.setCustomParameters({ prompt: "select_account" })
        return p
    },
    onStateChange(cb) {
        if (typeof cb === "function") {
            this._listeners.add(cb)
            cb(this._currentUser)
        }
        return () => this._listeners.delete(cb)
    },
    onError(cb) {
        if (typeof cb === "function") this._errorListeners.add(cb)
        return () => this._errorListeners.delete(cb)
    },
    _emitState(user) {
        this._currentUser = user || null
        this._listeners.forEach(cb => {
            try { cb(this._currentUser) } catch {}
        })
    },
    _emitError(info) {
        this._errorListeners.forEach(cb => {
            try { cb(info) } catch {}
        })
    },
    getCurrentUser() {
        return this._currentUser
    },
    _normalizeError(e) {
        const code = e && e.code ? String(e.code) : "auth/unknown"
        const message = e && e.message ? String(e.message) : ""
        return { code, message }
    },
    _storageAvailable() {
        try {
            const key = "__sn_ls_test__"
            localStorage.setItem(key, "1")
            localStorage.removeItem(key)
            return true
        } catch {
            return false
        }
    },
    _readRedirectMarker() {
        if (!this._storageAvailable()) return null
        try {
            const raw = localStorage.getItem(this._redirectKey)
            if (!raw) return null
            const data = JSON.parse(raw)
            if (!data || data.v !== this._redirectVersion) {
                localStorage.removeItem(this._redirectKey)
                return null
            }
            if (!data.ts || Date.now() - data.ts > this._redirectTtl) {
                localStorage.removeItem(this._redirectKey)
                return null
            }
            return data
        } catch {
            return null
        }
    },
    _writeRedirectMarker() {
        if (!this._storageAvailable()) return
        try {
            localStorage.setItem(this._redirectKey, JSON.stringify({ v: this._redirectVersion, ts: Date.now() }))
        } catch {}
    },
    _clearRedirectMarker() {
        if (!this._storageAvailable()) return
        try {
            localStorage.removeItem(this._redirectKey)
        } catch {}
    },
    async detectEnvironment() {
        const ua = String(navigator.userAgent || "")
        const uaLower = ua.toLowerCase()
        const isIOS = /iphone|ipad|ipod/.test(uaLower)
        const isAndroid = /android/.test(uaLower)
        const isMobile = isIOS || isAndroid || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
        const isIOSStandalone = !!(navigator.standalone || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches))
        const isIOSSafari = isIOS && /safari/.test(uaLower) && !/crios|fxios|opios|edgios|brave/.test(uaLower)
        const isIOSWebView = isIOS && /applewebkit/.test(uaLower) && !/safari/.test(uaLower)
        const isAndroidWebView = /\bwv\b/.test(uaLower) || /; wv\)/.test(uaLower) || (isAndroid && /version\/\d+\.\d+/.test(uaLower) && /chrome/.test(uaLower) && !/samsungbrowser|opr\/|opera|edg/.test(uaLower))
        const isFirefox = /firefox/.test(uaLower)
        const isEdge = /edg/.test(uaLower)
        const isOpera = /opera|opr\//.test(uaLower)
        let isBrave = false
        try {
            if (navigator.brave && typeof navigator.brave.isBrave === "function") {
                isBrave = await navigator.brave.isBrave()
            }
        } catch {}
        if (!isBrave && /brave/.test(uaLower)) isBrave = true
        const isChromium = /chrome|crios|chromium/.test(uaLower) && !isEdge && !isOpera
        const isWebView = isIOSWebView || isAndroidWebView
        const cookiesEnabled = typeof navigator.cookieEnabled === "boolean" ? navigator.cookieEnabled : true
        return { isIOS, isAndroid, isMobile, isIOSStandalone, isIOSSafari, isWebView, isFirefox, isEdge, isOpera, isChromium, isBrave, cookiesEnabled }
    },
    async _ensurePersistence() {
        if (this._persistenceReady || !auth) return
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            this._persistenceReady = true
            return
        } catch {}
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
            this._persistenceReady = true
        } catch {}
    },
    async _getRedirectResultSafe() {
        if (!auth) return null
        try {
            return await auth.getRedirectResult()
        } catch (e) {
            this._emitError(this._normalizeError(e))
            return null
        }
    },
    async login() {
        if (!auth || typeof firebase === "undefined") {
            this._emitError({ code: "auth/unavailable", message: "" })
            return
        }
        if (this._loginInProgress) return
        this._loginInProgress = true
        await this._ensurePersistence()
        const env = await this.detectEnvironment()
        const provider = this._provider()
        try {
            const preferRedirect = env.isMobile || env.isWebView || env.isIOSStandalone || env.isIOSSafari
            const canPopup = !env.isWebView && !env.isIOSStandalone && !env.isIOSSafari && !env.isMobile
            const attemptRedirect = async () => {
                this._writeRedirectMarker()
                await auth.signInWithRedirect(provider)
            }
            const attemptPopup = async () => {
                await auth.signInWithPopup(provider)
            }
            if (preferRedirect) {
                try {
                    await attemptRedirect()
                    return
                } catch (err) {
                    if (canPopup) {
                        await attemptPopup()
                        return
                    }
                    this._emitError(this._normalizeError(err))
                    return
                }
            }
            try {
                await attemptPopup()
            } catch (e) {
                const code = e && e.code ? String(e.code) : ""
                const fallbackCodes = new Set([
                    "auth/popup-blocked",
                    "auth/operation-not-supported-in-this-environment",
                    "auth/cancelled-popup-request",
                    "auth/popup-closed-by-user",
                    "auth/web-storage-unsupported"
                ])
                if (fallbackCodes.has(code)) {
                    try {
                        await attemptRedirect()
                        return
                    } catch (err) {
                        this._emitError(this._normalizeError(err))
                        return
                    }
                }
                this._emitError(this._normalizeError(e))
            }
        } finally {
            this._loginInProgress = false
        }
    },
    openExternalBrowser() {
        const url = window.location.href
        let opened = null
        try {
            opened = window.open(url, "_blank", "noopener,noreferrer")
        } catch {}
        if (!opened) {
            try {
                window.location.href = url
            } catch {}
        }
    },
    async logout() {
        if (!auth) return
        try {
            await auth.signOut()
        } catch (e) {
            this._emitError(this._normalizeError(e))
        }
    },
    async switchAccount() {
        if (!auth) return
        try {
            await auth.signOut()
            await this.login()
        } catch (e) {
            this._emitError(this._normalizeError(e))
        }
    },
    async init() {
        if (!auth) return
        await this._ensurePersistence()
        const redirectMarker = this._readRedirectMarker()
        const redirectResult = await this._getRedirectResultSafe()
        const redirectUser = redirectResult && redirectResult.user ? redirectResult.user : null
        if (redirectMarker) this._clearRedirectMarker()
        this._loginInProgress = false
        let initialCheck = true
        auth.onAuthStateChanged(async user => {
            if (initialCheck) {
                user = auth.currentUser || redirectUser
                initialCheck = false
            }
            this._emitState(user || null)
            if (!user && redirectMarker) {
                setTimeout(() => {
                    if (!auth.currentUser) {
                        this._emitError({ code: "auth/redirect-failed", message: "" })
                        this._emitState(null)
                    }
                }, 1500)
            }
        })
    }
}

window.Auth = Auth

document.addEventListener("DOMContentLoaded", () => {
    Auth.init().catch(() => null)
    if (typeof UI !== "undefined" && UI.init) UI.init()
    if (typeof ThemeManager !== "undefined" && ThemeManager && typeof ThemeManager.init === "function") {
        ThemeManager.init()
    }
})
