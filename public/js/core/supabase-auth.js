import { initSupabase } from "./supabase.js"
import { preloadGoogleIdentity, requestGoogleIdentityToken, resetGoogleIdentitySession } from "./googleIdentityAuth.js"

const sessionEndpoint = "/api/supabase/session"
const PROFILE_SYNC_TIMEOUT_MS = 8000
const GOOGLE_ID_TOKEN_SIGN_IN_TIMEOUT_MS = 9000

function createAuthError(code, message, details = {}) {
    const error = new Error(message)
    error.code = code
    error.details = details
    return error
}

function withTimeout(promise, timeoutMilliseconds, code, message) {
    let timeoutId = null
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(createAuthError(code, message, { timeoutMilliseconds }))
        }, timeoutMilliseconds)
    })

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId)
    })
}

function readProfileValue(user, ...keys) {
    for (const key of keys) {
        const value = user?.[key] ?? user?.user_metadata?.[key]
        if (typeof value === "string" && value) return value
    }
    return ""
}

function normalizeUser(user, session, updateProfile) {
    if (!user) return null
    const accessToken = String(session?.access_token || "")
    return {
        uid: String(user.id || ""),
        id: String(user.id || ""),
        email: String(user.email || ""),
        displayName: String(readProfileValue(user, "display_name", "displayName", "full_name")),
        photoURL: String(readProfileValue(user, "avatar_url", "photoURL", "picture")),
        providerData: [],
        accessToken,
        async getIdToken() {
            if (accessToken) return accessToken
            throw createAuthError("auth/token-missing", "Missing access token")
        },
        updateProfile
    }
}

function getSessionAccessToken(session) {
    return String(session?.access_token || "")
}

async function syncProfile(session, updateProfile) {
    const accessToken = getSessionAccessToken(session)
    if (!accessToken) return null

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), PROFILE_SYNC_TIMEOUT_MS)
        : null

    let response = null
    try {
        response = await fetch(sessionEndpoint, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            ...(controller ? { signal: controller.signal } : {})
        })
    } finally {
        if (timeoutId) clearTimeout(timeoutId)
    }

    if (!response.ok) {
        throw new Error(`supabase-session-http-${response.status}`)
    }

    const payload = await response.json()
    return normalizeUser(payload?.user || null, session, updateProfile)
}

function createPersistenceEnum() {
    return {
        LOCAL: "local"
    }
}

function getGoogleClientId() {
    return String(window.SmartNotesSupabaseConfig?.googleClientId || "").trim()
}

function decodeBase64UrlValue(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/")
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
    return atob(normalized + padding)
}

function decodeJwtPayload(token) {
    try {
        const [, payload] = String(token || "").split(".")
        if (!payload) return null
        return JSON.parse(decodeBase64UrlValue(payload))
    } catch {
        return null
    }
}

async function resolveRuntimeGoogleClientId() {
    const currentClientId = getGoogleClientId()
    if (currentClientId) return currentClientId

    const configPromise = window.__smartnotesSupabaseConfigPromise
    if (configPromise && typeof configPromise.then === "function") {
        await configPromise.catch(() => null)
    }

    return getGoogleClientId()
}

