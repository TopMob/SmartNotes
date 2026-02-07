export function isSafari() {
    if (typeof navigator === "undefined") return false
    const ua = (navigator.userAgent || "").toLowerCase()
    return /safari/.test(ua) && !/chrome|chromium|crios|fxios|edg|edgios|opr\//.test(ua)
}

export async function setupAuthPersistence(auth) {
    if (!auth || typeof firebase === "undefined") return
    if (setupAuthPersistence._promise) return setupAuthPersistence._promise
    setupAuthPersistence._promise = (async () => {
        if (isSafari()) {
            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
                return
            } catch {
                try {
                    await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
                } catch {}
                return
            }
        }
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        } catch {}
    })()
    return setupAuthPersistence._promise
}
