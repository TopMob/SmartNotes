import { initSupabase } from "./supabase.js"

const sessionEndpoint = "/api/supabase/session"

function readProfileValue(user, ...keys) {
    for (const key of keys) {
        const value = user?.[key] ?? user?.user_metadata?.[key]
        if (typeof value === "string" && value) return value
    }
    return ""
}

function normalizeUser(user, session, updateProfile) {
    if (!user) return null
    return {
        uid: String(user.id || ""),
        id: String(user.id || ""),
        email: String(user.email || ""),
        displayName: String(readProfileValue(user, "display_name", "displayName", "full_name")),
        photoURL: String(readProfileValue(user, "avatar_url", "photoURL", "picture")),
        providerData: [],
        accessToken: String(session?.access_token || ""),
        updateProfile
    }
}

async function syncProfile(session, updateProfile) {
    const accessToken = String(session?.access_token || "")
    if (!accessToken) return null

    const response = await fetch(sessionEndpoint, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

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

export async function createSupabaseAuth() {
    const client = await initSupabase()
    if (!client) {
        throw new Error("supabase-client-unavailable")
    }

    let currentUser = null
    const authStateSubscribers = new Set()
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
        currentUser = await syncProfile(nextSession, applyUserProfileUpdate)
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
            currentUser = await syncProfile(sessionResult?.data?.session || null, applyUserProfileUpdate)
            return { user: currentUser }
        },
        async createUserWithEmailAndPassword(email, password) {
            const result = await client.auth.signUp({ email, password })
            if (result.error) throw result.error

            const session = result?.data?.session || (await client.auth.getSession())?.data?.session || null
            currentUser = session ? await syncProfile(session, applyUserProfileUpdate) : null
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
            return ["password"]
        },
        async signOut() {
            const { error } = await client.auth.signOut()
            if (error) throw error
            currentUser = null
        },
        async getRedirectResult() {
            return null
        },
        async signInWithPopup() {
            throw { code: "auth/operation-not-supported-in-this-environment", message: "Google auth is temporarily disabled during Supabase cutover" }
        },
        async signInWithRedirect() {
            throw { code: "auth/operation-not-supported-in-this-environment", message: "Google auth is temporarily disabled during Supabase cutover" }
        },
        onAuthStateChanged(next, error) {
            const callback = typeof next === "function" ? next : () => {}
            authStateSubscribers.add(callback)
            Promise.resolve(callback(currentUser)).catch(err => {
                if (typeof error === "function") error(err)
            })
            return () => {
                authStateSubscribers.delete(callback)
            }
        }
    }

    const emitAuthState = async (session) => {
        try {
            currentUser = session?.user ? await syncProfile(session, applyUserProfileUpdate) : null
        } catch (error) {
            console.error("[SupabaseAuth] session sync failed", error)
            currentUser = null
        }

        authStateSubscribers.forEach(callback => {
            Promise.resolve(callback(currentUser)).catch(error => {
                console.error("[SupabaseAuth] auth state callback failed", error)
            })
        })
    }

    const initialSessionResult = await client.auth.getSession()
    const initialSession = initialSessionResult?.data?.session || null
    await emitAuthState(initialSession)

    client.auth.onAuthStateChange((_event, session) => {
        emitAuthState(session)
    })

    return authApi
}
