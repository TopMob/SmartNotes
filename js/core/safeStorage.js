function isQuotaError(error) {
    if (!error) return false
    const errorName = String(error.name || "")
    const errorCode = Number(error.code || 0)
    if (errorName === "QuotaExceededError") return true
    if (errorName === "NS_ERROR_DOM_QUOTA_REACHED") return true
    if (errorCode === 22) return true
    if (errorCode === 1014) return true
    const errorMessage = String(error.message || "").toLowerCase()
    return errorMessage.includes("quota") && errorMessage.includes("exceed")
}

function createStorageResult({ success, errorType = null, storage = null, key = "", evictedKeys = [] }) {
    return { success: !!success, errorType, storage, key: String(key), evictedKeys: Array.isArray(evictedKeys) ? evictedKeys : [] }
}

function createIndexedDbStore() {
    const databaseName = "smartnotes-fallback"
    const objectStoreName = "entries"
    const databaseVersion = 1

    const isSupported = () => typeof window !== "undefined" && !!window.indexedDB

    const openDatabase = () => new Promise((resolve, reject) => {
        if (!isSupported()) {
            reject(new Error("indexeddb-unavailable"))
            return
        }
        const openRequest = window.indexedDB.open(databaseName, databaseVersion)
        openRequest.onerror = () => reject(openRequest.error || new Error("indexeddb-open-failed"))
        openRequest.onupgradeneeded = () => {
            const database = openRequest.result
            if (!database.objectStoreNames.contains(objectStoreName)) {
                database.createObjectStore(objectStoreName, { keyPath: "key" })
            }
        }
        openRequest.onsuccess = () => resolve(openRequest.result)
    })

    const withStore = async (mode, operation) => {
        const database = await openDatabase()
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(objectStoreName, mode)
            const store = transaction.objectStore(objectStoreName)
            const result = operation(store)
            transaction.oncomplete = () => {
                database.close()
                resolve(result)
            }
            transaction.onerror = () => {
                const error = transaction.error || new Error("indexeddb-transaction-failed")
                database.close()
                reject(error)
            }
            transaction.onabort = () => {
                const error = transaction.error || new Error("indexeddb-transaction-aborted")
                database.close()
                reject(error)
            }
        })
    }

    const set = async (key, value) => {
        const serialized = String(value)
        await withStore("readwrite", (store) => {
            store.put({ key: String(key), value: serialized, updatedAt: Date.now() })
        })
        return true
    }

    const get = async (key) => {
        const normalizedKey = String(key)
        const database = await openDatabase()
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(objectStoreName, "readonly")
            const store = transaction.objectStore(objectStoreName)
            const request = store.get(normalizedKey)
            request.onsuccess = () => {
                const record = request.result
                database.close()
                resolve(record && typeof record.value === "string" ? record.value : null)
            }
            request.onerror = () => {
                const error = request.error || new Error("indexeddb-read-failed")
                database.close()
                reject(error)
            }
        })
    }

    const remove = async (key) => {
        await withStore("readwrite", (store) => {
            store.delete(String(key))
        })
        return true
    }

    return {
        isSupported,
        set,
        get,
        remove
    }
}

