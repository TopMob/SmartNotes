let supabaseClientSingleton = null

const storageKey = "smartnotes.supabase.session"
const authStateSubscribers = new Set()
let authStateListenerBound = false
let currentSessionCache = null

const DEFAULT_AUTH_TIMEOUT_MS = 9000
const BACKGROUND_AUTH_TIMEOUT_MS = 14000
const AUTH_PROXY_ENDPOINT = "/api/supabase/auth"

function normalizeUser(user) {
    if (!user || !user.id) return null
    return {
        ...user,
        id: String(user.id || ""),
        email: String(user.email || ""),
        user_metadata: user.user_metadata && typeof user.user_metadata === "object"
            ? user.user_metadata
            : {}
    }
}

function getRuntimeConfig() {
    const url = String(window.SmartNotesSupabaseConfig?.url || "").trim().replace(/\/+$/g, "")
    const publishableKey = String(window.SmartNotesSupabaseConfig?.publishableKey || "").trim()
    const googleClientId = String(window.SmartNotesSupabaseConfig?.googleClientId || "").trim()

    if (!url || !publishableKey) {
        throw new Error("supabase-config-missing")
    }

    return { url, publishableKey, googleClientId }
}

function decodeBase64Url(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/")
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
    return atob(normalized + padding)
}

function decodeJwtPayload(token) {
    try {
        const [, payload] = String(token || "").split(".")
        if (!payload) return null
        return JSON.parse(decodeBase64Url(payload))
    } catch {
        return null
    }
}

function getSessionExpiryMs(session) {
    const expiresAt = Number(session?.expires_at || 0)
    if (expiresAt > 0) return expiresAt * 1000
    const payload = decodeJwtPayload(session?.access_token)
    const payloadExp = Number(payload?.exp || 0)
    return payloadExp > 0 ? payloadExp * 1000 : 0
}

function normalizeSession(session) {
    if (!session?.access_token || !session?.refresh_token || !session?.user?.id) {
        return null
    }

    const expiresAtMs = getSessionExpiryMs(session)
    return {
        access_token: String(session.access_token),
        refresh_token: String(session.refresh_token),
        token_type: String(session.token_type || "bearer"),
        expires_in: Number(session.expires_in || 0),
        expires_at: expiresAtMs > 0 ? Math.floor(expiresAtMs / 1000) : 0,
        user: normalizeUser(session.user)
    }
}

function readStoredSession() {
    try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) return null
        const session = normalizeSession(JSON.parse(raw))
        currentSessionCache = session
        if (!session) {
            window.localStorage.removeItem(storageKey)
        }
        return session
    } catch {
        currentSessionCache = null
        return null
    }
}

function writeStoredSession(session) {
    currentSessionCache = session || null
    try {
        if (!session) {
            window.localStorage.removeItem(storageKey)
        } else {
            window.localStorage.setItem(storageKey, JSON.stringify(session))
        }
    } catch {
        return
    }
}

