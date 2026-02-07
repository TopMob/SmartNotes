import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { initFirebase } from "./core/firebase.js"
import { setupAuthPersistence } from "./core/authSafariFix.js"
import { createAuthManager } from "./core/auth.js"
import { bootstrapCore } from "./core/bootstrap.js"

const core = window.__smartnotesCore || (() => {
    const ctx = { auth: null, db: null, Auth: null }
    window.__smartnotesCore = ctx
    return ctx
})()

window.Utils = Utils
window.auth = core.auth
window.db = core.db
window.Auth = core.Auth
window.LANG = LANG

async function startCore() {
    await new Promise(resolve => {
        if (typeof firebase !== "undefined") return resolve()
        let tries = 0
        const tick = () => {
            if (typeof firebase !== "undefined" || tries > 120) return resolve()
            tries += 1
            requestAnimationFrame(tick)
        }
        tick()
    })
    if (!core.auth || !core.db) {
        const { auth, db } = initFirebase()
        core.auth = auth
        core.db = db
        window.auth = core.auth
        window.db = core.db
    }
    await setupAuthPersistence(core.auth)
    if (!core.Auth) {
        core.Auth = createAuthManager({ auth: core.auth })
        window.Auth = core.Auth
    }
    core.Auth.init().catch(() => null)
    bootstrapCore({ ThemeManager, Auth: core.Auth })
}

startCore().catch(() => null)
