import { firebaseConfig } from "./firebase.js"
import { requestGoogleAccessToken } from "./googleIdentityAuth.js"

const DRIVE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/drive.file"
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webContentLink"
const DRIVE_PERMISSION_ENDPOINT = "https://www.googleapis.com/drive/v3/files"
const INLINE_MEDIA_PATTERN = /^data:(image|audio)\//i
const INLINE_MEDIA_URL_PATTERN = /data:(image|audio)\//i
const ERROR_CODES = {
    OFFLINE: "external-storage-offline",
    UNLINKED: "external-storage-unlinked",
    UNAVAILABLE: "external-storage-unavailable",
    SAVE_FAILED: "external-attachment-save-failed",
    INLINE_MEDIA_BLOCKED: "external-inline-media-blocked"
}

const tokenState = {
    accessToken: "",
    expiresAt: 0,
    pendingPromise: null,
    lastErrorCode: ""
}

const uploadCache = new Map()

const getGoogleClientId = () => String(window.auth?.app?.options?.clientId || firebaseConfig.clientId || "").trim()

const normalizeDrivePublicUrl = (file) => {
    const fileId = typeof file === "string" ? file : String(file?.id || "").trim()
    const webContentLink = typeof file?.webContentLink === "string" ? file.webContentLink.trim() : ""
    if (String(file?.mimeType || "").toLowerCase().startsWith("image/") && fileId) {
        return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`
    }
    if (/^https:\/\//i.test(webContentLink)) return webContentLink
    if (!fileId) return ""
    return `https://drive.google.com/uc?id=${encodeURIComponent(fileId)}&export=download`
}

const sanitizeFileNamePart = (value, fallback) => {
    const normalizedValue = String(value || "").trim().toLowerCase()
    const safeValue = normalizedValue
        .replace(/[^\p{L}\p{N}_-]+/gu, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_+|_+$/g, "")
    return safeValue || fallback
}

const inferFileExtension = (mimeType) => {
    const normalizedMimeType = String(mimeType || "").toLowerCase()
    if (normalizedMimeType.includes("jpeg")) return "jpg"
    if (normalizedMimeType.includes("png")) return "png"
    if (normalizedMimeType.includes("webp")) return "webp"
    if (normalizedMimeType.includes("gif")) return "gif"
    if (normalizedMimeType.includes("mp3")) return "mp3"
    if (normalizedMimeType.includes("mpeg")) return "mp3"
    if (normalizedMimeType.includes("wav")) return "wav"
    if (normalizedMimeType.includes("ogg")) return "ogg"
    if (normalizedMimeType.includes("mp4")) return "mp4"
    return "bin"
}

const buildFileName = ({ fileNameBase = "attachment", mimeType = "" } = {}) => {
    const safeBase = sanitizeFileNamePart(fileNameBase, "attachment")
    return `${safeBase}.${inferFileExtension(mimeType)}`
}

const createExternalMediaError = (code, cause = null) => {
    const error = new Error(code)
    error.code = code
    if (cause) error.cause = cause
    return error
}

const isInlineMediaSource = (value) => INLINE_MEDIA_PATTERN.test(String(value || "").trim())

const containsInlineMedia = (value) => INLINE_MEDIA_URL_PATTERN.test(String(value || ""))

const buildBlobCacheKey = (blob) => {
    if (!blob || typeof blob !== "object") return ""
    const blobName = typeof blob.name === "string" ? blob.name : ""
    const blobType = typeof blob.type === "string" ? blob.type : ""
    const blobSize = Number.isFinite(blob.size) ? blob.size : 0
    const lastModified = Number.isFinite(blob.lastModified) ? blob.lastModified : 0
    return [blobName, blobType, blobSize, lastModified].join(":")
}

const dataUrlToBlob = (dataUrl) => {
    const source = String(dataUrl || "")
    const match = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/i)
    if (!match) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    const mimeType = String(match[1] || "application/octet-stream")
    const payload = source.slice(source.indexOf(",") + 1)
    const binary = atob(payload)
    const length = binary.length
    const bytes = new Uint8Array(length)
    for (let index = 0; index < length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
    }
    return new Blob([bytes], { type: mimeType })
}

const inferAuthorizationErrorCode = (error) => {
    const code = String(error?.code || "").toLowerCase()
    const message = String(error?.message || "").toLowerCase()
    if (code.includes("popup") || code.includes("cancel") || code.includes("denied") || message.includes("popup") || message.includes("cancel") || message.includes("denied") || message.includes("token") || message.includes("consent")) {
        return ERROR_CODES.UNLINKED
    }
    return ERROR_CODES.UNAVAILABLE
}

