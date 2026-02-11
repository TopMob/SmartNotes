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

function isDesktopDevice() {
    if (typeof navigator === "undefined") return false
    const userAgent = String(navigator.userAgent || "").toLowerCase()
    const isMobileUa = /android|iphone|ipad|ipod|mobile/.test(userAgent)
    return !isMobileUa
}

async function isBraveBrowser() {
    if (typeof navigator === "undefined") return false
    const braveApi = navigator.brave
    if (!braveApi) return false
    if (typeof braveApi.isBrave === "function") {
        try {
            return !!(await braveApi.isBrave())
        } catch {
            return true
        }
    }
    return true
}

async function setNonePersistence(auth) {
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
    } catch {}
}

export async function setupAuthPersistence(auth) {
    if (!auth || typeof firebase === "undefined") return

    try {
        const shouldUseNoneForSafariIos = isSafari() && isIosDevice()
        const shouldUseNoneForBrave = await isBraveBrowser()
        const shouldUseLocalDesktop = !shouldUseNoneForSafariIos && !shouldUseNoneForBrave && isDesktopDevice()
        const targetPersistence = shouldUseLocalDesktop
            ? firebase.auth.Auth.Persistence.LOCAL
            : firebase.auth.Auth.Persistence.NONE

        try {
            await auth.setPersistence(targetPersistence)
        } catch {
            await setNonePersistence(auth)
        }
    } catch {
        await setNonePersistence(auth)
    }
}
