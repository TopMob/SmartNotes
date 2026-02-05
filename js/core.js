import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { initFirebase, setupAuthPersistence, waitForFirebaseSDK } from "./core/firebase.js"
import { createAuthManager } from "./core/auth.js"
import { bootstrapCore } from "./core/bootstrap.js"

const core = window.__smartnotesCore || (() => {
    const Auth = createAuthManager({ auth: null })
    const ctx = { app: null, auth: null, db: null, Auth, ready: Promise.resolve() }
    window.__smartnotesCore = ctx
    return ctx
})()

window.Utils = Utils
window.auth = core.auth
window.db = core.db
window.Auth = core.Auth
window.LANG = LANG

core.ready = (async () => {
    const sdkReady = await waitForFirebaseSDK()
    if (!sdkReady) {
        throw new Error("Firebase SDK is unavailable")
    }

    const { app, auth, db } = initFirebase()
    core.app = app
    core.auth = auth
    core.db = db
    core.Auth.setAuth(auth)

    window.auth = auth
    window.db = db

    await setupAuthPersistence(auth)
    await core.Auth.init()
})().catch(err => {
    console.error("[Core] Firebase bootstrap failed", err)
    return null
})

bootstrapCore({ ThemeManager, Auth: core.Auth })