function createAuthHeaders(publishableKey, accessToken = "") {
    return {
        apikey: publishableKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${publishableKey}`,
        "Content-Type": "application/json"
    }
}

async function authRequest(path, { method = "GET", body = null, accessToken = "" } = {}) {
    const { url, publishableKey } = getRuntimeConfig()
    const requestWithTimeout = async (input, init) => {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null
        const timeoutId = controller
            ? setTimeout(() => controller.abort(), DEFAULT_AUTH_TIMEOUT_MS)
            : null
        try {
            return await fetch(input, {
                ...init,
                ...(controller ? { signal: controller.signal } : {})
            })
        } finally {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }

    let response = null
    response = await requestWithTimeout(AUTH_PROXY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.replace(/^\/+/, ""), method, body, accessToken })
    })

    if (response.status === 404 || response.status === 405) {
        response = await requestWithTimeout(`${url}/auth/v1/${path.replace(/^\/+/, "")}`, {
            method,
            headers: createAuthHeaders(publishableKey, accessToken),
            body: body ? JSON.stringify(body) : undefined
        })
    }

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        const error = new Error(String(payload?.msg || payload?.error_description || payload?.error || `supabase-auth-http-${response.status}`))
        error.code = String(payload?.error_code || payload?.code || payload?.error || "auth/unknown")
        error.status = response.status
        throw error
    }

    return payload
}

function getHashParams() {
    const hash = String(window.location.hash || "")
    const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash
    return new URLSearchParams(normalizedHash)
}

function getSearchParams() {
    return new URLSearchParams(String(window.location.search || ""))
}

function clearAuthParamsFromUrl() {
    const url = new URL(window.location.href)
    url.hash = ""
    ;[
        "access_token",
        "refresh_token",
        "expires_at",
        "expires_in",
        "token_type",
        "token_hash",
        "type",
        "code",
        "next",
        "provider_token",
        "provider_refresh_token"
    ].forEach((key) => url.searchParams.delete(key))
    window.history.replaceState({}, document.title, url.toString())
}

function readSessionFromUrl() {
    return readSessionFromUrlValue(window.location.href)
}

function readSessionFromUrlValue(urlValue) {
    const url = new URL(String(urlValue || window.location.href), window.location.origin)
    const normalizedHash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
    const hashParams = new URLSearchParams(normalizedHash)
    const searchParams = url.searchParams
    const accessToken = String(hashParams.get("access_token") || "")
    const refreshToken = String(hashParams.get("refresh_token") || "")
    if (!accessToken || !refreshToken) return null

    const payload = decodeJwtPayload(accessToken)
    return normalizeSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: hashParams.get("token_type") || "bearer",
        expires_in: Number(hashParams.get("expires_in") || 0),
        expires_at: Number(hashParams.get("expires_at") || payload?.exp || 0),
        user: payload ? {
            id: String(payload.sub || ""),
            email: String(payload.email || ""),
            user_metadata: {
                ...(searchParams.get("type") ? { auth_flow_type: String(searchParams.get("type") || "") } : {})
            }
        } : null
    })
}

function readCodeFromUrl() {
    const searchParams = getSearchParams()
    const code = String(searchParams.get("code") || "").trim()
    if (!code) return ""
    return code
}

function clearCodeFromUrl() {
    const url = new URL(window.location.href)
    url.searchParams.delete("code")
    url.searchParams.delete("state")
    window.history.replaceState({}, document.title, url.toString())
}

async function fetchCurrentUser(accessToken) {
    const payload = await authRequest("user", { method: "GET", accessToken })
    return payload?.user || null
}

function isSessionExpired(session) {
    const expiresAtMs = getSessionExpiryMs(session)
    if (!expiresAtMs) return false
    return expiresAtMs <= Date.now()
}

function shouldRefreshSoon(session) {
    const expiresAtMs = getSessionExpiryMs(session)
    if (!expiresAtMs) return false
    return expiresAtMs - Date.now() <= 5 * 60 * 1000
}

async function refreshSessionIfNeeded() {
    const currentSession = readStoredSession()
    if (!currentSession?.refresh_token) return null
    const expiresAtMs = getSessionExpiryMs(currentSession)
    if (expiresAtMs && expiresAtMs - Date.now() > 30000) {
        return currentSession
    }

    const payload = await authRequest("token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: currentSession.refresh_token }
    })
    const refreshedSession = normalizeSession(payload)
    if (!refreshedSession) {
        writeStoredSession(null)
        return null
    }
    writeStoredSession(refreshedSession)
    return refreshedSession
}

async function validateSession(session, { allowRefresh = true } = {}) {
    if (!session?.access_token) return null

    if (isSessionExpired(session) && allowRefresh) {
        const refreshedSession = await refreshSessionIfNeeded().catch(() => null)
        if (!refreshedSession) {
            writeStoredSession(null)
        }
        return refreshedSession
    }

    const user = await fetchCurrentUser(session.access_token).catch(async () => {
        if (!allowRefresh) return null
        const refreshedSession = await refreshSessionIfNeeded().catch(() => null)
        if (!refreshedSession?.access_token) return null
        const refreshedUser = await fetchCurrentUser(refreshedSession.access_token).catch(() => null)
        if (!refreshedUser) return null
        const nextSession = normalizeSession({ ...refreshedSession, user: refreshedUser })
        writeStoredSession(nextSession)
        return nextSession?.user || null
    })

    if (!user) {
        writeStoredSession(null)
        return null
    }

    const nextSession = normalizeSession({ ...session, user })
    writeStoredSession(nextSession)
    return nextSession
}

async function resolveCurrentSession() {
    const urlSession = readSessionFromUrl()
    if (urlSession) {
        const validatedUrlSession = await validateSession(urlSession, { allowRefresh: false }).catch(() => null)
        clearAuthParamsFromUrl()
        return validatedUrlSession
    }

    const authCode = readCodeFromUrl()
    if (authCode) {
        try {
            const payload = await authRequest("token?grant_type=authorization_code", {
                method: "POST",
                body: {
                    auth_code: authCode,
                    code: authCode,
                    redirect_to: resolveRedirectTo()
                }
            })
            const session = normalizeSession(payload)
            writeStoredSession(session)
            clearCodeFromUrl()
            return session
        } catch (error) {
            clearCodeFromUrl()
            console.warn("[SupabaseClient] auth code exchange failed", error)
        }
    }

    const storedSession = currentSessionCache || readStoredSession()
    if (!storedSession) return null
    if (!isSessionExpired(storedSession)) {
        if (shouldRefreshSoon(storedSession)) {
            refreshSessionIfNeeded().then((refreshedSession) => {
                if (refreshedSession) emitAuthState("TOKEN_REFRESHED", refreshedSession)
            }).catch((error) => {
                console.warn("[SupabaseClient] background session refresh failed", error)
            })
        }
        return storedSession
    }
    return validateSession(storedSession).catch(() => {
        writeStoredSession(null)
        return null
    })
}

function verifyCurrentSessionInBackground(session) {
    if (!session?.access_token || isSessionExpired(session)) return
    let timeoutId = null
    const timeoutPromise = new Promise(resolve => {
        timeoutId = setTimeout(() => resolve(null), BACKGROUND_AUTH_TIMEOUT_MS)
    })
    Promise.race([
        validateSession(session).catch(() => null),
        timeoutPromise
    ]).then((validatedSession) => {
        if (timeoutId) clearTimeout(timeoutId)
        if (!validatedSession) return
        emitAuthState("USER_VERIFIED", validatedSession)
    }).catch((error) => {
        if (timeoutId) clearTimeout(timeoutId)
        console.warn("[SupabaseClient] background session verify failed", error)
    })
}

function emitAuthState(eventName, session) {
    currentSessionCache = session || null
    authStateSubscribers.forEach((callback) => {
        Promise.resolve(callback(eventName, session)).catch((error) => {
            console.error("[SupabaseClient] auth subscriber failed", error)
        })
    })
}

function bindStorageListener() {
    if (authStateListenerBound) return
    authStateListenerBound = true
    window.addEventListener("storage", (event) => {
        if (event.key !== storageKey) return
        let nextSession = null
        try {
            nextSession = event.newValue ? normalizeSession(JSON.parse(event.newValue)) : null
        } catch {
            nextSession = null
        }
        emitAuthState(nextSession ? "SIGNED_IN" : "SIGNED_OUT", nextSession)
    })
}

function resolveRedirectTo(options = {}) {
    const candidate = String(options?.redirectTo || options?.emailRedirectTo || "").trim()
    if (candidate) return candidate
    return window.location.origin + window.location.pathname
}

function buildOAuthUrl({ provider, options = {} } = {}) {
    const { url, publishableKey } = getRuntimeConfig()
    const normalizedProvider = String(provider || "").trim()
    if (!normalizedProvider) throw new Error("supabase-provider-missing")

    const query = new URLSearchParams()
    query.set("provider", normalizedProvider)
    query.set("redirect_to", resolveRedirectTo(options))
    query.set("skip_http_redirect", "false")
    query.set("flow_type", "implicit")

    const scopes = String(options?.scopes || "").trim()
    if (scopes) query.set("scopes", scopes)

    return `${url}/auth/v1/authorize?${query.toString()}&apikey=${encodeURIComponent(publishableKey)}`
}

function openCenteredPopup(url, name = "smartnotes-google-auth") {
    const width = Math.min(520, Math.max(420, Math.floor(window.screen?.availWidth || 520)))
    const height = Math.min(720, Math.max(560, Math.floor(window.screen?.availHeight || 720)))
    const left = Math.max(0, Math.floor(((window.screen?.availWidth || width) - width) / 2 + (window.screen?.availLeft || 0)))
    const top = Math.max(0, Math.floor(((window.screen?.availHeight || height) - height) / 2 + (window.screen?.availTop || 0)))
    return window.open(
        url,
        name,
        `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=yes`
    )
}

function waitForOAuthPopupSession(popupWindow, { timeoutMilliseconds = 120000 } = {}) {
    return new Promise((resolve, reject) => {
        if (!popupWindow) {
            const error = new Error("Google sign-in popup was blocked")
            error.code = "auth/oauth-popup-blocked"
            reject(error)
            return
        }

        const startedAt = Date.now()
        const intervalId = setInterval(() => {
            if (popupWindow.closed) {
                clearInterval(intervalId)
                const error = new Error("Google sign-in popup was closed")
                error.code = "auth/oauth-popup-closed"
                reject(error)
                return
            }

            if (Date.now() - startedAt > timeoutMilliseconds) {
                clearInterval(intervalId)
                popupWindow.close()
                const error = new Error("Google sign-in popup timeout")
                error.code = "auth/oauth-popup-timeout"
                reject(error)
                return
            }

            try {
                const popupUrl = popupWindow.location.href
                if (!popupUrl || new URL(popupUrl).origin !== window.location.origin) return
                const session = readSessionFromUrlValue(popupUrl)
                if (!session) return
                clearInterval(intervalId)
                popupWindow.close()
                resolve(session)
            } catch {
                return
            }
        }, 250)
    })
}

function createClient() {
    bindStorageListener()

    return {
        auth: {
            async signInWithPassword({ email, password }) {
                const payload = await authRequest("token?grant_type=password", {
                    method: "POST",
                    body: { email, password }
                })
                const session = normalizeSession(payload)
                if (!session) {
                    throw new Error("supabase-session-missing")
                }
                writeStoredSession(session)
                emitAuthState("SIGNED_IN", session)
                return { data: { session, user: session?.user || null }, error: null }
            },
            async signUp({ email, password, options = {} }) {
                const payload = await authRequest("signup", {
                    method: "POST",
                    body: {
                        email,
                        password,
                        options: {
                            ...(options && typeof options === "object" ? options : {}),
                            emailRedirectTo: resolveRedirectTo(options)
                        }
                    }
                })
                const session = normalizeSession(payload)
                writeStoredSession(session)
                if (session) emitAuthState("SIGNED_IN", session)
                return { data: { session, user: payload?.user || session?.user || null }, error: null }
            },
            async resetPasswordForEmail(email, options = {}) {
                await authRequest("recover", {
                    method: "POST",
                    body: {
                        email,
                        code_challenge: null,
                        code_challenge_method: null,
                        gotrue_meta_security: {},
                        redirect_to: resolveRedirectTo(options)
                    }
                })
                return { data: {}, error: null }
            },
            async signInWithIdToken({ provider, token }) {
                const normalizedProvider = String(provider || "").trim()
                const idToken = String(token || "").trim()
                if (!normalizedProvider || !idToken) {
                    return { data: { session: null, user: null }, error: new Error("supabase-id-token-missing") }
                }

                try {
                    const payload = await authRequest(`token?grant_type=id_token&provider=${encodeURIComponent(normalizedProvider)}`, {
                        method: "POST",
                        body: { id_token: idToken }
                    })
                    const session = normalizeSession(payload)
                    if (!session) {
                        throw new Error("supabase-session-missing")
                    }
                    writeStoredSession(session)
                    emitAuthState("SIGNED_IN", session)
                    return { data: { session, user: session?.user || null }, error: null }
                } catch (error) {
                    return { data: { session: null, user: null }, error }
                }
            },
            async signInWithOAuth({ provider, options = {} }) {
                try {
                    const url = buildOAuthUrl({ provider, options })
                    if (options?.skipBrowserRedirect) {
                        return { data: { url }, error: null }
                    }
                    window.location.assign(url)
                    return { data: { url }, error: null }
                } catch (error) {
                    return { data: { url: null }, error }
                }
            },
            async signInWithOAuthPopup({ provider, options = {} }) {
                try {
                    const url = buildOAuthUrl({ provider, options })
                    const popupWindow = openCenteredPopup(url)
                    const session = await waitForOAuthPopupSession(popupWindow, options)
                    writeStoredSession(session)
                    emitAuthState("SIGNED_IN", session)
                    return { data: { session, user: session?.user || null }, error: null }
                } catch (error) {
                    return { data: { session: null, user: null }, error }
                }
            },
            async updateUser({ data = {} } = {}) {
                const session = await resolveCurrentSession()
                if (!session?.access_token) {
                    return { data: { user: null }, error: new Error("supabase-session-missing") }
                }
                const payload = await authRequest("user", {
                    method: "PUT",
                    accessToken: session.access_token,
                    body: { data }
                })
                const nextSession = normalizeSession({ ...session, user: payload?.user || session.user })
                writeStoredSession(nextSession)
                emitAuthState("USER_UPDATED", nextSession)
                return { data: { user: nextSession?.user || null }, error: null }
            },
            async signOut() {
                const session = readStoredSession()
                if (session?.access_token) {
                    await authRequest("logout", {
                        method: "POST",
                        accessToken: session.access_token,
                        body: {}
                    }).catch(() => {})
                }
                writeStoredSession(null)
                emitAuthState("SIGNED_OUT", null)
                return { error: null }
            },
            async getSession() {
                const session = await resolveCurrentSession()
                return { data: { session }, error: null }
            },
            onAuthStateChange(callback) {
                const subscriber = typeof callback === "function" ? callback : () => {}
                authStateSubscribers.add(subscriber)
                Promise.resolve(this.getSession()).then((result) => {
                    const session = result?.data?.session || null
                    subscriber(session ? "INITIAL_SESSION" : "SIGNED_OUT", session)
                    verifyCurrentSessionInBackground(session)
                }).catch((error) => {
                    console.error("[SupabaseClient] initial session failed", error)
                })
                return {
                    data: {
                        subscription: {
                            unsubscribe() {
                                authStateSubscribers.delete(subscriber)
                            }
                        }
                    }
                }
            }
        }
    }
}

export function initSupabase() {
    if (supabaseClientSingleton) return supabaseClientSingleton
    getRuntimeConfig()
    supabaseClientSingleton = createClient()
    return supabaseClientSingleton
}
