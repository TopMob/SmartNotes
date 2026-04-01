const GlobalApi = (() => {
    const ensureRoot = () => {
        if (!window.SmartNotes || typeof window.SmartNotes !== "object") {
            window.SmartNotes = {}
        }
        if (!window.SmartNotes.modules || typeof window.SmartNotes.modules !== "object") {
            window.SmartNotes.modules = {}
        }
        return window.SmartNotes
    }

    const setByPath = (target, path, value) => {
        const normalizedPath = String(path || "").split(".").filter(Boolean)
        if (!normalizedPath.length) return value
        let cursor = target
        for (let index = 0; index < normalizedPath.length - 1; index += 1) {
            const segment = normalizedPath[index]
            if (!cursor[segment] || typeof cursor[segment] !== "object") {
                cursor[segment] = {}
            }
            cursor = cursor[segment]
        }
        cursor[normalizedPath[normalizedPath.length - 1]] = value
        return value
    }

    const getByPath = (target, path) => {
        const normalizedPath = String(path || "").split(".").filter(Boolean)
        if (!normalizedPath.length) return undefined
        let cursor = target
        for (const segment of normalizedPath) {
            if (!cursor || typeof cursor !== "object" || !(segment in cursor)) {
                return undefined
            }
            cursor = cursor[segment]
        }
        return cursor
    }

    const bindLegacyGlobal = (legacyName, path) => {
        if (!legacyName) return
        Object.defineProperty(window, legacyName, {
            configurable: true,
            enumerable: false,
            get() {
                return getByPath(ensureRoot(), path)
            },
            set(value) {
                setByPath(ensureRoot(), path, value)
            }
        })
    }

    const publish = ({ path, value, legacyName = "" } = {}) => {
        if (!path) return value
        setByPath(ensureRoot(), path, value)
        bindLegacyGlobal(legacyName, path)
        return value
    }

    const read = (path) => getByPath(ensureRoot(), path)

    return { publish, read, ensureRoot }
})()

window.GlobalApi = GlobalApi
