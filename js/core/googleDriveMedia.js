const LOCAL_MEDIA_STORAGE_KEY = "smartnotes.localMedia.files.v1"

const readMediaStore = () => {
    try {
        const raw = localStorage.getItem(LOCAL_MEDIA_STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : {}
        return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
        return {}
    }
}

const writeMediaStore = store => {
    localStorage.setItem(LOCAL_MEDIA_STORAGE_KEY, JSON.stringify(store))
}

const createMediaId = () => `media_${Date.now()}_${Math.random().toString(16).slice(2)}`

const uploadDataUrl = async (dataUrl, options = {}) => {
    const id = createMediaId()
    const store = readMediaStore()
    const mimeType = String(options.mimeType || "application/octet-stream")
    store[id] = { id, dataUrl, mimeType, fileName: String(options.fileName || `${id}.bin`) }
    writeMediaStore(store)
    return { id, publicUrl: dataUrl, url: dataUrl, mimeType }
}

const uploadFile = async (file, options = {}) => {
    const sourceBlob = file instanceof Blob ? file : null
    if (!sourceBlob) throw new Error("unsupported_file_source")
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("file_read_failed"))
        reader.readAsDataURL(sourceBlob)
    })
    return uploadDataUrl(dataUrl, {
        ...options,
        mimeType: sourceBlob.type || options.mimeType || "application/octet-stream",
        fileName: sourceBlob.name || options.fileName || "attachment.bin"
    })
}

export const GoogleDriveMediaService = {
    providerId: "local-media",
    connect: async () => ({ linked: true, connected: true }),
    unlink: async () => ({ linked: false, connected: false }),
    handleSignedInUser: async () => ({ linked: true, connected: true }),
    handleSignedOutUser: () => {},
    uploadFile,
    uploadDataUrl,
    externalizeHtmlMedia: async html => ({ html, items: [] }),
    externalizePageDrawings: async pageDrawings => ({ pageDrawings, items: [] }),
    externalizeNoteMedia: async note => ({ note, items: [] }),
    containsInlineMedia: () => false,
    isInlineMediaSource: () => false,
    getInlineMediaSummary: () => ({ total: 0, images: 0, audio: 0, video: 0, files: 0 }),
    normalizeExternalMediaErrorCode: () => "",
    resolveUserFacingError: () => "",
    ERROR_CODES: {},
    createExternalMediaError: () => new Error("local_media_error"),
    normalizeDrivePublicUrl: value => String(value || ""),
    getStatus: () => ({ activeProviderId: "local-media", providerId: "local-media", configured: true, linked: true, connected: true, available: true, pending: false, errorCode: "" })
}
