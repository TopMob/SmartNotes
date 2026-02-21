const parseJsonResponse = async (response) => {
    try {
        return await response.json()
    } catch {
        return null
    }
}

const resolveErrorMessage = (fallbackMessage, responseBody) => {
    if (responseBody && typeof responseBody.error === "string" && responseBody.error.trim()) {
        return responseBody.error.trim()
    }
    if (responseBody && typeof responseBody.message === "string" && responseBody.message.trim()) {
        return responseBody.message.trim()
    }
    return fallbackMessage
}

export const postJson = async (url, body) => {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body || {})
        })
        const responseBody = await parseJsonResponse(response)
        if (!response.ok) {
            return { ok: false, error: resolveErrorMessage(`HTTP ${response.status}`, responseBody) }
        }
        return { ok: true, data: responseBody }
    } catch (error) {
        return { ok: false, error: error?.message || "network-error" }
    }
}

export const getJson = async (url) => {
    try {
        const response = await fetch(url, { method: "GET" })
        const responseBody = await parseJsonResponse(response)
        if (!response.ok) {
            return { ok: false, error: resolveErrorMessage(`HTTP ${response.status}`, responseBody) }
        }
        return { ok: true, data: responseBody }
    } catch (error) {
        return { ok: false, error: error?.message || "network-error" }
    }
}
