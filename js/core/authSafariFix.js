export function isSafari() {
    if (typeof navigator === "undefined") return false
    const userAgent = String(navigator.userAgent || "").toLowerCase()
    return /safari/.test(userAgent) && !/chrome|chromium|crios|fxios|edg|edgios|opr\//.test(userAgent)
}

function isIosDevice() {
    if (typeof navigator === "undefined") return false
    const userAgent = String(navigator.userAgent || "").toLowerCase()
    return /iphone|ipad|ipod/.test(userAgent)
}

function hasBraveApi() {
    if (typeof navigator === "undefined") return false
    const braveApi = navigator.brave
    return !!braveApi && typeof braveApi.isBrave === "function"
}

export async function isBraveBrowser() {
    if (!hasBraveApi()) return false
    try {
        return !!(await navigator.brave.isBrave())
    } catch {
        return true
    }
}

async function setNonePersistence(auth) {
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
    } catch {}
}

export async function setupAuthPersistence(auth) {
    if (!auth || typeof firebase === "undefined") return

    const iOSDevice = isIosDevice()
    const braveBrowser = hasBraveApi()

    try {
        if (iOSDevice) {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
            return
        }

        if (braveBrowser) {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
            return
        }

        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    } catch {
        await setNonePersistence(auth)
    }
}
