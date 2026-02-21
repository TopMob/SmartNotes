import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { initFirebase } from "./core/firebase.js"
import { createAuthManager } from "./core/auth.js"
import { bootstrapCore } from "./core/bootstrap.js"
import { APP_MESSAGES, getAppMessage } from "./core/messages.js"
import { validateFolderName, validateFolderDescription, canAddFolder, canAddCustomTheme, canAssignToFolder, FOLDER_DESCRIPTION_SOFT_LIMIT, FOLDER_DESCRIPTION_HARD_LIMIT } from "./core/validators.js"
import { normalizeDateValue, buildNotePayload, buildNoteUpdatePayload } from "./core/noteHelpers.js"

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
window.AppMessages = { APP_MESSAGES, getAppMessage }
window.Validators = {
    validateFolderName,
    validateFolderDescription,
    canAddFolder,
    canAddCustomTheme,
    canAssignToFolder,
    FOLDER_DESCRIPTION_SOFT_LIMIT,
    FOLDER_DESCRIPTION_HARD_LIMIT
}
window.NoteHelpers = { normalizeDateValue, buildNotePayload, buildNoteUpdatePayload }

const firebaseRuntimeSources = [
    {
        name: "gstatic",
        urls: [
            "https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js",
            "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js",
            "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"
        ]
    },
    {
        name: "jsdelivr",
        urls: [
            "https://cdn.jsdelivr.net/npm/firebase@9.6.1/firebase-app-compat.js",
            "https://cdn.jsdelivr.net/npm/firebase@9.6.1/firebase-auth-compat.js",
            "https://cdn.jsdelivr.net/npm/firebase@9.6.1/firebase-firestore-compat.js"
        ]
    },
    {
        name: "unpkg",
        urls: [
            "https://unpkg.com/firebase@9.6.1/firebase-app-compat.js",
            "https://unpkg.com/firebase@9.6.1/firebase-auth-compat.js",
            "https://unpkg.com/firebase@9.6.1/firebase-firestore-compat.js"
        ]
    },
    {
        name: "cdnjs",
        urls: [
            "https://cdnjs.cloudflare.com/ajax/libs/firebase/9.6.1/firebase-app-compat.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/firebase/9.6.1/firebase-auth-compat.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/firebase/9.6.1/firebase-firestore-compat.min.js"
        ]
    }
]

const firebaseRuntimeWarnedSources = new Set()

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
        const existingScriptElement = document.querySelector(`script[src="${url}"]`)
        if (existingScriptElement) {
            if (typeof firebase !== "undefined") {
                resolve()
                return
            }
            setTimeout(() => {
                if (typeof firebase !== "undefined") {
                    resolve()
                    return
                }
                reject(new Error(`Script present but runtime unavailable: ${url}`))
            }, 1200)
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

    const initialWaitSucceeded = await waitForFirebaseAvailability(350)
    if (initialWaitSucceeded) return true

    for (const sourceSet of firebaseRuntimeSources) {
        try {
            for (const sourceUrl of sourceSet.urls) {
                await loadExternalScript(sourceUrl, 7000)
            }
        } catch (error) {
            if (!firebaseRuntimeWarnedSources.has(sourceSet.name)) {
                firebaseRuntimeWarnedSources.add(sourceSet.name)
                console.warn(`[Core] Firebase CDN failed: ${sourceSet.name}`, error)
            }
            continue
        }

        const sourceWaitSucceeded = await waitForFirebaseAvailability(3500)
        if (sourceWaitSucceeded) return true
    }

    return false
}


function initializeSplashScreen() {
    const splashScreen = document.getElementById("splash-screen")
    if (!splashScreen) return () => {}
    let hidden = false
    const hideSplashScreen = () => {
        if (hidden) return
        hidden = true
        splashScreen.classList.add("hidden")
        setTimeout(() => {
            splashScreen.classList.remove("active")
            splashScreen.style.display = "none"
        }, 360)
    }
    splashScreen.classList.add("active")
    splashScreen.style.display = "flex"
    const timeoutId = setTimeout(() => {
        hideSplashScreen()
    }, 3000)
    const wrappedHide = () => {
        clearTimeout(timeoutId)
        hideSplashScreen()
    }
    window.hideSplashScreen = wrappedHide
    return wrappedHide
}

function showRuntimeErrorMessage(messageText) {
    const message = String(messageText || "")
    if (!message) return
    if (typeof UI !== "undefined" && typeof UI.showToast === "function") {
        UI.showToast(message)
        return
    }
    if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(message)
    }
}

const hideSplashScreen = initializeSplashScreen()

async function startCore() {
    const firebaseRuntimeReady = await ensureFirebaseRuntime()
    if (!firebaseRuntimeReady) {
        hideSplashScreen()
        showRuntimeErrorMessage("Не удалось загрузить Firebase")
        throw new Error("Firebase runtime unavailable")
    }

    if (!core.auth || !core.db) {
        const { auth, db } = initFirebase()
        core.auth = auth
        core.db = db
        window.auth = core.auth
        window.db = core.db
    }

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
    hideSplashScreen()
    console.error("[Core] Startup failed", error)
    showRuntimeErrorMessage("Не удалось запустить приложение. Перезагрузите страницу")
})
