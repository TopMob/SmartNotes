const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : null)

module.exports = async (request, response) => {
    if (request.method !== "POST") {
        response.status(405).json({ ok: false, error: "method-not-allowed" })
        return
    }
    const payload = asObject(request.body)
    if (!payload) {
        response.status(400).json({ ok: false, error: "invalid-body" })
        return
    }
    const userId = typeof payload.uid === "string" ? payload.uid.trim() : ""
    const settings = asObject(payload.settings)
    const customPresets = Array.isArray(payload.customPresets) ? payload.customPresets : null
    if (!userId || !settings || !customPresets) {
        response.status(400).json({ ok: false, error: "invalid-payload" })
        return
    }
    response.status(200).json({ ok: true })
}
