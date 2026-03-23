import { firebaseConfig } from "./firebase.js"
import { requestGoogleAccessToken } from "./googleIdentityAuth.js"

const DRIVE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/drive.file"
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webContentLink"
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files"
const DRIVE_PERMISSION_ENDPOINT = DRIVE_FILES_ENDPOINT
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
const DRIVE_APP_FOLDER_NAME = "SmartNotes"
const DRIVE_ATTACHMENTS_FOLDER_NAME = "Attachments"
const DRIVE_BACKUPS_FOLDER_NAME = "Backups"
const DRIVE_STATE_STORAGE_KEY = "google-drive-state"
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
    lastErrorCode: "",
    currentUserKey: "",
    granted: false,
    folders: {
        rootId: "",
        attachmentsId: "",
        backupsId: ""
    },
    interactivePromptedForUser: ""
}

const uploadCache = new Map()

const getGoogleClientId = () => String(window.auth?.app?.options?.clientId || firebaseConfig.clientId || "").trim()
const getCurrentUser = () => window.auth?.currentUser || (typeof StateStore !== "undefined" && typeof StateStore.read === "function" ? StateStore.read().user : null) || null
const getCurrentUserKey = (user = getCurrentUser()) => String(user?.uid || user?.email || "").trim()

const readStoredDriveState = (userKey = getCurrentUserKey()) => {
    const normalizedUserKey = String(userKey || "").trim()
    if (!normalizedUserKey || !window.SafeStorage?.local?.getJson) return null
    const allStates = window.SafeStorage.local.getJson(DRIVE_STATE_STORAGE_KEY, {}) || {}
    const storedState = allStates[normalizedUserKey]
    return storedState && typeof storedState === "object" ? storedState : null
}

const writeStoredDriveState = (nextState, userKey = getCurrentUserKey()) => {
    const normalizedUserKey = String(userKey || "").trim()
    if (!normalizedUserKey || !window.SafeStorage?.local?.getJson || !window.SafeStorage?.local?.setJson) return
    const allStates = window.SafeStorage.local.getJson(DRIVE_STATE_STORAGE_KEY, {}) || {}
    if (!nextState) {
        delete allStates[normalizedUserKey]
        window.SafeStorage.local.setJson(DRIVE_STATE_STORAGE_KEY, allStates)
        return
    }
    allStates[normalizedUserKey] = nextState
    window.SafeStorage.local.setJson(DRIVE_STATE_STORAGE_KEY, allStates)
}

const applyStoredDriveState = (userKey = getCurrentUserKey()) => {
    const normalizedUserKey = String(userKey || "").trim()
    if (!normalizedUserKey) {
        tokenState.currentUserKey = ""
        tokenState.granted = false
        tokenState.folders = { rootId: "", attachmentsId: "", backupsId: "" }
        return null
    }
    if (tokenState.currentUserKey === normalizedUserKey) return readStoredDriveState(normalizedUserKey)
    tokenState.currentUserKey = normalizedUserKey
    const storedState = readStoredDriveState(normalizedUserKey)
    tokenState.granted = !!storedState?.granted
    tokenState.folders = {
        rootId: String(storedState?.rootId || ""),
        attachmentsId: String(storedState?.attachmentsId || ""),
        backupsId: String(storedState?.backupsId || "")
    }
    return storedState
}

const persistDriveState = (updates = {}, userKey = getCurrentUserKey()) => {
    const normalizedUserKey = String(userKey || "").trim()
    if (!normalizedUserKey) return
    const previousState = readStoredDriveState(normalizedUserKey) || {}
    const nextState = {
        granted: !!updates.granted,
        linkedAt: Number(updates.linkedAt || previousState.linkedAt || Date.now()),
        rootId: String(updates.rootId || ""),
        attachmentsId: String(updates.attachmentsId || ""),
        backupsId: String(updates.backupsId || "")
    }
    tokenState.currentUserKey = normalizedUserKey
    tokenState.granted = nextState.granted
    tokenState.folders = {
        rootId: nextState.rootId,
        attachmentsId: nextState.attachmentsId,
        backupsId: nextState.backupsId
    }
    writeStoredDriveState(nextState, normalizedUserKey)
}

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