function createStorageAdapter(storageAccessor) {
    const registryKey = "__smartnotes_cache_registry__"
    const indexedDbStore = createIndexedDbStore()
    const priorityRank = { low: 0, normal: 1, high: 2 }
    const largeEditorKeys = new Set(["pending-note-save", "pending-images", "editor-content", "editor-media", "editor-draft"])

    const isAvailable = () => {
        try {
            const storageInstance = storageAccessor()
            if (!storageInstance) return false
            const probeKey = "__smartnotes_storage_probe__"
            storageInstance.setItem(probeKey, "1")
            storageInstance.removeItem(probeKey)
            return true
        } catch {
            return false
        }
    }

    const readRegistry = (storageInstance) => {
        if (!storageInstance) return {}
        try {
            const raw = storageInstance.getItem(registryKey)
            if (!raw) return {}
            const parsed = JSON.parse(raw)
            return parsed && typeof parsed === "object" ? parsed : {}
        } catch {
            return {}
        }
    }

    const writeRegistry = (storageInstance, registry) => {
        if (!storageInstance) return
        try {
            storageInstance.setItem(registryKey, JSON.stringify(registry))
        } catch {
            return
        }
    }

    const removeRegistryEntry = (storageInstance, key) => {
        const registry = readRegistry(storageInstance)
        if (!registry[String(key)]) return
        delete registry[String(key)]
        writeRegistry(storageInstance, registry)
    }

    const upsertRegistryEntry = (storageInstance, key, value, options = {}) => {
        const priority = options.priority === "high" || options.priority === "low" ? options.priority : "normal"
        const ttlMs = Number(options.ttlMs || 0)
        const now = Date.now()
        const registry = readRegistry(storageInstance)
        registry[String(key)] = {
            updatedAt: now,
            lastAccessedAt: now,
            priority,
            expiresAt: ttlMs > 0 ? now + ttlMs : 0,
            size: String(value).length
        }
        writeRegistry(storageInstance, registry)
    }

    const touchRegistryEntry = (storageInstance, key) => {
        const registry = readRegistry(storageInstance)
        const entry = registry[String(key)]
        if (!entry) return
        entry.lastAccessedAt = Date.now()
        registry[String(key)] = entry
        writeRegistry(storageInstance, registry)
    }

    const evictEntries = (storageInstance) => {
        if (!storageInstance) return []
        const now = Date.now()
        const registry = readRegistry(storageInstance)
        const entries = Object.entries(registry)
        const expired = entries
            .filter(([, value]) => Number(value?.expiresAt || 0) > 0 && Number(value?.expiresAt || 0) <= now)
            .map(([key]) => key)

        const candidates = entries
            .filter(([key]) => !expired.includes(key))
            .sort((first, second) => {
                const firstPriority = priorityRank[first[1]?.priority] ?? priorityRank.normal
                const secondPriority = priorityRank[second[1]?.priority] ?? priorityRank.normal
                if (firstPriority !== secondPriority) return firstPriority - secondPriority
                const firstAccess = Number(first[1]?.lastAccessedAt || first[1]?.updatedAt || 0)
                const secondAccess = Number(second[1]?.lastAccessedAt || second[1]?.updatedAt || 0)
                return firstAccess - secondAccess
            })
            .map(([key]) => key)

        const evictionOrder = [...expired, ...candidates]
        const evictedKeys = []
        for (let index = 0; index < evictionOrder.length; index++) {
            const cacheKey = evictionOrder[index]
            if (cacheKey === registryKey) continue
            try {
                storageInstance.removeItem(cacheKey)
                delete registry[cacheKey]
                evictedKeys.push(cacheKey)
                if (expired.includes(cacheKey)) continue
                if (evictedKeys.length >= 3) break
            } catch {
                continue
            }
        }
        writeRegistry(storageInstance, registry)
        return evictedKeys
    }

    const canFallbackToIndexedDb = (key, value, options = {}) => {
        if (!indexedDbStore.isSupported()) return false
        const normalizedKey = String(key)
        const sizeThreshold = Number(options.indexedDbThreshold || 120000)
        const serializedLength = String(value).length
        if (options.useIndexedDb === true) return true
        if (largeEditorKeys.has(normalizedKey) && serializedLength >= sizeThreshold / 2) return true
        return serializedLength >= sizeThreshold
    }

    const setLocal = (storageInstance, key, value, options = {}) => {
        const normalizedKey = String(key)
        const normalizedValue = String(value)
        storageInstance.setItem(normalizedKey, normalizedValue)
        upsertRegistryEntry(storageInstance, normalizedKey, normalizedValue, options)
        return createStorageResult({ success: true, key: normalizedKey, storage: "localStorage" })
    }

    return {
        isAvailable,
        get(key, defaultValue = null) {
            try {
                const storageInstance = storageAccessor()
                if (!storageInstance) return defaultValue
                const storedValue = storageInstance.getItem(String(key))
                if (typeof storedValue === "string") {
                    touchRegistryEntry(storageInstance, key)
                    return storedValue
                }
                return defaultValue
            } catch {
                return defaultValue
            }
        },
        async getAsync(key, defaultValue = null, options = {}) {
            const normalizedKey = String(key)
            const localValue = this.get(normalizedKey, null)
            if (localValue !== null) return localValue
            if (!options.allowIndexedDbFallback) return defaultValue
            try {
                const fallbackValue = await indexedDbStore.get(normalizedKey)
                return typeof fallbackValue === "string" ? fallbackValue : defaultValue
            } catch {
                return defaultValue
            }
        },
        set(key, value, options = {}) {
            const normalizedKey = String(key)
            const normalizedValue = String(value)
            try {
                const storageInstance = storageAccessor()
                if (!storageInstance) return createStorageResult({ success: false, errorType: "storage_unavailable", key: normalizedKey })
                return setLocal(storageInstance, normalizedKey, normalizedValue, options)
            } catch (error) {
                if (!isQuotaError(error)) return createStorageResult({ success: false, errorType: "write_failed", key: normalizedKey })
                try {
                    const storageInstance = storageAccessor()
                    if (!storageInstance) return createStorageResult({ success: false, errorType: "storage_unavailable", key: normalizedKey })
                    const evictedKeys = evictEntries(storageInstance)
                    if (evictedKeys.length > 0) {
                        const secondTry = setLocal(storageInstance, normalizedKey, normalizedValue, options)
                        secondTry.evictedKeys = evictedKeys
                        return secondTry
                    }
                } catch {
                    return createStorageResult({ success: false, errorType: "quota_exceeded", key: normalizedKey })
                }
                return createStorageResult({ success: false, errorType: "quota_exceeded", key: normalizedKey })
            }
        },
        async setAsync(key, value, options = {}) {
            const normalizedKey = String(key)
            const normalizedValue = String(value)
            const localResult = this.set(normalizedKey, normalizedValue, options)
            if (localResult.success) return localResult
            if (localResult.errorType !== "quota_exceeded") return localResult
            if (!canFallbackToIndexedDb(normalizedKey, normalizedValue, options)) return localResult
            try {
                await indexedDbStore.set(normalizedKey, normalizedValue)
                return createStorageResult({ success: true, key: normalizedKey, storage: "indexeddb", errorType: "quota_exceeded" })
            } catch {
                return createStorageResult({ success: false, key: normalizedKey, errorType: "indexeddb_write_failed" })
            }
        },
        remove(key) {
            try {
                const storageInstance = storageAccessor()
                if (!storageInstance) return createStorageResult({ success: false, errorType: "storage_unavailable", key })
                storageInstance.removeItem(String(key))
                removeRegistryEntry(storageInstance, key)
                return createStorageResult({ success: true, key: String(key), storage: "localStorage" })
            } catch {
                return createStorageResult({ success: false, errorType: "remove_failed", key: String(key) })
            }
        },
        async removeAsync(key, options = {}) {
            const localResult = this.remove(key)
            if (options.includeIndexedDb !== true) return localResult
            try {
                await indexedDbStore.remove(String(key))
                return localResult.success
                    ? localResult
                    : createStorageResult({ success: true, key: String(key), storage: "indexeddb" })
            } catch {
                return localResult
            }
        },
        getJson(key, defaultValue = null) {
            const storedValue = this.get(key, null)
            if (!storedValue) return defaultValue
            try {
                return JSON.parse(storedValue)
            } catch {
                return defaultValue
            }
        },
        async getJsonAsync(key, defaultValue = null, options = {}) {
            const storedValue = await this.getAsync(key, null, options)
            if (!storedValue) return defaultValue
            try {
                return JSON.parse(storedValue)
            } catch {
                return defaultValue
            }
        },
        setJson(key, value, options = {}) {
            try {
                const serializedValue = JSON.stringify(value)
                return this.set(key, serializedValue, options)
            } catch {
                return createStorageResult({ success: false, errorType: "serialization_failed", key: String(key) })
            }
        },
        async setJsonAsync(key, value, options = {}) {
            try {
                const serializedValue = JSON.stringify(value)
                return await this.setAsync(key, serializedValue, options)
            } catch {
                return createStorageResult({ success: false, errorType: "serialization_failed", key: String(key) })
            }
        }
    }
}

const safeLocalStorage = createStorageAdapter(() => {
    if (typeof window === "undefined") return null
    return window.localStorage || null
})

const safeSessionStorage = createStorageAdapter(() => {
    if (typeof window === "undefined") return null
    return window.sessionStorage || null
})

if (typeof window !== "undefined") {
    window.SafeStorage = {
        local: safeLocalStorage,
        session: safeSessionStorage
    }
    window.safeStorage = safeLocalStorage
}
