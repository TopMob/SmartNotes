const DEFAULT_BACKEND_BASE_URL = ""

const normalizeBaseUrl = value => {
    const normalized = String(value || "").trim()
    if (!normalized) return DEFAULT_BACKEND_BASE_URL
    return normalized.replace(/\/+$/g, "")
}

const resolveBackendBaseUrl = (overrides = {}) => {
    const explicit = overrides.backendBaseUrl
    if (explicit) return normalizeBaseUrl(explicit)
    if (typeof window !== "undefined") {
        const fromConfig = window.__SMARTNOTES_BACKEND_URL__
        if (fromConfig) return normalizeBaseUrl(fromConfig)
        const fromStorage = window.localStorage?.getItem?.("smartnotes.backendBaseUrl")
        if (fromStorage) return normalizeBaseUrl(fromStorage)
    }
    return DEFAULT_BACKEND_BASE_URL
}

const createApiEndpoint = (path, overrides = {}) => {
    const baseUrl = resolveBackendBaseUrl(overrides)
    const normalizedPath = String(path || "").replace(/^\/+/, "")
    return baseUrl ? `${baseUrl}/api/${normalizedPath}` : `/api/${normalizedPath}`
}

const backendConfigApi = {
    DEFAULT_BACKEND_BASE_URL,
    normalizeBaseUrl,
    resolveBackendBaseUrl,
    createApiEndpoint
}

if (typeof window !== "undefined") {
    window.SmartNotesBackendConfig = backendConfigApi
}

export { DEFAULT_BACKEND_BASE_URL, normalizeBaseUrl, resolveBackendBaseUrl, createApiEndpoint }
