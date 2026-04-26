const DEFAULT_BACKEND_BASE_URL = ""

const normalizeBaseUrl = value => {
    const normalized = String(value || "").trim()
    if (!normalized) return DEFAULT_BACKEND_BASE_URL
    return normalized.replace(/\/+$/g, "")
}

const resolveBackendBaseUrl = (overrides = {}) => {
    if (typeof window !== "undefined" && window.location?.hostname === "smartnotess.vercel.app") {
        return ""
    }
    const explicit = overrides.backendBaseUrl
    if (explicit) return normalizeBaseUrl(explicit)
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
