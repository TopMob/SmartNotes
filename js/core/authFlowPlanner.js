import { detectBrowserProfile } from "./authBrowserProfiles.js"

export function planAuthMethods() {
    const browserProfile = detectBrowserProfile()
    return {
        profile: browserProfile,
        methods: ["popup"]
    }
}
