function readUserAgent() {
    if (typeof navigator === "undefined") return ""
    return String(navigator.userAgent || "")
}

export function isSafari() {
    const userAgent = readUserAgent()
    if (!userAgent) return false
    const hasSafari = /Safari/i.test(userAgent)
    const hasExcludedBrowser = /Chrome|Chromium|CriOS|FxiOS|Edg|EdgiOS|OPR|Opera|SamsungBrowser/i.test(userAgent)
    return hasSafari && !hasExcludedBrowser
}

function runWithTimeout(asyncAction, timeoutMilliseconds) {
    return new Promise((resolve) => {
        let completed = false
        const timerId = setTimeout(() => {
            if (completed) return
            completed = true
            resolve(false)
        }, timeoutMilliseconds)

        Promise.resolve(asyncAction)
            .then((result) => {
                if (completed) return
                completed = true
                clearTimeout(timerId)
                resolve(!!result)
            })
            .catch(() => {
                if (completed) return
                completed = true
                clearTimeout(timerId)
                resolve(false)
            })
    })
}

let braveBrowserPromise = null

export async function isBraveBrowser() {
    if (braveBrowserPromise) return braveBrowserPromise
    braveBrowserPromise = (async () => {
        if (typeof navigator === "undefined") return false
        const braveObject = navigator.brave
        if (!braveObject) return false
        if (typeof braveObject.isBrave === "function") {
            return runWithTimeout(braveObject.isBrave(), 800)
        }
        return true
    })()
    return braveBrowserPromise
}

export async function setupAuthPersistence(auth) {
    if (!auth || typeof firebase === "undefined" || !firebase.auth || !firebase.auth.Auth || !firebase.auth.Auth.Persistence) return
    const persistenceModes = [
        firebase.auth.Auth.Persistence.LOCAL,
        firebase.auth.Auth.Persistence.SESSION,
        firebase.auth.Auth.Persistence.NONE
    ]
    try {
        for (const persistenceMode of persistenceModes) {
            try {
                await auth.setPersistence(persistenceMode)
                return
            } catch {}
        }
    } catch {
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
        } catch {}
    }
}
