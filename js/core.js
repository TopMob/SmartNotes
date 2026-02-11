import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { initFirebase } from "./core/firebase.js"
import { setupAuthPersistence } from "./core/authSafariFix.js"
import { createAuthManager } from "./core/auth.js"
import { bootstrapCore } from "./core/bootstrap.js"

const core = window.__smartnotesCore || (() => {
    const context = { auth: null, db: null, Auth: null }
    window.__smartnotesCore = context
    return context
})()

let resolveAuthReady = null
const authReady = new Promise(resolve => {
    resolveAuthReady = resolve
})

const AuthProxy = {
    login: () => authReady.then(auth => auth.login()),
    loginWithEmail: () => authReady.then(auth => auth.loginWithEmail()),
    logout: () => authReady.then(auth => auth.logout()),
    switchAccount: () => authReady.then(auth => auth.switchAccount())
}
core.Auth = core.Auth || AuthProxy

window.Utils = Utils
window.auth = core.auth
window.db = core.db
window.Auth = core.Auth
window.LANG = LANG

const firebaseRuntimeSources = [
    [
        "https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js",
        "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js",
        "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"
    ],
    [
        "https://cdn.jsdelivr.net/npm/firebase@9.6.1/firebase-app-compat.js",
        "https://cdn.jsdelivr.net/npm/firebase@9.6.1/firebase-auth-compat.js",
        "https://cdn.jsdelivr.net/npm/firebase@9.6.1/firebase-firestore-compat.js"
    ]
]

function waitForFirebaseAvailability(timeoutMilliseconds) {
    return new Promise(resolve => {
        if (typeof firebase !== "undefined") {
            resolve(true)
            return
        }
        const startedAt = Date.now()
        const poll = () => {
            if (typeof firebase !== "undefined") {
                resolve(true)
                return
            }
            if (Date.now() - startedAt >= timeoutMilliseconds) {
                resolve(false)
                return
            }
            setTimeout(poll, 50)
        }
        poll()
    })
}

function loadExternalScript(url, timeoutMilliseconds) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) {
            resolve()
            return
        }

        const scriptElement = document.createElement("script")
        scriptElement.src = url
        scriptElement.async = true

        const timeoutId = setTimeout(() => {
            scriptElement.remove()
            reject(new Error(`Script load timeout: ${url}`))
        }, timeoutMilliseconds)

        scriptElement.addEventListener("load", () => {
            clearTimeout(timeoutId)
            resolve()
        }, { once: true })

        scriptElement.addEventListener("error", () => {
            clearTimeout(timeoutId)
            scriptElement.remove()
            reject(new Error(`Script load failed: ${url}`))
        }, { once: true })

        document.head.appendChild(scriptElement)
    })
}

async function ensureFirebaseRuntime() {
    if (typeof firebase !== "undefined") return true

    const initialWaitSucceeded = await waitForFirebaseAvailability(2500)
    if (initialWaitSucceeded) return true

    for (const sourceSet of firebaseRuntimeSources) {
        try {
            for (const sourceUrl of sourceSet) {
                await loadExternalScript(sourceUrl, 4000)
            }
        } catch {
            continue
        }

        const sourceWaitSucceeded = await waitForFirebaseAvailability(2000)
        if (sourceWaitSucceeded) return true
    }

    return false
}

async function startCore() {
    await ensureFirebaseRuntime()

    if (!core.auth || !core.db) {
        const { auth, db } = initFirebase()
        core.auth = auth
        core.db = db
        window.auth = core.auth
        window.db = core.db
    }

    await setupAuthPersistence(core.auth)
    const authManager = createAuthManager({ auth: core.auth })
    core.Auth = authManager
    window.Auth = core.Auth
    resolveAuthReady(authManager)
    authManager.init().catch(error => {
        console.error("[Core] Auth manager init failed", error)
    })
}

bootstrapCore({ ThemeManager, Auth: core.Auth })
startCore().catch(error => {
    console.error("[Core] Startup failed", error)
    showRuntimeErrorMessage("Не удалось запустить приложение. Перезагрузите страницу")
})