const normalizeExternalMediaErrorCode = (error) => {
    const rawCode = String(error?.code || error?.message || "")
    if (!rawCode) return ERROR_CODES.UNAVAILABLE
    if (Object.values(ERROR_CODES).includes(rawCode)) return rawCode
    if (rawCode === "drive-offline") return ERROR_CODES.OFFLINE
    if (rawCode === "drive-unavailable") return ERROR_CODES.UNLINKED
    if (rawCode.startsWith("drive-upload-failed") || rawCode.startsWith("drive-permission-failed") || rawCode === "drive-invalid-file" || rawCode === "drive-invalid-data-url") {
        return ERROR_CODES.SAVE_FAILED
    }
    return inferAuthorizationErrorCode(error)
}

const resolveUserFacingError = (error, options = {}) => {
    const code = normalizeExternalMediaErrorCode(error)
    if (code === ERROR_CODES.UNLINKED) {
        return options.attachmentOnly
            ? { code, messageKey: "external_attachment_unavailable", fallbackMessage: "Disk is not connected, attachment unavailable" }
            : { code, messageKey: "external_storage_unlinked", fallbackMessage: "External storage is not connected" }
    }
    if (code === ERROR_CODES.OFFLINE || code === ERROR_CODES.UNAVAILABLE) {
        return { code, messageKey: "external_storage_unavailable", fallbackMessage: "External disk is temporarily unavailable" }
    }
    return { code, messageKey: "external_attachment_save_failed", fallbackMessage: "Unable to save attachment to external disk" }
}

const createMultipartBody = (metadata, blob, boundary) => {
    const metadataPart = JSON.stringify(metadata)
    return new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n`,
        `--${boundary}\r\nContent-Type: ${blob.type || "application/octet-stream"}\r\n\r\n`,
        blob,
        `\r\n--${boundary}--`
    ], { type: `multipart/related; boundary=${boundary}` })
}

const getAccessToken = async (forceRefresh = false) => {
    if (!getGoogleClientId()) {
        tokenState.lastErrorCode = ERROR_CODES.UNLINKED
        throw createExternalMediaError(ERROR_CODES.UNLINKED)
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        tokenState.lastErrorCode = ERROR_CODES.OFFLINE
        throw createExternalMediaError(ERROR_CODES.OFFLINE)
    }
    const now = Date.now()
    if (!forceRefresh && tokenState.accessToken && tokenState.expiresAt - now > 60_000) {
        tokenState.lastErrorCode = ""
        return tokenState.accessToken
    }
    if (!forceRefresh) {
        tokenState.lastErrorCode = ERROR_CODES.UNLINKED
        throw createExternalMediaError(ERROR_CODES.UNLINKED)
    }
    if (tokenState.pendingPromise) return tokenState.pendingPromise
    tokenState.pendingPromise = (async () => {
        try {
            const tokenResponse = await requestGoogleAccessToken({
                clientId: getGoogleClientId(),
                scope: DRIVE_UPLOAD_SCOPE,
                prompt: tokenState.accessToken ? "" : "consent"
            })
            if (!tokenResponse?.accessToken) throw createExternalMediaError(ERROR_CODES.UNLINKED)
            tokenState.accessToken = tokenResponse.accessToken
            tokenState.expiresAt = Date.now() + (Math.max(1, Number(tokenResponse.expiresIn || 3600)) * 1000)
            tokenState.lastErrorCode = ""
            return tokenState.accessToken
        } catch (error) {
            const normalizedErrorCode = normalizeExternalMediaErrorCode(error)
            tokenState.expiresAt = 0
            tokenState.lastErrorCode = normalizedErrorCode
            throw createExternalMediaError(normalizedErrorCode, error)
        } finally {
            tokenState.pendingPromise = null
        }
    })()
    return tokenState.pendingPromise
}

const ensureDrivePermission = async (fileId, accessToken) => {
    const response = await fetch(`${DRIVE_PERMISSION_ENDPOINT}/${encodeURIComponent(fileId)}/permissions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type: "anyone",
            role: "reader"
        })
    })
    if (response.ok || response.status === 409) return
    throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
}