const escapeDriveQueryValue = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'")

const authorizedDriveRequest = async (accessToken, url, options = {}) => {
    const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {})
        },
        body: options.body
    })
    if (response.status === 401) {
        tokenState.expiresAt = 0
        tokenState.lastErrorCode = ERROR_CODES.UNLINKED
        throw createExternalMediaError(ERROR_CODES.UNLINKED)
    }
    if (!response.ok) {
        tokenState.lastErrorCode = ERROR_CODES.SAVE_FAILED
        throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    }
    return response
}

const findDriveFolder = async (name, parentId, accessToken) => {
    const normalizedName = String(name || "").trim()
    if (!normalizedName) return null
    const parentClause = parentId ? `'${escapeDriveQueryValue(parentId)}' in parents` : "'root' in parents"
    const query = [
        `mimeType='${DRIVE_FOLDER_MIME_TYPE}'`,
        "trashed=false",
        `name='${escapeDriveQueryValue(normalizedName)}'`,
        parentClause
    ].join(" and ")
    const response = await authorizedDriveRequest(accessToken, `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&spaces=drive&pageSize=1&fields=files(id,name,parents)`)
    const payload = await response.json()
    const folder = Array.isArray(payload?.files) ? payload.files[0] : null
    return folder?.id ? { id: String(folder.id), name: String(folder.name || normalizedName) } : null
}

