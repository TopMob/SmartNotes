export function isSafari() {
    if (typeof navigator === "undefined") return false
    const ua = (navigator.userAgent || "").toLowerCase()
    return /safari/.test(ua) && !/chrome|chromium|crios|fxios|edg\//.test(ua)
}

export async function setupAuthPersistence(auth) {
    if (!auth || typeof firebase === "undefined") return
    const persistence = isSafari()
        ? firebase.auth.Auth.Persistence.SESSION
        : firebase.auth.Auth.Persistence.LOCAL
    await auth.setPersistence(persistence).catch(() => null)
}
