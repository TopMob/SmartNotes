module.exports = async (request, response) => {
    if (request.method !== "GET") {
        response.status(405).json({ ok: false, error: "method-not-allowed" })
        return
    }
    const userId = typeof request.query?.uid === "string" ? request.query.uid.trim() : ""
    if (!userId) {
        response.status(400).json({ ok: false, error: "invalid-uid" })
        return
    }
    response.status(200).json({ ok: true, settings: null, customPresets: [] })
}
