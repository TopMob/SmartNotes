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

function createStorageAdapter(storageAccessor) {
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

    return {
        isAvailable,
        get(key, defaultValue = null) {
            try {
                const storageInstance = storageAccessor()
                if (!storageInstance) return defaultValue
                const storedValue = storageInstance.getItem(String(key))
                return typeof storedValue === "string" ? storedValue : defaultValue
            } catch {
                return defaultValue
            }
        },
        set(key, value) {
            try {
                const storageInstance = storageAccessor()
                if (!storageInstance) return false
                storageInstance.setItem(String(key), String(value))
                return true
            } catch (error) {
                if (isQuotaError(error)) {
                    try {
                        const storageInstance = storageAccessor()
                        if (!storageInstance) return false
                        storageInstance.removeItem("notes-cache")
                        storageInstance.setItem(String(key), String(value))
                        return true
                    } catch {
                        return false
                    }
                }
                return false
            }
        },
        remove(key) {
            try {
                const storageInstance = storageAccessor()
                if (!storageInstance) return false
                storageInstance.removeItem(String(key))
                return true
            } catch {
                return false
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
        setJson(key, value) {
            try {
                const serializedValue = JSON.stringify(value)
                return this.set(key, serializedValue)
            } catch {
                return false
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
