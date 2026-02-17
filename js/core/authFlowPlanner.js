import { detectBrowserProfile } from "./authBrowserProfiles.js"

function buildPrimaryMethod(browserProfile) {
    if (browserProfile.isEdge) return "popup"
    if (browserProfile.isChromeFamily) return "popup"
    if (browserProfile.isMobile) return "popup"
    if (browserProfile.isSafari) return "popup"
    if (browserProfile.isBrave) return "popup"
    if (browserProfile.isOpera || browserProfile.isOperaGx) return "popup"
    if (browserProfile.isYandex || browserProfile.isSamsung || browserProfile.isDuckDuckGo || browserProfile.isSoul) return "popup"
    return "popup"
}

export function planAuthMethods() {
    const browserProfile = detectBrowserProfile()
    const primaryMethod = buildPrimaryMethod(browserProfile)

    return {
        profile: browserProfile,
        methods: [primaryMethod]
    }
}
