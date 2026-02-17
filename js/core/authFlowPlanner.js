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

function buildPrimaryMethod(profile) {
    if (profile.isMobile) return "redirect"
    if (profile.isSafari) return "redirect"
    if (profile.isBrave) return "redirect"
    if (profile.isOpera || profile.isOperaGx) return "redirect"
    if (profile.isYandex || profile.isSamsung || profile.isDuckDuckGo || profile.isSoul) return "redirect"
    return "popup"
}

export function planAuthMethods() {
    const profile = detectBrowserProfile()
    const methods = []
    const primaryMethod = buildPrimaryMethod(profile)
    methods.push(primaryMethod)
    methods.push(primaryMethod === "popup" ? "redirect" : "popup")

    if (!hasWorkingSessionStorage()) {
        if (!methods.includes("redirect")) methods.unshift("redirect")
    }

    return {
        profile,
        methods
    }
}
