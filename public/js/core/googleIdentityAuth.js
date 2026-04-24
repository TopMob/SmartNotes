let googleIdentityScriptPromise = null
let googleTokenScriptPromise = null

function createError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
}

function loadGoogleIdentityScript(timeoutMilliseconds = 9000) {
    if (googleIdentityScriptPromise) return googleIdentityScriptPromise

    googleIdentityScriptPromise = new Promise((resolve, reject) => {
        if (typeof window !== "undefined" && window.google?.accounts?.id) {
            resolve(true)
            return
        }

        const scriptSource = "https://accounts.google.com/gsi/client"
        const existingScriptElement = document.querySelector(`script[src="${scriptSource}"]`)
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
        scriptElement.src = scriptSource
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
            reject(createError("auth/google-identity-script-failed", "Google identity script failed"))
        }, { once: true })

        document.head.appendChild(scriptElement)
    })

    return googleIdentityScriptPromise
}

function loadGoogleTokenScript(timeoutMilliseconds = 9000) {
    if (googleTokenScriptPromise) return googleTokenScriptPromise

    googleTokenScriptPromise = new Promise((resolve, reject) => {
        if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
            resolve(true)
            return
        }

        const scriptSource = "https://accounts.google.com/gsi/client"
        const existingScriptElement = document.querySelector(`script[src="${scriptSource}"]`)
        if (existingScriptElement) {
            const waitStartedAt = Date.now()
            const poll = () => {
                if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
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

        loadGoogleIdentityScript(timeoutMilliseconds).then(resolve).catch(reject)
    })

    return googleTokenScriptPromise
}

export async function requestGoogleIdentityToken({ clientId, timeoutMilliseconds = 12000 }) {
    if (!clientId) {
        throw createError("auth/google-identity-client-id-missing", "Google client id is missing")
    }

    await loadGoogleIdentityScript()

    if (typeof window === "undefined" || !window.google?.accounts?.id) {
        throw createError("auth/google-identity-unavailable", "Google identity API unavailable")
    }

    return new Promise((resolve, reject) => {
        let settled = false

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

        const timeoutId = setTimeout(() => {
            finishWithReject(createError("auth/google-identity-timeout", "Google identity timeout"))
        }, timeoutMilliseconds)

        window.google.accounts.id.initialize({
            client_id: clientId,
            auto_select: false,
            cancel_on_tap_outside: true,
            context: "signin",
            itp_support: true,
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
            if (notification?.isNotDisplayed?.()) {
                finishWithReject(createError("auth/google-identity-not-displayed", "Google identity prompt not displayed"))
                return
            }
            if (notification?.isSkippedMoment?.()) {
                finishWithReject(createError("auth/google-identity-skipped", "Google identity prompt skipped"))
            }
        })
    })
}

export async function requestGoogleAccessToken({ clientId, scope = "openid email profile", timeoutMilliseconds = 12000 }) {
    if (!clientId) {
        throw createError("auth/google-identity-client-id-missing", "Google client id is missing")
    }

    await loadGoogleTokenScript()

    if (typeof window === "undefined" || !window.google?.accounts?.oauth2) {
        throw createError("auth/google-identity-unavailable", "Google identity API unavailable")
    }

    return new Promise((resolve, reject) => {
        let settled = false
        const timeoutId = setTimeout(() => {
            if (settled) return
            settled = true
            reject(createError("auth/google-identity-timeout", "Google identity timeout"))
        }, timeoutMilliseconds)

        const finish = (error, token = "") => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            if (error) {
                reject(error)
                return
            }
            resolve(token)
        }

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope,
            prompt: "select_account consent",
            callback: response => {
                const accessToken = String(response?.access_token || "")
                if (!accessToken) {
                    finish(createError("auth/google-identity-empty-token", "Google access token is empty"))
                    return
                }
                finish(null, accessToken)
            },
            error_callback: error => {
                finish(createError("auth/google-identity-skipped", String(error?.message || error?.type || "Google sign-in canceled")))
            }
        })

        tokenClient.requestAccessToken({ prompt: "select_account consent" })
    })
}
