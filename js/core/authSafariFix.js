export function isSafari() {
    if (typeof navigator === "undefined") return false
    const userAgent = typeof navigator === "undefined" ? "" : String(navigator.userAgent || "").toLowerCase()
    return /safari/.test(userAgent) && !/chrome|chromium|crios|fxios|edg|edgios|opr\//.test(userAgent)
}

export async function setupAuthPersistence(auth) {
    if (!auth || typeof firebase === "undefined") return
    if (setupAuthPersistence._promise) return setupAuthPersistence._promise
    setupAuthPersistence._promise = (async () => {
        const userAgent = typeof navigator === "undefined" ? "" : String(navigator.userAgent || "").toLowerCase()
        const isIos = /iphone|ipad|ipod/.test(userAgent)
        try {
            if (isIos) {
                await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
                return
            }
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        } catch {
            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
            } catch {}
        }
    })()
    return setupAuthPersistence._promise
}
