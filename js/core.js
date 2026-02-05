import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { initFirebase, setupAuthPersistence } from "./core/firebase.js"
import { createAuthManager } from "./core/auth.js"
import { bootstrapCore } from "./core/bootstrap.js"

const core = window.__smartnotesCore || (() => {
    const { auth, db } = initFirebase()
    const Auth = createAuthManager({ auth })
    const ctx = { auth, db, Auth }
    window.__smartnotesCore = ctx
    return ctx
})()

window.Utils = Utils
window.auth = core.auth
window.db = core.db
window.Auth = core.Auth
window.LANG = LANG

;(async () => {
    await setupAuthPersistence(core.auth)
    await core.Auth.init().catch(() => null)
})()

bootstrapCore({ ThemeManager, Auth: core.Auth })
