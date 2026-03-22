const EXPORTABLE_NOTE_FIELDS = [
    "id",
    "title",
    "content",
    "tags",
    "pageTitles",
    "pageDrawings",
    "pageDrawingsRevision",
    "folderId",
    "folderOrder",
    "isArchived",
    "isFavorite",
    "isPinned",
    "lock",
    "reminderAt",
    "trashedAt",
    "contentType",
    "aiFolder",
    "hiddenTags",
    "aiTags",
    "relevance",
    "aiRelevance",
    "aiProcessed",
    "aiVersion",
    "aiLastAnalyzed",
    "order",
    "createdAt",
    "updatedAt",
    "ownerUid",
    "access"
]

const EXPORTABLE_FOLDER_FIELDS = [
    "id",
    "name",
    "description",
    "folderOrder",
    "isHidden",
    "trashedAt",
    "createdAt",
    "updatedAt",
    "ownerUid"
]

const serializeExportDate = (value) => {
    if (value === null || value === undefined || value === "") return null
    if (typeof value?.toDate === "function") {
        const dateValue = value.toDate()
        return Number.isFinite(dateValue?.getTime?.()) ? dateValue.toISOString() : null
    }
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value.toISOString() : null
    }
    if (value && typeof value === "object" && Number.isFinite(value.seconds)) {
        return new Date(value.seconds * 1000).toISOString()
    }
    if (typeof value === "number") {
        const dateValue = new Date(value)
        return Number.isFinite(dateValue.getTime()) ? dateValue.toISOString() : null
    }
    if (typeof value === "string") {
        const dateValue = new Date(value)
        return Number.isFinite(dateValue.getTime()) ? dateValue.toISOString() : value
    }
    return null
}

const sanitizeExportFileName = (value, fallback = "notes_export") => {
    const normalizedValue = String(value || "").trim().toLowerCase()
    const safeValue = normalizedValue
        .replace(/[^\p{L}\p{N}_-]+/gu, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_+|_+$/g, "")
    return safeValue || fallback
}

const serializeNoteForExport = (note) => {
    const normalizedNote = NoteIO.normalizeNote(note)
    const exportedNote = {}
    EXPORTABLE_NOTE_FIELDS.forEach(fieldName => {
        const fieldValue = normalizedNote[fieldName]
        if (["createdAt", "updatedAt", "reminderAt", "trashedAt", "aiLastAnalyzed"].includes(fieldName)) {
            exportedNote[fieldName] = serializeExportDate(fieldValue)
            return
        }
        if (Array.isArray(fieldValue)) {
            exportedNote[fieldName] = fieldValue.map(item => item && typeof item === "object" ? JSON.parse(JSON.stringify(item)) : item)
            return
        }
        if (fieldValue && typeof fieldValue === "object") {
            exportedNote[fieldName] = JSON.parse(JSON.stringify(fieldValue))
            return
        }
        exportedNote[fieldName] = fieldValue
    })
    return exportedNote
}

const serializeFolderForExport = (folder) => {
    const safeFolder = folder && typeof folder === "object" ? folder : {}
    const exportedFolder = {}
    EXPORTABLE_FOLDER_FIELDS.forEach(fieldName => {
        const fieldValue = safeFolder[fieldName]
        if (["createdAt", "updatedAt", "trashedAt"].includes(fieldName)) {
            exportedFolder[fieldName] = serializeExportDate(fieldValue)
            return
        }
        exportedFolder[fieldName] = fieldValue
    })
    return exportedFolder
}

const buildExportPayload = ({ notes, folders = [], scope = "all", folder = null } = {}) => {
    const exportedNotes = Array.isArray(notes) ? notes.map(serializeNoteForExport) : []
    const exportedFolders = Array.isArray(folders) ? folders.map(serializeFolderForExport) : []
    return {
        version: 4,
        app: "SmartNotes",
        exportedAt: new Date().toISOString(),
        scope,
        folder: folder && typeof folder === "object"
            ? {
                id: String(folder.id || ""),
                name: String(folder.name || ""),
                description: String(folder.description || "")
            }
            : null,
        folders: exportedFolders,
        notes: exportedNotes
    }
}

const buildExportFileName = ({ scope = "all", folderName = "" } = {}) => {
    const dateStamp = new Date().toISOString().slice(0, 10)
    if (scope === "folder") {
        return `smartnotes_folder_${sanitizeExportFileName(folderName, "folder")}_${dateStamp}.json`
    }
    return `smartnotes_all_notes_${dateStamp}.json`
}

const downloadExportPayload = (payload, options = {}) => {
    const fileName = buildExportFileName(options)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" })
    const link = document.createElement("a")
    const objectUrl = URL.createObjectURL(blob)
    link.href = objectUrl
    link.download = fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    return fileName
}

window.NoteExportService = {
    buildExportPayload,
    buildExportFileName,
    downloadExportPayload,
    sanitizeExportFileName,
    serializeNoteForExport,
    serializeFolderForExport,
    serializeExportDate
}
