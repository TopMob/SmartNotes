import { detectBrowserProfile } from "./authBrowserProfiles.js"

function hasWorkingSessionStorage() {
    try {
        const storage = window.sessionStorage
        if (!storage) return false
        const key = "smartnotes_auth_storage_check"
        storage.setItem(key, "1")
        storage.removeItem(key)
        return true
    } catch {
        return false
    }
}

function buildPrimaryMethod(browserProfile) {
    if (browserProfile.isMobile) return "redirect"
    if (browserProfile.isSafari) return "redirect"
    if (browserProfile.isBrave) return "redirect"
    if (browserProfile.isEdge) return "popup"
    if (browserProfile.isChromeFamily) return "popup"
    if (browserProfile.isOpera || browserProfile.isOperaGx) return "redirect"
    if (browserProfile.isYandex || browserProfile.isSamsung || browserProfile.isDuckDuckGo || browserProfile.isSoul) return "redirect"
    return "popup"
}

function supportsRedirectFallback(browserProfile) {
    if (browserProfile.isEdge) return false
    if (browserProfile.isChromeFamily) return false
    if (browserProfile.isFirefox) return false
    return true
}

function buildMethodSequence(primaryMethod, browserProfile) {
    const methods = [primaryMethod]
    if (!supportsRedirectFallback(browserProfile)) return methods
    const secondaryMethod = primaryMethod === "popup" ? "redirect" : "popup"
    if (!methods.includes(secondaryMethod)) methods.push(secondaryMethod)
    return methods
}

export function planAuthMethods() {
    const browserProfile = detectBrowserProfile()
    const primaryMethod = buildPrimaryMethod(browserProfile)
    const methods = buildMethodSequence(primaryMethod, browserProfile)

    if (!hasWorkingSessionStorage() && supportsRedirectFallback(browserProfile) && !methods.includes("redirect")) {
        methods.unshift("redirect")
    }

    return {
        profile: browserProfile,
        methods
    }
}