const createDriveFolder = async (name, parentId, accessToken) => {
    const normalizedName = String(name || "").trim()
    if (!normalizedName) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    const payload = { name: normalizedName, mimeType: DRIVE_FOLDER_MIME_TYPE }
    if (parentId) payload.parents = [parentId]
    const response = await authorizedDriveRequest(accessToken, `${DRIVE_FILES_ENDPOINT}?fields=id,name,parents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    const folder = await response.json()
    if (!folder?.id) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    return { id: String(folder.id), name: normalizedName }
}

const ensureDriveFolders = async (accessToken, options = {}) => {
    const userKey = String(options.userKey || getCurrentUserKey()).trim()
    const storedState = applyStoredDriveState(userKey) || {}
    let rootId = String(options.rootId || tokenState.folders.rootId || storedState.rootId || "")
    let attachmentsId = String(options.attachmentsId || tokenState.folders.attachmentsId || storedState.attachmentsId || "")
    let backupsId = String(options.backupsId || tokenState.folders.backupsId || storedState.backupsId || "")

    if (!rootId) {
        rootId = String((await findDriveFolder(DRIVE_APP_FOLDER_NAME, "", accessToken))?.id || "")
        if (!rootId) rootId = String((await createDriveFolder(DRIVE_APP_FOLDER_NAME, "", accessToken))?.id || "")
    }
    if (!attachmentsId) {
        attachmentsId = String((await findDriveFolder(DRIVE_ATTACHMENTS_FOLDER_NAME, rootId, accessToken))?.id || "")
        if (!attachmentsId) attachmentsId = String((await createDriveFolder(DRIVE_ATTACHMENTS_FOLDER_NAME, rootId, accessToken))?.id || "")
    }
    if (!backupsId) {
        backupsId = String((await findDriveFolder(DRIVE_BACKUPS_FOLDER_NAME, rootId, accessToken))?.id || "")
        if (!backupsId) backupsId = String((await createDriveFolder(DRIVE_BACKUPS_FOLDER_NAME, rootId, accessToken))?.id || "")
    }

    persistDriveState({ granted: true, linkedAt: Date.now(), rootId, attachmentsId, backupsId }, userKey)
    return { rootId, attachmentsId, backupsId }
}

const getAccessToken = async (forceRefresh = false, options = {}) => {
    const interactive = options.interactive === true
    const userKey = String(options.userKey || getCurrentUserKey()).trim()
    applyStoredDriveState(userKey)
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
    if (!forceRefresh && tokenState.granted) {
        await connectDrive({ interactive: false, userKey })
        if (tokenState.accessToken && tokenState.expiresAt - Date.now() > 60_000) return tokenState.accessToken
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
                prompt: interactive ? (tokenState.granted ? "" : "consent") : ""
            })
            if (!tokenResponse?.accessToken) throw createExternalMediaError(ERROR_CODES.UNLINKED)
            tokenState.accessToken = tokenResponse.accessToken
            tokenState.expiresAt = Date.now() + (Math.max(1, Number(tokenResponse.expiresIn || 3600)) * 1000)
            tokenState.lastErrorCode = ""
            if (userKey) {
                const folders = await ensureDriveFolders(tokenState.accessToken, { userKey })
                persistDriveState({ granted: true, linkedAt: Date.now(), ...folders }, userKey)
            }
            return tokenState.accessToken
        } catch (error) {
            const normalizedErrorCode = normalizeExternalMediaErrorCode(error)
            tokenState.accessToken = ""
            tokenState.expiresAt = 0
            tokenState.lastErrorCode = normalizedErrorCode
            if (normalizedErrorCode === ERROR_CODES.UNLINKED) {
                tokenState.granted = false
                if (userKey) writeStoredDriveState(null, userKey)
            }
            throw createExternalMediaError(normalizedErrorCode, error)
        } finally {
            tokenState.pendingPromise = null
        }
    })()
    return tokenState.pendingPromise
}

const connectDrive = async (options = {}) => {
    const userKey = String(options.userKey || getCurrentUserKey()).trim()
    await getAccessToken(true, { interactive: options.interactive !== false, userKey })
    return GoogleDriveMediaService.getStatus()
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
    const accessToken = await getAccessToken(attempt > 0, { interactive: false })
    const folders = await ensureDriveFolders(accessToken)
    const boundary = `smartnotes_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
    const metadata = { name: fileName, mimeType }
    if (folders.attachmentsId) metadata.parents = [folders.attachmentsId]
    const response = await fetch(DRIVE_UPLOAD_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: createMultipartBody(metadata, blob, boundary)
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
    connect: async () => connectDrive({ interactive: true }),
    handleSignedInUser: async (user, options = {}) => {
        const userKey = getCurrentUserKey(user)
        const storedState = applyStoredDriveState(userKey)
        const isGoogleUser = !!user?.providerData?.some?.(provider => String(provider?.providerId || "") === "google.com")
        if (storedState?.granted) {
            try {
                await connectDrive({ interactive: false, userKey })
                return GoogleDriveMediaService.getStatus()
            } catch (error) {
                const errorCode = normalizeExternalMediaErrorCode(error)
                if (!options.interactiveAllowed || !isGoogleUser || tokenState.interactivePromptedForUser === userKey || errorCode !== ERROR_CODES.UNLINKED) {
                    throw error
                }
            }
        }
        if (!options.interactiveAllowed || !isGoogleUser || tokenState.interactivePromptedForUser === userKey) {
            return GoogleDriveMediaService.getStatus()
        }
        tokenState.interactivePromptedForUser = userKey
        await connectDrive({ interactive: true, userKey })
        return GoogleDriveMediaService.getStatus()
    },
    handleSignedOutUser() {
        tokenState.accessToken = ""
        tokenState.expiresAt = 0
        tokenState.pendingPromise = null
        tokenState.lastErrorCode = ""
        tokenState.currentUserKey = ""
        tokenState.granted = false
        tokenState.folders = { rootId: "", attachmentsId: "", backupsId: "" }
        tokenState.interactivePromptedForUser = ""
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
        applyStoredDriveState()
        const now = Date.now()
        return {
            providerId: "google-drive",
            configured: !!getGoogleClientId(),
            linked: !!tokenState.granted,
            connected: !!tokenState.accessToken && tokenState.expiresAt - now > 60_000,
            pending: !!tokenState.pendingPromise,
            errorCode: tokenState.lastErrorCode || "",
            rootId: tokenState.folders.rootId || "",
            attachmentsId: tokenState.folders.attachmentsId || "",
            backupsId: tokenState.folders.backupsId || ""
        }
    }
}
