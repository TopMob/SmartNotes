import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"

const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    clamp: (v, min, max) => Math.min(Math.max(v, min), max),
    snap: (v, s) => Math.round(v / s) * s,
    debounce: (fn, w) => {
        let t = null
        return (...a) => {
            clearTimeout(t)
            t = setTimeout(() => fn(...a), w)
        }
    },
    formatDate: (ts) => {
        if (!ts) return ""
        const d = ts.toDate ? ts.toDate() : new Date(ts)
        try {
            return new Intl.DateTimeFormat(
                (window.StateStore?.read()?.config?.lang) || "ru",
                { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
            ).format(d)
        } catch {
            return d.toLocaleString()
        }
    },
    stripHtml: (h) => {
        const d = document.createElement("div")
        d.innerHTML = h || ""
        return d.textContent || ""
    },
    serverTimestamp: () => {
        if (window.firebase?.firestore?.FieldValue) {
            return firebase.firestore.FieldValue.serverTimestamp()
        }
        return Date.now()
    }
}

const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
}

let auth = null
let db = null

if (window.firebase) {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)
    auth = firebase.auth()
    db = firebase.firestore()
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {})
}

window.Utils = Utils
window.auth = auth
window.db = db

const Auth = {
    user: null,
    listeners: new Set(),
    busy: false,

    on(cb) {
        this.listeners.add(cb)
        cb(this.user)
        return () => this.listeners.delete(cb)
    },

    emit(u) {
        this.user = u
        this.listeners.forEach(f => {
            try { f(u) } catch {}
        })
    },

    async init() {
        if (!auth) return
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        } catch {
            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
            } catch {}
        }
        auth.onAuthStateChanged(u => this.emit(u || null))
        try {
            const r = await auth.getRedirectResult()
            if (r?.user) this.emit(r.user)
        } catch {}
    },

    async login() {
        if (!auth || this.busy) return
        this.busy = true
        const p = new firebase.auth.GoogleAuthProvider()
        p.setCustomParameters({ prompt: "select_account" })

        const ua = navigator.userAgent.toLowerCase()
        const ios = /iphone|ipad|ipod/.test(ua)
        const safari = ios && /safari/.test(ua) && !/crios|fxios|opios|edgios|brave/.test(ua)
        const mobile = ios || /android/.test(ua)

        try {
            if (mobile || safari) {
                await auth.signInWithRedirect(p)
            } else {
                await auth.signInWithPopup(p)
            }
        } catch (e) {
            try {
                await auth.signInWithRedirect(p)
            } catch {}
        } finally {
            this.busy = false
        }
    },

    async logout() {
        if (!auth) return
        try { await auth.signOut() } catch {}
    }
}

window.Auth = Auth

document.addEventListener("DOMContentLoaded", async () => {
    await Auth.init()
    if (window.UI?.init) UI.init()
    if (ThemeManager?.init) ThemeManager.init()
})
