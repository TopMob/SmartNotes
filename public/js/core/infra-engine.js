"use strict";

import { createSupabaseAuth } from "./supabase-auth.js"
import { createAuthManager } from "./auth.js"

const createApiEndpoint = path => window.SmartNotesBackendConfig?.createApiEndpoint?.(path) || `/api/${String(path || "").replace(/^\/+/, "")}`

const buildAuthorizedHeaders = user => {
    const accessToken = String(user?.accessToken || "")
    return {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(user?.uid ? { "x-user-id": String(user.uid) } : {})
    }
}

const createDocumentSnapshot = (record) => ({
    id: String(record?.id || ""),
    exists: !!record,
    data: () => ({ ...(record || {}) })
})

const createCollectionApi = ({ user, endpoint }) => ({
    async get() {
        const response = await fetch(createApiEndpoint(endpoint), {
            method: "GET",
            headers: buildAuthorizedHeaders(user)
        })
        if (!response.ok) throw new Error(`supabase-collection-http-${response.status}`)
        const payload = await response.json()
        const rows = Array.isArray(payload?.notes) ? payload.notes : Array.isArray(payload?.folders) ? payload.folders : []
        return { docs: rows.map(createDocumentSnapshot) }
    },
    doc(id = "") {
        const documentId = String(id || "")
        return {
            async set(data) {
                const response = await fetch(createApiEndpoint(endpoint), {
                    method: "POST",
                    headers: buildAuthorizedHeaders(user),
                    body: JSON.stringify({ ...(data || {}), id: documentId })
                })
                if (!response.ok) throw new Error(`supabase-doc-set-http-${response.status}`)
                return response.json()
            },
            async update(data) {
                return this.set(data)
            },
            async get() {
                const collectionResult = await createCollectionApi({ user, endpoint }).get()
                const matched = collectionResult.docs.find(entry => entry.id === documentId)
                return matched || { id: documentId, exists: false, data: () => ({}) }
            },
            onSnapshot(next) {
                let cancelled = false
                const poll = async () => {
                    if (cancelled) return
                    try {
                        const snapshot = await this.get()
                        next(snapshot)
                    } catch {}
                }
                poll()
                const intervalId = setInterval(poll, 5000)
                return () => {
                    cancelled = true
                    clearInterval(intervalId)
                }
            }
        }
    },
    limit() {
        return this
    },
    startAfter() {
        return this
    },
    onSnapshot(next, error) {
        let cancelled = false
        const poll = async () => {
            if (cancelled) return
            try {
                const snapshot = await this.get()
                next(snapshot)
            } catch (pollError) {
                if (typeof error === "function") error(pollError)
            }
        }
        poll()
        const intervalId = setInterval(poll, 5000)
        return () => {
            cancelled = true
            clearInterval(intervalId)
        }
    }
})

const createRefsApi = () => ({
    getUserStorageCollectionName: () => "profiles",
    getUserRootReference: user => ({
        async set(data) {
            const response = await fetch(createApiEndpoint("supabase/session"), {
                method: "POST",
                headers: buildAuthorizedHeaders(user),
                body: JSON.stringify({
                    userId: user?.uid,
                    email: user?.email,
                    displayName: data?.displayName || user?.displayName || "",
                    avatarUrl: data?.avatarUrl || user?.photoURL || ""
                })
            })
            if (!response.ok) throw new Error(`supabase-profile-sync-http-${response.status}`)
            return response.json()
        }
    }),
    ensureUserDocument: async user => ({ id: user?.uid || "" }),
    getUserNotesCollection(user) {
        return createCollectionApi({ user, endpoint: "supabase/notes" })
    },
    getUserFoldersCollection(user) {
        return createCollectionApi({ user, endpoint: "supabase/folders" })
    },
    getUserSharedCollection() {
        return null
    },
    getUserSettingsReference() {
        return null
    },
    getUserLegacySettingsReference() {
        return null
    }
})

const infraState = {
    app: { name: "supabase" },
    auth: null,
    db: { kind: "supabase-http" },
    authManager: null,
    refsApi: null
}

const InfraEngine = {
    async init() {
        if (infraState.auth && infraState.db) return infraState
        const auth = await createSupabaseAuth()
        infraState.auth = auth
        infraState.refsApi = createRefsApi()
        window.auth = auth
        window.db = infraState.db
        window.DataPath = infraState.refsApi
        return infraState
    },
    async createAuth() {
        if (infraState.authManager) return infraState.authManager
        if (!infraState.auth) await this.init()
        infraState.authManager = createAuthManager({ auth: infraState.auth })
        return infraState.authManager
    },
    async login() {
        const manager = await this.createAuth()
        return manager.login()
    },
    async logout() {
        const manager = await this.createAuth()
        return manager.logout()
    },
    getUser() {
        return infraState.auth?.currentUser || null
    },
    getRefs() {
        if (!infraState.refsApi) throw new Error("InfraEngine not initialized")
        return infraState.refsApi
    },
    getAuth() {
        if (!infraState.auth) throw new Error("InfraEngine not initialized")
        return infraState.auth
    },
    getDb() {
        if (!infraState.db) throw new Error("InfraEngine not initialized")
        return infraState.db
    }
}

window.InfraEngine = InfraEngine

export { InfraEngine }