export async function createSupabaseAuth() {
    const client = await initSupabase()
    if (!client) {
        throw new Error("supabase-client-unavailable")
    }

    let currentUser = null
    let lastResolvedAccessToken = ""
    let inFlightProfileSync = null
    const authStateSubscribers = new Set()
    let initialAuthStatePromiseResolve = null
    const initialAuthStatePromise = new Promise(resolve => {
        initialAuthStatePromiseResolve = resolve
    })
    const notifyCurrentUserChanged = () => {
        authStateSubscribers.forEach(callback => {
            Promise.resolve(callback(currentUser)).catch(error => {
                console.error("[SupabaseAuth] auth state callback failed", error)
            })
        })
    }
    const resolveUserFromSession = async (session) => {
        const accessToken = getSessionAccessToken(session)
        if (!session?.user || !accessToken) {
            lastResolvedAccessToken = ""
            inFlightProfileSync = null
            return null
        }

        if (accessToken === lastResolvedAccessToken && currentUser) {
            return currentUser
        }

        if (inFlightProfileSync?.accessToken === accessToken) {
            return currentUser || inFlightProfileSync.promise
        }

        const fallbackUser = normalizeUser(session.user, session, applyUserProfileUpdate)
        currentUser = fallbackUser
        lastResolvedAccessToken = accessToken

        const promise = syncProfile(session, applyUserProfileUpdate)
            .catch((error) => {
                console.error("[SupabaseAuth] session sync failed", error)
                return fallbackUser
            })
            .then((resolvedUser) => {
                const nextUser = resolvedUser || fallbackUser
                const identityChanged = JSON.stringify({
                    uid: currentUser?.uid || "",
                    email: currentUser?.email || "",
                    displayName: currentUser?.displayName || "",
                    photoURL: currentUser?.photoURL || ""
                }) !== JSON.stringify({
                    uid: nextUser?.uid || "",
                    email: nextUser?.email || "",
                    displayName: nextUser?.displayName || "",
                    photoURL: nextUser?.photoURL || ""
                })
                currentUser = nextUser
                lastResolvedAccessToken = accessToken
                if (inFlightProfileSync?.accessToken === accessToken) {
                    inFlightProfileSync = null
                }
                if (identityChanged) {
                    notifyCurrentUserChanged()
                }
                return nextUser
            })

        inFlightProfileSync = { accessToken, promise }
        return fallbackUser
    }

    const applyUserProfileUpdate = async ({ displayName, photoURL } = {}) => {
        const currentSession = (await client.auth.getSession())?.data?.session || null
        if (!currentSession?.user) {
            throw new Error("supabase-session-missing")
        }

        const nextUserMetadata = {
            ...(currentSession.user.user_metadata || {})
        }

        if (displayName !== undefined) {
            nextUserMetadata.display_name = String(displayName || "").trim()
        }
        if (photoURL !== undefined) {
            nextUserMetadata.avatar_url = String(photoURL || "")
        }

        const { error } = await client.auth.updateUser({
            data: nextUserMetadata
        })
        if (error) throw error

        const nextSession = (await client.auth.getSession())?.data?.session || currentSession
        currentUser = await resolveUserFromSession(nextSession)
        return currentUser
    }

    const authApi = {
        app: { options: { clientId: "" } },
        Auth: {
            Persistence: createPersistenceEnum()
        },
        get currentUser() {
            return currentUser
        },
        async setPersistence() {
            return true
        },
        async signInWithEmailAndPassword(email, password) {
            const { error } = await client.auth.signInWithPassword({ email, password })
            if (error) throw error
            const sessionResult = await client.auth.getSession()
            currentUser = await resolveUserFromSession(sessionResult?.data?.session || null)
            return { user: currentUser }
        },
        async createUserWithEmailAndPassword(email, password) {
            const result = await client.auth.signUp({ email, password })
            if (result.error) throw result.error

            const session = result?.data?.session || (await client.auth.getSession())?.data?.session || null
            currentUser = session ? await resolveUserFromSession(session) : null
            return {
                user: currentUser,
                pendingConfirmation: !session && !!result?.data?.user
            }
        },
        async sendPasswordResetEmail(email) {
            const { error } = await client.auth.resetPasswordForEmail(email)
            if (error) throw error
            return true
        },
        async fetchSignInMethodsForEmail() {
            return []
        },
        async signOut() {
            await resetGoogleIdentitySession().catch(() => false)
            const { error } = await client.auth.signOut()
            if (error) throw error
            currentUser = null
        },
        async getRedirectResult() {
            return null
        },
        async preloadGoogleSignIn() {
            const clientId = await resolveRuntimeGoogleClientId()
            return preloadGoogleIdentity({ clientId })
        },
        async signInWithGoogleOneTap(options = {}) {
            const clientId = await resolveRuntimeGoogleClientId()
            if (!clientId) {
                throw { code: "auth/google-identity-client-id-missing", message: "Google client id is missing" }
            }

            const idToken = await requestGoogleIdentityToken({
                clientId,
                interactive: options?.interactive !== false
            })
            const tokenPayload = decodeJwtPayload(idToken)
            const result = await withTimeout(
                client.auth.signInWithIdToken({
                    provider: "google",
                    token: idToken,
                    clientId,
                    issuer: String(tokenPayload?.iss || "https://accounts.google.com"),
                    nonce: typeof tokenPayload?.nonce === "string" ? tokenPayload.nonce : ""
                }),
                GOOGLE_ID_TOKEN_SIGN_IN_TIMEOUT_MS,
                "auth/google-id-token-sign-in-timeout",
                "Google token sign-in timeout"
            )
            if (result.error) throw result.error
            const session = result?.data?.session || (await client.auth.getSession())?.data?.session || null
            currentUser = await resolveUserFromSession(session)
            return { user: currentUser }
        },
        async signInWithPopup(options = {}) {
            return this.signInWithGoogleOneTap(options)
        },
        async signInWithRedirect() {
            const result = await client.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: window.location.origin + "/auth/callback",
                    scopes: "openid email profile"
                }
            })
            if (result.error) throw result.error
            return { user: null }
        },
        onAuthStateChanged(next, error) {
            const callback = typeof next === "function" ? next : () => {}
            authStateSubscribers.add(callback)
            initialAuthStatePromise.then(() => Promise.resolve(callback(currentUser))).catch(err => {
                console.error("[SupabaseAuth] initial auth callback failed", err)
            })
            return () => {
                authStateSubscribers.delete(callback)
            }
        }
    }

    const emitAuthState = async (session) => {
        currentUser = session?.user ? await resolveUserFromSession(session) : null
        initialAuthStatePromiseResolve?.()
        initialAuthStatePromiseResolve = null

        notifyCurrentUserChanged()
    }

    const initialSessionResult = await client.auth.getSession()
    const initialSession = initialSessionResult?.data?.session || null
    await emitAuthState(initialSession)
    if (!initialSession) {
        authApi.preloadGoogleSignIn().catch(() => false)
    }

    client.auth.onAuthStateChange((_event, session) => {
        emitAuthState(session)
    })

    return authApi
}
