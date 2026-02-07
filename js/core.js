import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { initFirebase } from "./core/firebase.js"
import { setupAuthPersistence } from "./core/authSafariFix.js"
import { createAuthManager } from "./core/auth.js"
import { bootstrapCore } from "./core/bootstrap.js"

const core = window.__smartnotesCore || (() => {
    const { auth, db } = initFirebase()
    const ctx = { auth, db, Auth: null }
    window.__smartnotesCore = ctx
    return ctx
})()

window.Utils = Utils
window.auth = core.auth
window.db = core.db
window.Auth = core.Auth
window.LANG = LANG

async function startCore() {
    await setupAuthPersistence(core.auth)
    if (!core.Auth) {
        core.Auth = createAuthManager({ auth: core.auth })
        window.Auth = core.Auth
    }
    core.Auth.init().catch(() => null)
    bootstrapCore({ ThemeManager, Auth: core.Auth })
}

startCore().catch(() => null)
