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
    sharedAccess: false,
    workspaces: false,
    googleDrive: false,
    feedback: false,
    poll: false
}, window.AppFeatures || {})
window.GoogleDriveMediaService = window.AppFeatures.googleDrive ? GoogleDriveMediaService : null
window.ExternalMediaService = window.AppFeatures.googleDrive ? GoogleDriveMediaService : null
window.firebase = {
    firestore: {
        FieldValue: {
            serverTimestamp() {
                return new Date().toISOString()
            },
            delete() {
                return null
            }
        }
    }
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

async function loadSupabaseConfig() {
    const configResponse = await fetch("/api/supabase/config")
    if (!configResponse.ok) {
        throw new Error("Supabase config unavailable")
    }

    const configPayload = await configResponse.json()
    window.SmartNotesSupabaseConfig = {
        url: String(configPayload?.url || ""),
        publishableKey: String(configPayload?.publishableKey || "")
    }
}

async function initializeSupabaseDeferred() {
    try {
        await loadSupabaseConfig()
        await initSupabase()
    } catch (error) {
        console.error("[Core] Supabase startup failed", error)
        showRuntimeErrorMessage("Некоторые облачные функции временно недоступны")
    }
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
const startupSplash = createStartupSplashController(hideSplashScreen)

async function startCore() {
    const supabaseStartup = initializeSupabaseDeferred()

    if (!core.auth || !core.db) {
        const infraState = await InfraEngine.init()
        core.auth = infraState.auth
        core.db = infraState.db
        window.auth = core.auth
        window.db = core.db
    }

    await startupSplash.finish()

    const authManager = await InfraEngine.createAuth()
    core.Auth = authManager
    window.Auth = core.Auth
    resolveAuthReady(authManager)
    authManager.init().catch(error => {
        console.error("[Core] Auth manager init failed", error)
        showRuntimeErrorMessage("Некоторые функции входа временно недоступны")
    })

    await supabaseStartup
}

bootstrapCore({ ThemeManager, Auth: core.Auth })
startCore().catch(error => {
    startupSplash.fail()
    console.error("[Core] Startup failed", error)
    showRuntimeErrorMessage("Не удалось запустить приложение. Перезагрузите страницу")
})

