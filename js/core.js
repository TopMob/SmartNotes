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

let resolveAuthReady = null
const authReady = new Promise(resolve => {
    resolveAuthReady = resolve
})

const AuthProxy = {
    login: () => authReady.then(auth => auth.login()),
    loginGuest: () => authReady.then(auth => auth.loginGuest()),
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

async function startCore() {
    await new Promise(resolve => {
        if (typeof firebase !== "undefined") return resolve()
        const tick = () => {
            if (typeof firebase !== "undefined") return resolve()
            setTimeout(tick, 50)
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
    const authManager = createAuthManager({ auth: core.auth })
    core.Auth = authManager
    window.Auth = core.Auth
    resolveAuthReady(authManager)
    authManager.init().catch(() => null)
}

bootstrapCore({ ThemeManager, Auth: core.Auth })
startCore().catch(() => null)