const uploadBlob = async (blob, options = {}, attempt = 0) => {
    const mimeType = String(options.mimeType || blob.type || "application/octet-stream")
    const fileName = String(options.fileName || buildFileName({ fileNameBase: options.fileNameBase, mimeType }))
    const accessToken = await getAccessToken(attempt > 0)
    const boundary = `smartnotes_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
    const response = await fetch(DRIVE_UPLOAD_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: createMultipartBody({ name: fileName, mimeType }, blob, boundary)
    })

    if (response.status === 401 && attempt === 0) {
        tokenState.expiresAt = 0
        return uploadBlob(blob, options, 1)
    }

    if (response.status === 401) {
        tokenState.lastErrorCode = ERROR_CODES.UNLINKED
        throw createExternalMediaError(ERROR_CODES.UNLINKED)
    }

    if (!response.ok) {
        tokenState.lastErrorCode = ERROR_CODES.SAVE_FAILED
        throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    }

    const file = await response.json()
    if (!file?.id) {
        tokenState.lastErrorCode = ERROR_CODES.SAVE_FAILED
        throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    }
    await ensureDrivePermission(file.id, accessToken)
    const publicUrl = normalizeDrivePublicUrl(file)
    if (!/^https:\/\//i.test(publicUrl)) {
        tokenState.lastErrorCode = ERROR_CODES.SAVE_FAILED
        throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    }
    return {
        ...file,
        publicUrl
    }
}

const uploadBlobCached = async (cacheKey, blob, options = {}) => {
    if (cacheKey && uploadCache.has(cacheKey)) return uploadCache.get(cacheKey)
    const uploadPromise = uploadBlob(blob, options)
    if (cacheKey) uploadCache.set(cacheKey, uploadPromise)
    try {
        return await uploadPromise
    } catch (error) {
        if (cacheKey) uploadCache.delete(cacheKey)
        throw error
    }
}

const uploadDataUrl = async (dataUrl, options = {}) => {
    const blob = dataUrlToBlob(dataUrl)
    const result = await uploadBlobCached(String(dataUrl || ""), blob, {
        fileNameBase: options.fileNameBase || "attachment",
        mimeType: blob.type
    })
    return result.publicUrl
}

const uploadFile = async (file, options = {}) => {
    if (!(file instanceof Blob)) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    const cacheKey = buildBlobCacheKey(file)
    const result = await uploadBlobCached(cacheKey, file, {
        fileName: options.fileName || "",
        fileNameBase: options.fileNameBase || String(file.name || "attachment"),
        mimeType: file.type || options.mimeType || "application/octet-stream"
    })
    return result.publicUrl
}

const stripInlineHtmlMedia = (html) => {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = String(html || "")
    Array.from(wrapper.querySelectorAll("img[src], audio[src], audio source[src]")).forEach(element => {
        const source = String(element.getAttribute("src") || "").trim()
        if (!isInlineMediaSource(source)) return
        const tagName = element.tagName.toLowerCase()
        if (tagName === "source") {
            const parent = element.parentElement
            element.remove()
            if (parent && parent.tagName.toLowerCase() === "audio" && !parent.querySelector("source[src], [src]")) {
                parent.remove()
            }
            return
        }
        element.remove()
    })
    return wrapper.innerHTML
}

const stripInlinePageDrawings = (pageDrawings) => (Array.isArray(pageDrawings) ? pageDrawings : []).map(source => isInlineMediaSource(source) ? "" : source)

const externalizeHtmlMedia = async (html, options = {}) => {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = String(html || "")
    const mediaElements = Array.from(wrapper.querySelectorAll("img[src], audio[src], audio source[src]"))
    let changed = false
    const failures = []
    const mode = options.mode === "best-effort" ? "best-effort" : "strict"

    for (let index = 0; index < mediaElements.length; index += 1) {
        const element = mediaElements[index]
        const source = String(element.getAttribute("src") || "").trim()
        if (!isInlineMediaSource(source)) continue
        const fileNameBase = `${options.fileNameBase || "attachment"}_${index + 1}`
        try {
            const publicUrl = await uploadDataUrl(source, { fileNameBase })
            element.setAttribute("src", publicUrl)
            if (element.tagName.toLowerCase() === "audio" && element instanceof HTMLMediaElement) {
                element.src = publicUrl
            }
            changed = true
        } catch (error) {
            failures.push({ type: "html", source, error, tagName: String(element.tagName || "").toLowerCase() })
            if (mode !== "best-effort") throw error
            if (element.tagName.toLowerCase() === "source") {
                const parent = element.parentElement
                element.remove()
                if (parent && parent.tagName.toLowerCase() === "audio" && !parent.querySelector("source[src], [src]")) {
                    parent.remove()
                }
            } else {
                element.remove()
            }
            changed = true
        }
    }

    let nextHtml = wrapper.innerHTML
    if (containsInlineMedia(nextHtml)) {
        if (mode === "best-effort") {
            nextHtml = stripInlineHtmlMedia(nextHtml)
            changed = true
        } else {
            throw createExternalMediaError(ERROR_CODES.INLINE_MEDIA_BLOCKED)
        }
    }

    return {
        html: nextHtml,
        changed,
        failures
    }
}

const externalizePageDrawings = async (pageDrawings, options = {}) => {
    const drawings = Array.isArray(pageDrawings) ? pageDrawings.slice() : []
    let changed = false
    const failures = []
    const mode = options.mode === "best-effort" ? "best-effort" : "strict"
    for (let index = 0; index < drawings.length; index += 1) {
        const source = String(drawings[index] || "").trim()
        if (!isInlineMediaSource(source)) continue
        try {
            drawings[index] = await uploadDataUrl(source, {
                fileNameBase: `${options.fileNameBase || "drawing"}_${index + 1}`
            })
            changed = true
        } catch (error) {
            failures.push({ type: "drawing", source, index, error })
            if (mode !== "best-effort") throw error
            drawings[index] = ""
            changed = true
        }
    }
    const hasInlineMedia = drawings.some(item => isInlineMediaSource(item))
    if (hasInlineMedia) {
        if (mode === "best-effort") {
            return { pageDrawings: stripInlinePageDrawings(drawings), changed: true, failures }
        }
        throw createExternalMediaError(ERROR_CODES.INLINE_MEDIA_BLOCKED)
    }
    return { pageDrawings: drawings, changed, failures }
}

const externalizeNoteMedia = async (note, options = {}) => {
    const normalizedNote = note && typeof note === "object" ? { ...note } : {}
    const htmlResult = await externalizeHtmlMedia(normalizedNote.content || "", {
        fileNameBase: options.fileNameBase || sanitizeFileNamePart(normalizedNote.title || normalizedNote.id || "note_media", "note_media"),
        mode: options.mode
    })
    const drawingsResult = await externalizePageDrawings(normalizedNote.pageDrawings || [], {
        fileNameBase: `${options.fileNameBase || sanitizeFileNamePart(normalizedNote.title || normalizedNote.id || "note_drawing", "note_drawing")}_drawing`,
        mode: options.mode
    })
    const nextNote = {
        ...normalizedNote,
        content: htmlResult.html,
        pageDrawings: drawingsResult.pageDrawings
    }
    if (getInlineMediaSummary(nextNote).hasInlineMedia) {
        if (options.mode === "best-effort") {
            return {
                note: {
                    ...nextNote,
                    content: stripInlineHtmlMedia(nextNote.content),
                    pageDrawings: stripInlinePageDrawings(nextNote.pageDrawings)
                },
                changed: true,
                failures: [...htmlResult.failures, ...drawingsResult.failures]
            }
        }
        throw createExternalMediaError(ERROR_CODES.INLINE_MEDIA_BLOCKED)
    }
    return {
        note: nextNote,
        changed: htmlResult.changed || drawingsResult.changed,
        failures: [...htmlResult.failures, ...drawingsResult.failures]
    }
}

const getInlineMediaSummary = (note) => {
    const normalizedNote = note && typeof note === "object" ? note : {}
    const content = String(normalizedNote.content || "")
    const pageDrawings = Array.isArray(normalizedNote.pageDrawings) ? normalizedNote.pageDrawings : []
    const htmlMatches = content.match(/data:(image|audio)\//gi) || []
    const drawingMatches = pageDrawings.filter(item => isInlineMediaSource(item))
    return {
        count: htmlMatches.length + drawingMatches.length,
        hasInlineMedia: containsInlineMedia(content) || drawingMatches.length > 0
    }
}

export const GoogleDriveMediaService = {
    providerId: "google-drive",
    connect: async () => {
        await getAccessToken(true)
        return GoogleDriveMediaService.getStatus()
    },
    uploadFile,
    uploadDataUrl,
    externalizeHtmlMedia,
    externalizePageDrawings,
    externalizeNoteMedia,
    normalizeDrivePublicUrl,
    containsInlineMedia,
    isInlineMediaSource,
    getInlineMediaSummary,
    normalizeExternalMediaErrorCode,
    resolveUserFacingError,
    getStatus() {
        const now = Date.now()
        return {
            providerId: "google-drive",
            configured: !!getGoogleClientId(),
            connected: !!tokenState.accessToken && tokenState.expiresAt - now > 60_000,
            pending: !!tokenState.pendingPromise,
            errorCode: tokenState.lastErrorCode || ""
        }
    }
}
