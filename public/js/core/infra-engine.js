"use strict";

import { createSupabaseAuth } from "./supabase-auth.js"
import { createAuthManager } from "./auth.js"

const createApiEndpoint = path => window.SmartNotesBackendConfig?.createApiEndpoint?.(path) || `/api/${String(path || "").replace(/^\/+/, "")}`

const createServerTimestamp = () => new Date().toISOString()

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
    data: () => ({ ...(record || {}) }),
    ref: null
})

const mergePatchIntoRecord = (record, patch = {}) => {
    const sourceRecord = record && typeof record === "object" ? record : {}
    const sourcePatch = patch && typeof patch === "object" ? patch : {}
    const nextRecord = { ...sourceRecord, ...sourcePatch }

    if (Object.prototype.hasOwnProperty.call(sourcePatch, "lock.hidden")) {
        nextRecord.lock = {
            ...(sourceRecord.lock && typeof sourceRecord.lock === "object" ? sourceRecord.lock : {}),
            hidden: !!sourcePatch["lock.hidden"]
        }
    }

    return nextRecord
}

const applyFilters = (rows, filters = []) => {
    return (Array.isArray(rows) ? rows : []).filter(row => {
        return filters.every(filter => {
            if (!filter || filter.operator !== "==") return true
            return row?.[filter.field] === filter.value
        })
    })
}

const sortByUpdatedDesc = rows => [...rows].sort((first, second) => {
    const firstTime = Date.parse(String(first?.updatedAt || first?.createdAt || "")) || 0
    const secondTime = Date.parse(String(second?.updatedAt || second?.createdAt || "")) || 0
    if (secondTime !== firstTime) return secondTime - firstTime
    return String(second?.id || "").localeCompare(String(first?.id || ""))
})

const createBatchApi = () => {
    const operations = []
    return {
        set(reference, data) {
            operations.push(() => reference.set(data))
        },
        update(reference, data) {
            operations.push(() => reference.update(data))
        },
        delete(reference) {
            operations.push(() => reference.delete())
        },
        async commit() {
            for (const operation of operations) {
                await operation()
            }
        }
    }
}

const createCollectionApi = ({ user, endpoint, filters = [], startAfterDocument = null, limitValue = null }) => ({
    async get() {
        const query = new URLSearchParams()
        if (Number.isFinite(Number(limitValue)) && Number(limitValue) > 0) {
            query.set("limit", String(limitValue))
        }
        if (startAfterDocument?.id) {
            query.set("startAfterId", String(startAfterDocument.id))
        }

        const requestUrl = `${createApiEndpoint(endpoint)}${query.toString() ? `?${query.toString()}` : ""}`
        const response = await fetch(requestUrl, {
            method: "GET",
            headers: buildAuthorizedHeaders(user)
        })
        if (!response.ok) throw new Error(`supabase-collection-http-${response.status}`)
        const payload = await response.json()
        const rawRows = Array.isArray(payload?.notes) ? payload.notes : Array.isArray(payload?.folders) ? payload.folders : []
        const filteredRows = applyFilters(rawRows, filters)
        const sortedRows = endpoint === "supabase/notes" ? sortByUpdatedDesc(filteredRows) : filteredRows
        const limitedRows = Number.isFinite(Number(limitValue)) && Number(limitValue) > 0
            ? sortedRows.slice(0, Number(limitValue))
            : sortedRows
        const docs = limitedRows.map(record => {
            const snapshot = createDocumentSnapshot(record)
            snapshot.ref = createCollectionApi({ user, endpoint, filters }).doc(snapshot.id)
            return snapshot
        })
        return { docs, forEach(callback) { docs.forEach(callback) } }
    },
    async add(data) {
        const response = await fetch(createApiEndpoint(endpoint), {
            method: "POST",
            headers: buildAuthorizedHeaders(user),
            body: JSON.stringify(data || {})
        })
        if (!response.ok) throw new Error(`supabase-collection-add-http-${response.status}`)
        const payload = await response.json()
        return payload?.note || payload?.folder || payload || null
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
                const method = endpoint === "supabase/notes" || endpoint === "supabase/folders" ? "PUT" : "POST"
                const payload = method === "PUT"
                    ? mergePatchIntoRecord((await this.get()).data(), { ...(data || {}), id: documentId })
                    : { ...(data || {}), id: documentId }
                const response = await fetch(createApiEndpoint(endpoint), {
                    method,
                    headers: buildAuthorizedHeaders(user),
                    body: JSON.stringify(payload)
                })
                if (!response.ok) throw new Error(`supabase-doc-update-http-${response.status}`)
                return response.json()
            },
            async delete() {
                const response = await fetch(`${createApiEndpoint(endpoint)}?id=${encodeURIComponent(documentId)}`, {
                    method: "DELETE",
                    headers: buildAuthorizedHeaders(user)
                })
                if (!response.ok) throw new Error(`supabase-doc-delete-http-${response.status}`)
                return response.json()
            },
            async get() {
                const collectionResult = await createCollectionApi({ user, endpoint, filters }).get()
                const matched = collectionResult.docs.find(entry => entry.id === documentId)
                return matched || { id: documentId, exists: false, data: () => ({}), ref: this }
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
                const intervalId = setInterval(poll, 15000)
                return () => {
                    cancelled = true
                    clearInterval(intervalId)
                }
            }
        }
    },
    limit() {
        return createCollectionApi({ user, endpoint, filters, startAfterDocument, limitValue: arguments[0] })
    },
    startAfter() {
        return createCollectionApi({ user, endpoint, filters, startAfterDocument: arguments[0], limitValue })
    },
    where(field, operator, value) {
        return createCollectionApi({
            user,
            endpoint,
            filters: [...filters, { field, operator, value }],
            startAfterDocument,
            limitValue
        })
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
        const intervalId = setInterval(poll, 15000)
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
    getUserSettingsReference(user) {
        return {
            async get() {
                const response = await fetch(createApiEndpoint("supabase/settings"), {
                    method: "GET",
                    headers: buildAuthorizedHeaders(user)
                })
                if (!response.ok) throw new Error(`supabase-settings-http-${response.status}`)
                const payload = await response.json()
                const settings = payload?.settings || null
                return {
                    exists: !!settings,
                    data: () => settings || {}
                }
            },
            async set(data) {
                const response = await fetch(createApiEndpoint("supabase/settings"), {
                    method: "POST",
                    headers: buildAuthorizedHeaders(user),
                    body: JSON.stringify({ settings: data })
                })
                if (!response.ok) throw new Error(`supabase-settings-save-http-${response.status}`)
                return response.json()
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
                const intervalId = setInterval(poll, 15000)
                return () => {
                    cancelled = true
                    clearInterval(intervalId)
                }
            }
        }
    },
    getUserLegacySettingsReference() {
        return null
    }
})

const infraState = {
    app: { name: "supabase" },
    auth: null,
    db: { kind: "supabase-http", batch: createBatchApi },
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
