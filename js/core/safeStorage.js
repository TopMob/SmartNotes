const warnOnce = (() => {
    const seen = new Set()
    return (key, ...args) => {
        if (seen.has(key)) return
        seen.add(key)
        console.warn(...args)
    }
})()

function isQuotaError(error) {
    if (!error) return false
    const name = String(error.name || "")
    const code = Number(error.code || 0)
    if (name === "QuotaExceededError") return true
    if (name === "NS_ERROR_DOM_QUOTA_REACHED") return true
    if (code === 22) return true
    if (code === 1014) return true
    const message = String(error.message || "").toLowerCase()
    if (message.includes("quota") && message.includes("exceed")) return true
    return false
}

function isSecurityError(error) {
    if (!error) return false
    const name = String(error.name || "")
    if (name === "SecurityError") return true
    const message = String(error.message || "").toLowerCase()
    if (message.includes("security")) return true
    return false
}

function canUseLocalStorage() {
    try {
        if (typeof window === "undefined" || !window.localStorage) return false
        const testKey = "__sn_test__"
        window.localStorage.setItem(testKey, "1")
        window.localStorage.removeItem(testKey)
        return true
    } catch {
        return false
    }
}

const APP_KEYS_EXACT = new Set([
    "notes-cache",
    "favorite-notes",
    "notes-filter",
    "app-preferences",
    "app-lang"
])

function purgeAppKeys() {
    try {
        if (!window.localStorage) return
        const storageKeys = []
        for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index)
            if (key) storageKeys.push(key)
        }
        storageKeys.forEach((key) => {
            if (APP_KEYS_EXACT.has(key)) {
                try {
                    window.localStorage.removeItem(key)
                } catch {}
            }
        })
    } catch {}
}

function removeKey(key) {
    try {
        if (!window.localStorage) return
        window.localStorage.removeItem(key)
    } catch {}
}

const safeStorage = {
    available: canUseLocalStorage(),

    get(key) {
        if (!this.available) return null
        try {
            const value = window.localStorage.getItem(key)
            return typeof value === "string" ? value : null
        } catch (error) {
            if (isSecurityError(error)) warnOnce("sn_storage_security_get", "[Storage] localStorage get blocked", error)
            return null
        }
    },

    set(key, value) {
        if (!this.available) return false
        try {
            window.localStorage.setItem(key, String(value))
            return true
        } catch (error) {
            if (isQuotaError(error)) {
                warnOnce("sn_storage_quota_set", "[Storage] localStorage quota exceeded, purging app cache keys", error)
                if (key !== "notes-cache") removeKey("notes-cache")
                purgeAppKeys()
                try {
                    window.localStorage.setItem(key, String(value))
                    return true
                } catch (retryError) {
                    warnOnce("sn_storage_quota_set_retry", "[Storage] localStorage still unavailable after purge", retryError)
                    return false
                }
            }
            if (isSecurityError(error)) warnOnce("sn_storage_security_set", "[Storage] localStorage set blocked", error)
            return false
        }
    },

    remove(key) {
        if (!this.available) return
        removeKey(key)
    },

    getJson(key) {
        const rawValue = this.get(key)
        if (!rawValue) return null
        try {
            return JSON.parse(rawValue)
        } catch {
            return null
        }
    },

    setJson(key, objectValue) {
        let rawValue = ""
        try {
            rawValue = JSON.stringify(objectValue)
        } catch {
            return false
        }
        return this.set(key, rawValue)
    }
}

function createSessionStorageAdapter() {
    const warnSessionOnce = (() => {
        const seen = new Set()
        return (key, ...args) => {
            if (seen.has(key)) return
            seen.add(key)
            console.warn(...args)
        }
    })()

    const adapter = {
        get(key) {
            try {
                if (typeof window === "undefined" || !window.sessionStorage) return null
                const value = window.sessionStorage.getItem(String(key))
                return typeof value === "string" ? value : null
            } catch (error) {
                if (isSecurityError(error)) warnSessionOnce("sn_session_security_get", "[Storage] sessionStorage get blocked", error)
                return null
            }
        },
        set(key, value) {
            try {
                if (typeof window === "undefined" || !window.sessionStorage) return false
                window.sessionStorage.setItem(String(key), String(value))
                return true
            } catch (error) {
                if (isQuotaError(error)) warnSessionOnce("sn_session_quota_set", "[Storage] sessionStorage quota exceeded", error)
                if (isSecurityError(error)) warnSessionOnce("sn_session_security_set", "[Storage] sessionStorage set blocked", error)
                return false
            }
        },
        remove(key) {
            try {
                if (typeof window === "undefined" || !window.sessionStorage) return false
                window.sessionStorage.removeItem(String(key))
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
            let rawValue = ""
            try {
                rawValue = JSON.stringify(value)
            } catch {
                return false
            }
            return this.set(key, rawValue)
        }
    }
    return adapter
}

if (typeof window !== "undefined") {
    window.safeStorage = safeStorage
    window.SafeStorage = {
        local: safeStorage,
        session: createSessionStorageAdapter()
    }
}
