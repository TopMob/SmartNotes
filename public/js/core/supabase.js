let supabaseClientSingleton = null
let officialClientLoadPromise = null
let officialClientSingletonPromise = null
let sessionRefreshPromise = null
const authStateSubscribers = new Set()

const AUTH_CALLBACK_PATH = "/auth/callback"
const OFFICIAL_STORAGE_KEY = "sb-smartnotes-auth-token"
const SUPABASE_BROWSER_SCRIPT_SRC = "/vendor/supabase.js"
const SUPABASE_BROWSER_SCRIPT_TIMEOUT_MS = 12000

function getRuntimeConfig() {
    const url = String(window.SmartNotesSupabaseConfig?.url || "").trim().replace(/\/+$/g, "")
    const publishableKey = String(window.SmartNotesSupabaseConfig?.publishableKey || "").trim()
    const googleClientId = String(window.SmartNotesSupabaseConfig?.googleClientId || "").trim()

    if (!url || !publishableKey) {
        throw new Error("supabase-config-missing")
    }

    return { url, publishableKey, googleClientId }
}

function readLegacyStoredSession() {
    try {
        const raw = window.localStorage.getItem("smartnotes.supabase.session")
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== "object") return null
        if (!parsed.access_token || !parsed.refresh_token) return null
        return parsed
    } catch {
        return null
    }
}

function readStoredSession(storageKey) {
    try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== "object") return null
        if (!parsed.access_token || !parsed.refresh_token) return null
        return parsed
    } catch {
        return null
    }
}

function writeStoredSession(session) {
    try {
        if (session?.access_token && session?.refresh_token) {
            const serialized = JSON.stringify(session)
            window.localStorage.setItem("smartnotes.supabase.session", serialized)
            window.localStorage.setItem(OFFICIAL_STORAGE_KEY, serialized)
            return
        }
        window.localStorage.removeItem("smartnotes.supabase.session")
        window.localStorage.removeItem(OFFICIAL_STORAGE_KEY)
    } catch {
        return
    }
}

function migrateLegacySession() {
    const legacySession = readLegacyStoredSession()
    if (!legacySession) return
    try {
        if (!window.localStorage.getItem(OFFICIAL_STORAGE_KEY)) {
            window.localStorage.setItem(OFFICIAL_STORAGE_KEY, JSON.stringify(legacySession))
        }
    } catch {
        return
    }
}

function getCurrentSession() {
    return readStoredSession(OFFICIAL_STORAGE_KEY)
        || readLegacyStoredSession()
        || null
}

function setCurrentSession(session) {
    writeStoredSession(session)
    return session || null
}

function isSessionExpired(session) {
    const expiresAt = Number(session?.expires_at || 0)
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false
    return expiresAt <= Math.floor(Date.now() / 1000)
}

function notifyAuthStateChange(eventName, session) {
    authStateSubscribers.forEach((callback) => {
        try {
            callback(eventName, session || null)
        } catch (error) {
            console.error("[Supabase] auth state callback failed", error)
        }
    })
}

async function callAuthEndpoint(payload) {
    const response = await fetch("/api/supabase/auth", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload || {})
    })

    const result = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, data: result }
}

function shouldRefreshSession(status, payload) {
    if (status === 401) return true
    const message = String(payload?.error || payload?.message || payload?.code || "").toLowerCase()
    return message.includes("jwt") || message.includes("token")
}

async function refreshStoredSession() {
    const session = getCurrentSession()
    if (!session?.refresh_token) return session

    const refreshResult = await callAuthEndpoint({
        path: "token?grant_type=refresh_token",
        body: {
            refresh_token: session.refresh_token
        }
    })

    if (!refreshResult.ok) {
        if (refreshResult.status === 401) {
            setCurrentSession(null)
            notifyAuthStateChange("SIGNED_OUT", null)
            return null
        }
        return session
    }

    const nextSession = setCurrentSession(refreshResult.data)
    notifyAuthStateChange("TOKEN_REFRESHED", nextSession)
    return nextSession
}

async function verifyStoredSession() {
    const session = getCurrentSession()
    if (!session?.access_token) return null

    if (isSessionExpired(session)) {
        return refreshStoredSession()
    }

    const verifyResult = await callAuthEndpoint({
        path: "user",
        accessToken: session.access_token
    })

    if (verifyResult.ok) {
        const nextSession = setCurrentSession({
            ...session,
            user: verifyResult.data?.user || session.user || null
        })
        notifyAuthStateChange("USER_VERIFIED", nextSession)
        return nextSession
    }

    if (shouldRefreshSession(verifyResult.status, verifyResult.data)) {
        return refreshStoredSession()
    }

    return session
}

