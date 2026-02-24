export const normalizeDateValue = (value) => {
    if (value === null || value === undefined || value === "") return 0
    if (typeof value?.toDate === "function") {
        const timestamp = value.toDate().getTime()
        return Number.isFinite(timestamp) ? timestamp : 0
    }
    if (value && typeof value === "object" && Number.isFinite(value.seconds)) {
        const timestamp = value.seconds * 1000
        return Number.isFinite(timestamp) ? timestamp : 0
    }
    if (value instanceof Date) {
        const timestamp = value.getTime()
        return Number.isFinite(timestamp) ? timestamp : 0
    }
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    const parsedTimestamp = Date.parse(String(value))
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0
}

export const buildNotePayload = ({ note, user, access } = {}) => {
    const ownerUid = access?.ownerUid || user?.uid || note?.ownerUid || ""
    const roleMap = access?.roles && typeof access.roles === "object" ? access.roles : {}
    const targetIdentifier = access?.noteId || note?.id || Utils.generateId()
    const normalizedNote = NoteIO.normalizeNote({ ...note, id: targetIdentifier, ownerUid })
    return {
        ...normalizedNote,
        ownerUid,
        access: {
            ownerUid,
            roles: {
                ...roleMap,
                [ownerUid]: "owner"
            }
        }
    }
}

export const buildNoteUpdatePayload = (updates = {}, options = {}) => {
    const payload = { ...updates }
    const shouldUpdateTimestamp = options.updateTimestamp !== false
    if (shouldUpdateTimestamp && payload.updatedAt === undefined) {
        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp()
    }
    return payload
}

window.NoteHelpers = {
    normalizeDateValue,
    buildNotePayload,
    buildNoteUpdatePayload
}
