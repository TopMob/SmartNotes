let googleIdentityScriptPromise = null
let googleOneTapInitialized = false

const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client"
const GOOGLE_IDENTITY_SCRIPT_TIMEOUT_MS = 4500
const GOOGLE_IDENTITY_INTERACTIVE_TIMEOUT_MS = 6500
const GOOGLE_IDENTITY_PRELOAD_TIMEOUT_MS = 3500

function createError(code, message, details = {}) {
    const error = new Error(message)
    error.code = code
    error.details = details
    return error
}

function loadGoogleIdentityScript(timeoutMilliseconds = 9000) {
    if (googleIdentityScriptPromise) return googleIdentityScriptPromise

    googleIdentityScriptPromise = new Promise((resolve, reject) => {
        if (typeof window !== "undefined" && window.google?.accounts?.id) {
            resolve(true)
            return
        }

        const existingScriptElement = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`)
        if (existingScriptElement) {
            const waitStartedAt = Date.now()
            const poll = () => {
                if (typeof window !== "undefined" && window.google?.accounts?.id) {
                    resolve(true)
                    return
                }
                if (Date.now() - waitStartedAt >= timeoutMilliseconds) {
                    reject(createError("auth/google-identity-script-timeout", "Google identity script timeout"))
                    return
                }
                setTimeout(poll, 40)
            }
            poll()
            return
        }

        const scriptElement = document.createElement("script")
        scriptElement.src = GOOGLE_IDENTITY_SCRIPT_SRC
        scriptElement.async = true
        scriptElement.defer = true

        const timeoutId = setTimeout(() => {
            scriptElement.remove()
            reject(createError("auth/google-identity-script-timeout", "Google identity script timeout"))
        }, timeoutMilliseconds)

        scriptElement.addEventListener("load", () => {
            clearTimeout(timeoutId)
            if (typeof window !== "undefined" && window.google?.accounts?.id) {
                resolve(true)
                return
            }
            reject(createError("auth/google-identity-unavailable", "Google identity API unavailable"))
        }, { once: true })

        scriptElement.addEventListener("error", () => {
            clearTimeout(timeoutId)
            scriptElement.remove()
            googleIdentityScriptPromise = null
            reject(createError("auth/google-identity-script-failed", "Google identity script failed"))
        }, { once: true })

        document.head.appendChild(scriptElement)
    })

    return googleIdentityScriptPromise
}

function shouldUseFedCmPrompt() {
    const userAgent = String(navigator.userAgent || "").toLowerCase()
    const isFirefox = userAgent.includes("firefox")
    const isChromiumFamily = userAgent.includes("chrome") || userAgent.includes("chromium") || userAgent.includes("edg/") || userAgent.includes("opr/")
    if (isFirefox) return false
    return isChromiumFamily
}

function ensureGoogleIdentityAvailable() {
    if (typeof window === "undefined" || !window.google?.accounts?.id) {
        throw createError("auth/google-identity-unavailable", "Google identity API unavailable")
    }
}

function resolvePromptMoment(notification) {
    if (!notification) return null
    if (notification.isDisplayed?.()) return { status: "displayed" }
    if (notification.isSkippedMoment?.()) {
        return {
            status: "skipped",
            reason: String(notification.getSkippedReason?.() || "skipped")
        }
    }
    if (notification.isNotDisplayed?.()) {
        return {
            status: "not_displayed",
            reason: String(notification.getNotDisplayedReason?.() || "not_displayed")
        }
    }
    if (notification.isDismissedMoment?.()) {
        return {
            status: "dismissed",
            reason: String(notification.getDismissedReason?.() || "dismissed")
        }
    }
    return null
}

function initializeGoogleOneTap({ clientId, callback, context = "signin" }) {
    window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        context,
        itp_support: true,
        use_fedcm_for_prompt: shouldUseFedCmPrompt(),
        ux_mode: "popup",
        callback
    })
    googleOneTapInitialized = true

}

export async function requestGoogleIdentityToken({
    clientId,
    timeoutMilliseconds = GOOGLE_IDENTITY_INTERACTIVE_TIMEOUT_MS,
    interactive = true
}) {
    if (!clientId) {
        throw createError("auth/google-identity-client-id-missing", "Google client id is missing")
    }

    await loadGoogleIdentityScript(GOOGLE_IDENTITY_SCRIPT_TIMEOUT_MS)
    ensureGoogleIdentityAvailable()

    return new Promise((resolve, reject) => {
        let settled = false
        let promptDisplayed = false

        const timeoutId = setTimeout(() => {
            finishWithReject(createError("auth/google-identity-timeout", "Google identity timeout"))
        }, timeoutMilliseconds)

        const finishWithResolve = token => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            resolve(token)
        }

        const finishWithReject = error => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            reject(error)
        }

        initializeGoogleOneTap({
            clientId,
            callback: response => {
                const token = String(response?.credential || "")
                if (!token) {
                    finishWithReject(createError("auth/google-identity-empty-token", "Google identity token is empty"))
                    return
                }
                finishWithResolve(token)
            }
        })

        window.google.accounts.id.prompt(notification => {
            if (settled) return
            const moment = resolvePromptMoment(notification)
            if (!moment) return

            if (moment.status === "displayed") {
                promptDisplayed = true
                return
            }

            if (moment.status === "dismissed") {
                const code = interactive ? "auth/google-identity-dismissed" : "auth/google-identity-not-displayed"
                finishWithReject(createError(code, "Google sign-in dismissed", moment))
                return
            }

            if (moment.status === "not_displayed" || moment.status === "skipped") {
                const code = moment.status === "skipped"
                    ? "auth/google-identity-skipped"
                    : "auth/google-identity-not-displayed"
                finishWithReject(createError(code, "Google identity prompt not displayed", moment))
            }
        })
    })
}

export async function preloadGoogleIdentity({ clientId } = {}) {
    if (!clientId) return false
    try {
        await loadGoogleIdentityScript(GOOGLE_IDENTITY_PRELOAD_TIMEOUT_MS)
        ensureGoogleIdentityAvailable()
        if (!googleOneTapInitialized) {
            initializeGoogleOneTap({ clientId, callback() {} })
        }
        return true
    } catch {
        return false
    }
}
