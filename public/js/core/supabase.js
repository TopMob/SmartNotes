let supabaseClientSingleton = null
let officialClientLoadPromise = null

const AUTH_CALLBACK_PATH = "/auth/callback"
const OFFICIAL_STORAGE_KEY = "sb-smartnotes-auth-token"
const SUPABASE_BROWSER_SCRIPT_SRC = "/vendor/supabase.js"

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

function migrateLegacySession() {
    const legacySession = readLegacyStoredSession()
    if (!legacySession) return
    try {
        if (!window.localStorage.getItem(OFFICIAL_STORAGE_KEY)) {
            window.localStorage.setItem(OFFICIAL_STORAGE_KEY, JSON.stringify(legacySession))
        }
        window.localStorage.removeItem("smartnotes.supabase.session")
    } catch {
        return
    }
}

async function loadOfficialSupabaseCreateClient() {
    if (!officialClientLoadPromise) {
        officialClientLoadPromise = new Promise((resolve, reject) => {
            const resolveFactory = () => {
                const createClient = window.supabase?.createClient
                if (typeof createClient !== "function") {
                    reject(new Error("supabase-create-client-missing"))
                    return false
                }
                resolve(createClient)
                return true
            }

            if (resolveFactory()) return

            const existingScript = document.querySelector(`script[src="${SUPABASE_BROWSER_SCRIPT_SRC}"]`)
            if (existingScript) {
                existingScript.addEventListener("load", () => {
                    resolveFactory()
                }, { once: true })
                existingScript.addEventListener("error", () => {
                    reject(new Error("supabase-browser-script-failed"))
                }, { once: true })
                return
            }

            const scriptElement = document.createElement("script")
            scriptElement.src = SUPABASE_BROWSER_SCRIPT_SRC
            scriptElement.async = true
            scriptElement.addEventListener("load", () => {
                resolveFactory()
            }, { once: true })
            scriptElement.addEventListener("error", () => {
                reject(new Error("supabase-browser-script-failed"))
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

async function createClient() {
    migrateLegacySession()
    const createOfficialClient = await loadOfficialSupabaseCreateClient()
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

    return {
        auth: {
            async signInWithPassword({ email, password }) {
                const result = await officialClient.auth.signInWithPassword({ email, password })
                return {
                    data: {
                        session: result.data?.session || null,
                        user: result.data?.user || null
                    },
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            async signUp({ email, password, options = {} }) {
                const result = await officialClient.auth.signUp({
                    email,
                    password,
                    options: {
                        ...(options && typeof options === "object" ? options : {}),
                        emailRedirectTo: resolveRedirectTo(options)
                    }
                })
                return {
                    data: {
                        session: result.data?.session || null,
                        user: result.data?.user || null
                    },
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            async resetPasswordForEmail(email, options = {}) {
                const result = await officialClient.auth.resetPasswordForEmail(email, {
                    redirectTo: resolveRedirectTo(options)
                })
                return {
                    data: result.data || {},
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            async signInWithIdToken({ provider, token, nonce } = {}) {
                const result = await officialClient.auth.signInWithIdToken({
                    provider,
                    token,
                    nonce
                })
                return {
                    data: {
                        session: result.data?.session || null,
                        user: result.data?.user || null
                    },
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            async signInWithOAuth({ provider, options = {} } = {}) {
                return officialClient.auth.signInWithOAuth({
                    provider,
                    options: {
                        ...options,
                        redirectTo: resolveRedirectTo(options)
                    }
                })
            },
            async updateUser({ data = {} } = {}) {
                const result = await officialClient.auth.updateUser({ data })
                return {
                    data: {
                        user: result.data?.user || null
                    },
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            async signOut() {
                const result = await officialClient.auth.signOut()
                return {
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            async getSession() {
                const result = await officialClient.auth.getSession()
                return {
                    data: {
                        session: result.data?.session || null
                    },
                    error: result.error ? normalizeAuthError(result.error) : null
                }
            },
            onAuthStateChange(callback) {
                return officialClient.auth.onAuthStateChange(callback)
            }
        }
    }
}

export async function initSupabase() {
    if (supabaseClientSingleton) return supabaseClientSingleton
    getRuntimeConfig()
    supabaseClientSingleton = await createClient()
    return supabaseClientSingleton
}

export const __supabaseClientTestUtils = {
    reset() {
        supabaseClientSingleton = null
        officialClientLoadPromise = null
    }
}
