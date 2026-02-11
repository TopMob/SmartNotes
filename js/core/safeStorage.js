(function setupSafeStorage() {
    function createStorageAdapter(storageProvider, storageName) {
        const adapter = {
            isAvailable() {
                try {
                    const storage = storageProvider()
                    if (!storage) return false
                    const testKey = `__safe_storage_test_${Date.now()}`
                    storage.setItem(testKey, "1")
                    storage.removeItem(testKey)
                    return true
                } catch {
                    return false
                }
            },
            get(key) {
                try {
                    const storage = storageProvider()
                    if (!storage) return null
                    const value = storage.getItem(String(key))
                    return typeof value === "string" ? value : null
                } catch {
                    return null
                }
            },
            set(key, value) {
                try {
                    const storage = storageProvider()
                    if (!storage) return false
                    storage.setItem(String(key), String(value))
                    return true
                } catch (error) {
                    console.warn(`[Storage] ${storageName} set failed`, error)
                    return false
                }
            },
            remove(key) {
                try {
                    const storage = storageProvider()
                    if (!storage) return false
                    storage.removeItem(String(key))
                    return true
                } catch {
                    return false
                }
            },
            getJson(key, fallbackValue = null) {
                const rawValue = this.get(key)
                if (!rawValue) return fallbackValue
                try {
                    return JSON.parse(rawValue)
                } catch {
                    return fallbackValue
                }
            },
            setJson(key, value) {
                return this.set(key, JSON.stringify(value))
            }
        }
        return adapter
    }

    window.SafeStorage = {
        local: createStorageAdapter(() => window.localStorage, "localStorage"),
        session: createStorageAdapter(() => window.sessionStorage, "sessionStorage")
    }
})()
