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
    const isMobileUserAgent = /android|iphone|ipad|ipod|mobile/.test(userAgent)
    return !isMobileUserAgent
}

function withTimeout(promise, timeoutMilliseconds, fallbackValue) {
    return new Promise((resolve) => {
        let settled = false
        const timeoutId = setTimeout(() => {
            if (settled) return
            settled = true
            resolve(fallbackValue)
        }, timeoutMilliseconds)

        Promise.resolve(promise)
            .then((value) => {
                if (settled) return
                settled = true
                clearTimeout(timeoutId)
                resolve(value)
            })
            .catch(() => {
                if (settled) return
                settled = true
                clearTimeout(timeoutId)
                resolve(fallbackValue)
            })
    })
}

let braveDetectionPromise = null

export async function isBraveBrowser() {
    if (braveDetectionPromise) return braveDetectionPromise

    braveDetectionPromise = (async () => {
        if (typeof navigator === "undefined") return false
        const braveApi = navigator.brave
        if (!braveApi) return false
        if (typeof braveApi.isBrave === "function") {
            const detectionResult = await withTimeout(braveApi.isBrave(), 700, false)
            return !!detectionResult
        }
        return true
    })()

    return braveDetectionPromise
}

async function setNonePersistence(auth) {
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
    } catch {}
}

export async function setupAuthPersistence(auth) {
    if (!auth || typeof firebase === "undefined") return

    try {
        const useNoneForIosSafari = isSafari() && isIosDevice()
        const useNoneForBrave = await isBraveBrowser()
        const useLocalForDesktop = !useNoneForIosSafari && !useNoneForBrave && isDesktopDevice()
        const targetPersistence = useLocalForDesktop
            ? firebase.auth.Auth.Persistence.LOCAL
            : firebase.auth.Auth.Persistence.NONE

        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        } catch {
            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
            } catch {}
        }
    })()
    return setupAuthPersistence._promise
}
