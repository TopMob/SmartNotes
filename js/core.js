import { ThemeManager } from "./theme.js"
import { LANG } from "./lang.js"
import { Utils } from "./core/utils.js"
import { initFirebase } from "./core/firebase.js"
import { createAuthManager } from "./core/auth.js"
import { bootstrapCore } from "./core/bootstrap.js"

const { auth, db } = initFirebase()
const Auth = createAuthManager({ auth })

window.Utils = Utils
window.auth = auth
window.db = db
window.Auth = Auth
window.LANG = LANG

bootstrapCore({ ThemeManager, Auth })
