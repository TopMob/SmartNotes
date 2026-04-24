import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { InfraEngine } from "./core/infra-engine.js"
import { bootstrapCore } from "./core/bootstrap.js"
import { APP_MESSAGES, getAppMessage } from "./core/messages.js"
import { validateFolderName, validateFolderDescription, canAddFolder, canAddCustomTheme, canAssignToFolder, FOLDER_DESCRIPTION_SOFT_LIMIT, FOLDER_DESCRIPTION_HARD_LIMIT } from "./core/validators.js"
import { normalizeDateValue, buildNotePayload, buildNoteUpdatePayload } from "./core/noteHelpers.js"
import { GoogleDriveMediaService } from "./core/googleDriveMedia.js"
import { initSupabase } from "./core/supabase.js"

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
window.AppFeatures = Object.assign({
    workspaces: false,
    googleDrive: false,
    feedback: false,
    poll: false
}, window.AppFeatures || {})
window.GoogleDriveMediaService = window.AppFeatures.googleDrive ? GoogleDriveMediaService : null
window.ExternalMediaService = window.AppFeatures.googleDrive ? GoogleDriveMediaService : null


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
    const wrappedHide = () => {
        hideSplashScreen()
    }
    window.hideSplashScreen = wrappedHide
    return wrappedHide
}

function nextPaint() {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve)
        })
    })
}

function yieldToMainThread() {
    if (typeof scheduler !== "undefined" && typeof scheduler.yield === "function") {
        return scheduler.yield()
    }

    return new Promise(resolve => {
        setTimeout(resolve, 0)
    })
}

function createStartupSplashController(hideSplash) {
    let finished = false
    const watchdogId = setTimeout(() => {
        if (finished) return
        finished = true
        hideSplash()
    }, 8000)

    return {
        async finish() {
            if (finished) return
            finished = true
            clearTimeout(watchdogId)
            await nextPaint()
            hideSplash()
        },
        fail() {
            if (finished) return
            finished = true
            clearTimeout(watchdogId)
            hideSplash()
        }
    }
}

function validateSupabaseConfig() {
    const config = window.SmartNotesSupabaseConfig || null
    const url = String(config?.url || "").trim()
    const publishableKey = String(config?.publishableKey || "").trim()
    const googleClientId = String(config?.googleClientId || "").trim()

    if (!url || !publishableKey) {
        throw new Error("Supabase config unavailable at runtime bootstrap")
    }

    window.SmartNotesSupabaseConfig = { url, publishableKey, googleClientId }
}

let supabaseStartupPromise = null

async function hydrateSupabaseRuntimeConfig() {
    const runtimeConfigPromise = window.__smartnotesSupabaseConfigPromise
    if (!runtimeConfigPromise || typeof runtimeConfigPromise.then !== "function") {
        return window.SmartNotesSupabaseConfig || null
    }

    try {
        return await runtimeConfigPromise
    } catch {
        return window.SmartNotesSupabaseConfig || null
    }
}

function ensureSupabaseReady() {
    if (!supabaseStartupPromise) {
        supabaseStartupPromise = (async () => {
            await hydrateSupabaseRuntimeConfig()
            validateSupabaseConfig()
            await initSupabase()
            return true
        })()
    }

    return supabaseStartupPromise
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

function showAuthStartupFailure(messageText) {
    const feedbackElement = document.getElementById("email-auth-feedback")
    if (feedbackElement) {
        feedbackElement.textContent = String(messageText || "")
        feedbackElement.classList.remove("is-success", "is-info")
        feedbackElement.classList.add("is-error")
    }

    const loginScreen = document.getElementById("login-screen")
    if (loginScreen) {
        loginScreen.style.display = "flex"
        loginScreen.classList.add("active")
        loginScreen.style.opacity = "1"
    }

    const appScreen = document.getElementById("app")
    if (appScreen) {
        appScreen.style.display = "none"
        appScreen.classList.remove("active")
        appScreen.style.opacity = "0"
    }

    const selectors = [
        "#email-signin-form button[type='submit']",
        "#email-signup-form button[type='submit']",
        "[data-auth-action='forgot-password']",
        ".btn-auth-tab",
        ".btn-auth-toggle-password",
        "#email-signin-form input",
        "#email-signup-form input"
    ]

    document.querySelectorAll(selectors.join(",")).forEach((element) => {
        if (!(element instanceof HTMLElement)) return
        if ("disabled" in element) {
            element.disabled = true
        }
        element.setAttribute("aria-disabled", "true")
    })
}

const hideSplashScreen = initializeSplashScreen()
const startupSplash = createStartupSplashController(hideSplashScreen)

async function startCore() {
    try {
        await ensureSupabaseReady()
    } catch (error) {
        startupSplash.fail()
        console.error("[Core] Supabase startup failed", error)
        showAuthStartupFailure("Вход временно недоступен. Проверьте подключение и попробуйте снова.")
        showRuntimeErrorMessage("Облачные функции временно недоступны")
        return
    }

    if (!core.auth || !core.db) {
        const infraState = await InfraEngine.init()
        core.auth = infraState.auth
        core.db = infraState.db
        window.auth = core.auth
        window.db = core.db
    }

    await startupSplash.finish()
    await yieldToMainThread()

    const authManager = await InfraEngine.createAuth()
    core.Auth = authManager
    window.Auth = core.Auth
    resolveAuthReady(authManager)
    authManager.init().catch(error => {
        console.error("[Core] Auth manager init failed", error)
        if (typeof authManager.setDegradedState === "function") {
            authManager.setDegradedState("Некоторые функции входа временно недоступны")
        }
        showRuntimeErrorMessage("Некоторые функции входа временно недоступны")
    })
}

bootstrapCore({ ThemeManager, Auth: core.Auth })
startCore().catch(error => {
    startupSplash.fail()
    console.error("[Core] Startup failed", error)
    showRuntimeErrorMessage("Не удалось запустить приложение. Перезагрузите страницу")
})