function ensureStoredSession() {
    if (sessionRefreshPromise) return sessionRefreshPromise
    sessionRefreshPromise = verifyStoredSession().finally(() => {
        sessionRefreshPromise = null
    })
    return sessionRefreshPromise
}

async function loadOfficialSupabaseCreateClient() {
    const existingFactory = window.supabase?.createClient
        || globalThis.supabase?.createClient
        || (typeof supabase !== "undefined" ? supabase?.createClient : null)
    if (typeof existingFactory === "function") {
        return existingFactory
    }

    const canLoadScript = typeof document !== "undefined"
        && typeof document.querySelector === "function"
        && typeof document.createElement === "function"
        && document.head
    if (!canLoadScript) {
        return null
    }

    if (!officialClientLoadPromise) {
        officialClientLoadPromise = new Promise((resolve, reject) => {
            let settled = false

            const readCreateClientFactory = () => {
                const globalFactory = window.supabase?.createClient
                    || globalThis.supabase?.createClient
                    || (typeof supabase !== "undefined" ? supabase?.createClient : null)
                return typeof globalFactory === "function" ? globalFactory : null
            }

            const finishResolve = (createClient) => {
                if (settled) return
                settled = true
                clearTimeout(timeoutId)
                resolve(createClient)
            }

            const finishReject = (error) => {
                if (settled) return
                settled = true
                clearTimeout(timeoutId)
                officialClientLoadPromise = null
                reject(error)
            }

            const resolveFactory = () => {
                const createClient = readCreateClientFactory()
                if (!createClient) return false
                finishResolve(createClient)
                return true
            }

            const onScriptLoaded = () => {
                if (!resolveFactory()) {
                    finishReject(new Error("supabase-create-client-missing"))
                }
            }

            const timeoutId = setTimeout(() => {
                finishReject(new Error("supabase-browser-script-timeout"))
            }, SUPABASE_BROWSER_SCRIPT_TIMEOUT_MS)

            if (resolveFactory()) return

            const existingScript = document.querySelector(`script[src="${SUPABASE_BROWSER_SCRIPT_SRC}"]`)
            if (existingScript) {
                existingScript.addEventListener("load", onScriptLoaded, { once: true })
                existingScript.addEventListener("error", () => {
                    finishReject(new Error("supabase-browser-script-failed"))
                }, { once: true })
                return
            }

            const scriptElement = document.createElement("script")
            scriptElement.src = SUPABASE_BROWSER_SCRIPT_SRC
            scriptElement.async = true
            scriptElement.addEventListener("load", onScriptLoaded, { once: true })
            scriptElement.addEventListener("error", () => {
                finishReject(new Error("supabase-browser-script-failed"))
            }, { once: true })
            document.head.appendChild(scriptElement)
        })
    }
    return officialClientLoadPromise
}

function normalizeUser(user, session, updateProfile) {
    if (!user) return null
    const metadata = user.user_metadata && typeof user.user_metadata === "object"
        ? user.user_metadata
        : {}
    return {
        uid: String(user.id || ""),
        id: String(user.id || ""),
        email: String(user.email || ""),
        displayName: String(metadata.display_name || metadata.displayName || metadata.full_name || ""),
        photoURL: String(metadata.avatar_url || metadata.photoURL || metadata.picture || ""),
        providerData: [],
        accessToken: String(session?.access_token || ""),
        updateProfile
    }
}

function resolveRedirectTo(options = {}) {
    const candidate = String(options?.redirectTo || options?.emailRedirectTo || "").trim()
    if (candidate) return candidate
    return window.location.origin + AUTH_CALLBACK_PATH
}

function createPersistenceEnum() {
    return {
        LOCAL: "local"
    }
}

function normalizeAuthError(error) {
    if (!error) return new Error("auth/unknown")
    if (error instanceof Error) return error
    const normalized = new Error(String(error?.message || "auth/unknown"))
    normalized.code = String(error?.code || "auth/unknown")
    normalized.status = Number(error?.status || 0)
    return normalized
}

async function getOfficialClient() {
    if (officialClientSingletonPromise) return officialClientSingletonPromise

    migrateLegacySession()

    officialClientSingletonPromise = (async () => {
        const createOfficialClient = await loadOfficialSupabaseCreateClient()
        if (typeof createOfficialClient !== "function") return null

        const { url, publishableKey } = getRuntimeConfig()
        const officialClient = createOfficialClient(url, publishableKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: "implicit",
                storageKey: OFFICIAL_STORAGE_KEY
            }
        })

        officialClient.auth.onAuthStateChange((eventName, session) => {
            setCurrentSession(session || null)
            notifyAuthStateChange(eventName, session || null)
        })

        return officialClient
    })()

    return officialClientSingletonPromise
}

