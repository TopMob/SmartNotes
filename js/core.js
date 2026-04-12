import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { bootstrapCore } from "./core/bootstrap.js"
import { APP_MESSAGES, getAppMessage } from "./core/messages.js"
import { validateFolderName, validateFolderDescription, canAddFolder, canAddCustomTheme, canAssignToFolder, FOLDER_DESCRIPTION_SOFT_LIMIT, FOLDER_DESCRIPTION_HARD_LIMIT } from "./core/validators.js"
import { normalizeDateValue, buildNotePayload, buildNoteUpdatePayload } from "./core/noteHelpers.js"
import { GoogleDriveMediaService } from "./core/googleDriveMedia.js"
import { initLocalBackend } from "./core/localBackend.js"
import { createOfflineAuthManager } from "./core/offlineAuth.js"
import "./core/backendConfig.js"

const core = window.__smartnotesCore || (() => {
    const context = { auth: null, db: null, Auth: null }
    window.__smartnotesCore = context
    return context
})()

window.Utils = Utils
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
window.GoogleDriveMediaService = GoogleDriveMediaService
window.ExternalMediaService = GoogleDriveMediaService

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
    window.hideSplashScreen = hideSplashScreen
    return hideSplashScreen
}

initializeSplashScreen()

async function startCore() {
    const { auth, db } = initLocalBackend()
    core.auth = auth
    core.db = db
    window.auth = auth
    window.db = db

    const authManager = createOfflineAuthManager({ auth })
    core.Auth = authManager
    window.Auth = authManager

    bootstrapCore({ ThemeManager, Auth: authManager })
    await authManager.init()
}

startCore().catch(error => {
    console.error("[Core] Startup failed", error)
    if (typeof window.hideSplashScreen === "function") window.hideSplashScreen()
    if (typeof window.alert === "function") window.alert("Не удалось запустить приложение")
})
