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
    if (browserProfile.isEdge) return "popup"
    if (browserProfile.isChromeFamily) return "popup"
    if (browserProfile.isBrave) return "redirect"
    if (browserProfile.isOpera || browserProfile.isOperaGx) return "redirect"
    if (browserProfile.isYandex || browserProfile.isSamsung || browserProfile.isDuckDuckGo || browserProfile.isSoul) return "redirect"
    return "popup"
}

function buildMethodSequence(primaryMethod) {
    const methods = [primaryMethod]
    const secondaryMethod = primaryMethod === "popup" ? "redirect" : "popup"
    if (!methods.includes(secondaryMethod)) methods.push(secondaryMethod)
    return methods
}

export function planAuthMethods() {
    const browserProfile = detectBrowserProfile()
    const primaryMethod = buildPrimaryMethod(browserProfile)
    const methods = buildMethodSequence(primaryMethod)

    if (!hasWorkingSessionStorage() && !methods.includes("redirect")) {
        methods.unshift("redirect")
    }

    return {
        profile: browserProfile,
        methods
    }
}