function createDelegatedAuthMethod(methodName, mapResult = (result) => result) {
    return async (...args) => {
        const officialClient = await getOfficialClient()
        if (!officialClient?.auth?.[methodName]) {
            return {
                data: null,
                error: normalizeAuthError({ code: "auth/unavailable", message: "supabase-client-unavailable" })
            }
        }

        const result = await officialClient.auth[methodName](...args)
        const session = result?.data?.session || null
        if (session) setCurrentSession(session)
        return mapResult(result)
    }
}

function createClientFacade() {
    getRuntimeConfig()
    migrateLegacySession()

    return {
        auth: {
            signInWithPassword: createDelegatedAuthMethod("signInWithPassword", (result) => ({
                data: {
                    session: result.data?.session || null,
                    user: result.data?.user || null
                },
                error: result.error ? normalizeAuthError(result.error) : null
            })),
            signUp: async ({ email, password, options = {} }) => {
                const officialClient = await getOfficialClient()
                if (!officialClient?.auth?.signUp) {
                    return {
                        data: { session: null, user: null },
                        error: normalizeAuthError({ code: "auth/unavailable", message: "supabase-client-unavailable" })
                    }
                }

                const result = await officialClient.auth.signUp({
                    email,
                    password,
                    options: {
                        ...(options && typeof options === "object" ? options : {}),
                        emailRedirectTo: resolveRedirectTo(options)
                    }
                })
                if (result.data?.session) setCurrentSession(result.data.session)
                return {
                    data: {
                        session: result.data?.session || null,
                        user: result.data?.user || null
                    },
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            resetPasswordForEmail: async (email, options = {}) => {
                const officialClient = await getOfficialClient()
                if (!officialClient?.auth?.resetPasswordForEmail) {
                    return {
                        data: {},
                        error: normalizeAuthError({ code: "auth/unavailable", message: "supabase-client-unavailable" })
                    }
                }

                const result = await officialClient.auth.resetPasswordForEmail(email, {
                    redirectTo: resolveRedirectTo(options)
                })
                return {
                    data: result.data || {},
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            signInWithIdToken: createDelegatedAuthMethod("signInWithIdToken", (result) => ({
                data: {
                    session: result.data?.session || null,
                    user: result.data?.user || null
                },
                error: result.error ? normalizeAuthError(result.error) : null
            })),
            signInWithOAuth: async ({ provider, options = {} } = {}) => {
                const officialClient = await getOfficialClient()
                if (!officialClient?.auth?.signInWithOAuth) {
                    return {
                        data: null,
                        error: normalizeAuthError({ code: "auth/unavailable", message: "supabase-client-unavailable" })
                    }
                }

                return officialClient.auth.signInWithOAuth({
                    provider,
                    options: {
                        ...options,
                        redirectTo: resolveRedirectTo(options)
                    }
                })
            },
            updateUser: async ({ data = {} } = {}) => {
                const officialClient = await getOfficialClient()
                if (!officialClient?.auth?.updateUser) {
                    return {
                        data: { user: null },
                        error: normalizeAuthError({ code: "auth/unavailable", message: "supabase-client-unavailable" })
                    }
                }

                const result = await officialClient.auth.updateUser({ data })
                return {
                    data: {
                        user: result.data?.user || null
                    },
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            signOut: async () => {
                const officialClient = await getOfficialClient()
                const result = officialClient?.auth?.signOut
                    ? await officialClient.auth.signOut()
                    : { error: null }
                setCurrentSession(null)
                notifyAuthStateChange("SIGNED_OUT", null)
                return {
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            async getSession() {
                const currentSession = getCurrentSession()
                void getOfficialClient()
                if (currentSession) {
                    if (isSessionExpired(currentSession)) {
                        const verifiedSession = await ensureStoredSession()
                        return {
                            data: {
                                session: verifiedSession || currentSession || null
                            },
                            error: null
                        }
                    }
                    void ensureStoredSession()
                }
                return {
                    data: {
                        session: currentSession || null
                    },
                    error: null
                }
            },
            onAuthStateChange(callback) {
                if (typeof callback === "function") {
                    authStateSubscribers.add(callback)
                }
                return {
                    data: {
                        subscription: {
                            unsubscribe() {
                                authStateSubscribers.delete(callback)
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
    supabaseClientSingleton = createClientFacade()
    return supabaseClientSingleton
}

const supabaseClientTestUtils = {
    reset() {
        supabaseClientSingleton = null
        officialClientLoadPromise = null
        officialClientSingletonPromise = null
        sessionRefreshPromise = null
        authStateSubscribers.clear()
    }
}

if (typeof window !== "undefined") {
    window.__smartnotesSupabaseTestUtils = supabaseClientTestUtils
}
