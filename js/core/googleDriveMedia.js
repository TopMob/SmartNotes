import { firebaseConfig } from "./firebase.js"
import { requestGoogleAccessToken } from "./googleIdentityAuth.js"

const DRIVE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/drive.file"
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType"
const DRIVE_PERMISSION_ENDPOINT = "https://www.googleapis.com/drive/v3/files"
const INLINE_MEDIA_PATTERN = /^data:(image|audio)\//i
const INLINE_MEDIA_URL_PATTERN = /data:(image|audio)\//i

const tokenState = {
    accessToken: "",
    expiresAt: 0
}

const uploadCache = new Map()

const getGoogleClientId = () => String(window.auth?.app?.options?.clientId || firebaseConfig.clientId || "").trim()

const normalizeDrivePublicUrl = (fileId) => `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`

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

const isInlineMediaSource = (value) => INLINE_MEDIA_PATTERN.test(String(value || "").trim())

const containsInlineMedia = (value) => INLINE_MEDIA_URL_PATTERN.test(String(value || ""))

const dataUrlToBlob = (dataUrl) => {
    const source = String(dataUrl || "")
    const match = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/i)
    if (!match) throw new Error("drive-invalid-data-url")
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

const buildBlobCacheKey = (blob) => {
    if (!blob || typeof blob !== "object") return ""
    const blobName = typeof blob.name === "string" ? blob.name : ""
    const blobType = typeof blob.type === "string" ? blob.type : ""
    const blobSize = Number.isFinite(blob.size) ? blob.size : 0
    const lastModified = Number.isFinite(blob.lastModified) ? blob.lastModified : 0
    return [blobName, blobType, blobSize, lastModified].join(":")
}

const getAccessToken = async (forceRefresh = false) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("drive-offline")
    }
    const now = Date.now()
    if (!forceRefresh && tokenState.accessToken && tokenState.expiresAt - now > 60_000) {
        return tokenState.accessToken
    }
    const tokenResponse = await requestGoogleAccessToken({
        clientId: getGoogleClientId(),
        scope: DRIVE_UPLOAD_SCOPE,
        prompt: forceRefresh ? "consent" : (tokenState.accessToken ? "" : "consent")
    })
    tokenState.accessToken = tokenResponse.accessToken
    tokenState.expiresAt = now + (Math.max(1, Number(tokenResponse.expiresIn || 3600)) * 1000)
    return tokenState.accessToken
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
    throw new Error(`drive-permission-failed:${response.status}`)
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
        tokenState.accessToken = ""
        tokenState.expiresAt = 0
        return uploadBlob(blob, options, 1)
    }

    if (!response.ok) {
        throw new Error(`drive-upload-failed:${response.status}`)
    }

    const file = await response.json()
    await ensureDrivePermission(file.id, accessToken)
    return {
        ...file,
        publicUrl: normalizeDrivePublicUrl(file.id)
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
    if (!(file instanceof Blob)) throw new Error("drive-invalid-file")
    const cacheKey = buildBlobCacheKey(file)
    const result = await uploadBlobCached(cacheKey, file, {
        fileName: options.fileName || "",
        fileNameBase: options.fileNameBase || String(file.name || "attachment"),
        mimeType: file.type || options.mimeType || "application/octet-stream"
    })
    return result.publicUrl
}

const buildAttachmentPlaceholder = ({ kind = "attachment", index = 0, errorCode = "" } = {}) => {
    const safeKind = kind === "image" ? "image" : "attachment"
    const safeErrorCode = String(errorCode || "").trim()
    const message = safeErrorCode === "drive-offline"
        ? "Attachment upload skipped while offline"
        : "Attachment upload failed"
    return `<p data-media-upload-error="${safeKind}" data-media-upload-index="${index + 1}">${message}</p>`
}

const removeFailedMediaElement = (element, index, error) => {
    const tagName = String(element?.tagName || "").toLowerCase()
    const kind = tagName === "img" ? "image" : "attachment"
    const placeholder = document.createElement("div")
    placeholder.innerHTML = buildAttachmentPlaceholder({ kind, index, errorCode: error?.message || "" })
    const replacementNode = placeholder.firstElementChild
    if (replacementNode) {
        if (tagName === "source") {
            const parent = element.parentElement
            element.remove()
            if (parent && parent.tagName.toLowerCase() === "audio" && !parent.querySelector("source[src], [src]")) {
                parent.replaceWith(replacementNode)
            }
            return
        }
        element.replaceWith(replacementNode)
        return
    }
    element.remove()
}

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
            removeFailedMediaElement(element, index, error)
            changed = true
        }
    }

    return {
        html: wrapper.innerHTML,
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
    return {
        note: {
            ...normalizedNote,
            content: htmlResult.html,
            pageDrawings: drawingsResult.pageDrawings
        },
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
    uploadFile,
    uploadDataUrl,
    externalizeHtmlMedia,
    externalizePageDrawings,
    externalizeNoteMedia,
    normalizeDrivePublicUrl,
    containsInlineMedia,
    isInlineMediaSource,
    getInlineMediaSummary
}
