export const normalizeDateValue = (value) => {
    if (value === null || value === undefined || value === "") return 0
    if (value instanceof Date) {
        const timestamp = value.getTime()
        return Number.isFinite(timestamp) ? timestamp : 0
    }
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    const parsedTimestamp = Date.parse(String(value))
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0
}

export const buildNotePayload = ({ note, user } = {}) => {
    const ownerUid = user?.uid || note?.ownerUid || ""
    const targetIdentifier = note?.id || Utils.generateId()
    const normalizedNote = NoteIO.normalizeNote({ ...note, id: targetIdentifier, ownerUid })
    return {
        ...normalizedNote,
        ownerUid
    }
}

export const buildNoteUpdatePayload = (updates = {}, options = {}) => {
    const payload = { ...updates }
    const shouldUpdateTimestamp = options.updateTimestamp !== false
    if (shouldUpdateTimestamp && payload.updatedAt === undefined) {
        payload.updatedAt = Date.now()
    }
    return payload
}

window.NoteHelpers = {
    normalizeDateValue,
    buildNotePayload,
    buildNoteUpdatePayload
}

