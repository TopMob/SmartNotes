import { ERROR_CODES, createExternalMediaError } from './errors.js'

export const INLINE_MEDIA_PATTERN = /^data:(image|audio)\//i
export const INLINE_MEDIA_URL_PATTERN = /data:(image|audio)\//i

export const isInlineMediaSource = (value) => INLINE_MEDIA_PATTERN.test(String(value || '').trim())
export const containsInlineMedia = (value) => INLINE_MEDIA_URL_PATTERN.test(String(value || ''))

export const getInlineMediaSummary = (note) => {
    const normalizedNote = note && typeof note === 'object' ? note : {}
    const content = String(normalizedNote.content || '')
    const pageDrawings = Array.isArray(normalizedNote.pageDrawings) ? normalizedNote.pageDrawings : []
    const htmlMatches = content.match(/data:(image|audio)\//gi) || []
    const drawingMatches = pageDrawings.filter(item => isInlineMediaSource(item))
    return {
        count: htmlMatches.length + drawingMatches.length,
        hasInlineMedia: containsInlineMedia(content) || drawingMatches.length > 0
    }
}

const stripInlineHtmlMedia = (html) => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = String(html || '')
    Array.from(wrapper.querySelectorAll('img[src], audio[src], audio source[src]')).forEach(element => {
        const source = String(element.getAttribute('src') || '').trim()
        if (!isInlineMediaSource(source)) return
        if (element.tagName.toLowerCase() === 'source') {
            const parent = element.parentElement
            element.remove()
            if (parent && parent.tagName.toLowerCase() === 'audio' && !parent.querySelector('source[src], [src]')) parent.remove()
            return
        }
        element.remove()
    })
    return wrapper.innerHTML
}

const stripInlinePageDrawings = (pageDrawings) => (Array.isArray(pageDrawings) ? pageDrawings : []).map(source => isInlineMediaSource(source) ? '' : source)

export const createExternalMediaPipeline = ({ uploadDataUrl, sanitizeFileNamePart }) => {
    const externalizeHtmlMedia = async (html, options = {}) => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = String(html || '')
        const mediaElements = Array.from(wrapper.querySelectorAll('img[src], audio[src], audio source[src]'))
        let changed = false
        const failures = []
        const mode = options.mode === 'best-effort' ? 'best-effort' : 'strict'

        for (let index = 0; index < mediaElements.length; index += 1) {
            const element = mediaElements[index]
            const source = String(element.getAttribute('src') || '').trim()
            if (!isInlineMediaSource(source)) continue
            const fileNameBase = `${options.fileNameBase || 'attachment'}_${index + 1}`
            try {
                const publicUrl = await uploadDataUrl(source, { fileNameBase })
                element.setAttribute('src', publicUrl)
                if (element.tagName.toLowerCase() === 'audio' && element instanceof HTMLMediaElement) {
                    element.src = publicUrl
                }
                changed = true
            } catch (error) {
                failures.push({ type: 'html', source, error, tagName: String(element.tagName || '').toLowerCase() })
                if (mode !== 'best-effort') throw error
                if (element.tagName.toLowerCase() === 'source') {
                    const parent = element.parentElement
                    element.remove()
                    if (parent && parent.tagName.toLowerCase() === 'audio' && !parent.querySelector('source[src], [src]')) parent.remove()
                } else {
                    element.remove()
                }
                changed = true
            }
        }

        let nextHtml = wrapper.innerHTML
        if (containsInlineMedia(nextHtml)) {
            if (mode === 'best-effort') {
                nextHtml = stripInlineHtmlMedia(nextHtml)
                changed = true
            } else {
                throw createExternalMediaError(ERROR_CODES.INLINE_MEDIA_BLOCKED)
            }
        }

        return { html: nextHtml, changed, failures }
    }

    const externalizePageDrawings = async (pageDrawings, options = {}) => {
        const drawings = Array.isArray(pageDrawings) ? pageDrawings.slice() : []
        let changed = false
        const failures = []
        const mode = options.mode === 'best-effort' ? 'best-effort' : 'strict'
        for (let index = 0; index < drawings.length; index += 1) {
            const source = String(drawings[index] || '').trim()
            if (!isInlineMediaSource(source)) continue
            try {
                drawings[index] = await uploadDataUrl(source, {
                    fileNameBase: `${options.fileNameBase || 'drawing'}_${index + 1}`
                })
                changed = true
            } catch (error) {
                failures.push({ type: 'drawing', source, index, error })
                if (mode !== 'best-effort') throw error
                drawings[index] = ''
                changed = true
            }
        }
        const hasInlineMedia = drawings.some(item => isInlineMediaSource(item))
        if (hasInlineMedia) {
            if (mode === 'best-effort') return { pageDrawings: stripInlinePageDrawings(drawings), changed: true, failures }
            throw createExternalMediaError(ERROR_CODES.INLINE_MEDIA_BLOCKED)
        }
        return { pageDrawings: drawings, changed, failures }
    }

    const externalizeNoteMedia = async (note, options = {}) => {
        const normalizedNote = note && typeof note === 'object' ? { ...note } : {}
        const htmlResult = await externalizeHtmlMedia(normalizedNote.content || '', {
            fileNameBase: options.fileNameBase || sanitizeFileNamePart(normalizedNote.title || normalizedNote.id || 'note_media', 'note_media'),
            mode: options.mode
        })
        const drawingsResult = await externalizePageDrawings(normalizedNote.pageDrawings || [], {
            fileNameBase: `${options.fileNameBase || sanitizeFileNamePart(normalizedNote.title || normalizedNote.id || 'note_drawing', 'note_drawing')}_drawing`,
            mode: options.mode
        })
        const nextNote = {
            ...normalizedNote,
            content: htmlResult.html,
            pageDrawings: drawingsResult.pageDrawings
        }
        if (getInlineMediaSummary(nextNote).hasInlineMedia) {
            if (options.mode === 'best-effort') {
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

    return {
        externalizeHtmlMedia,
        externalizePageDrawings,
        externalizeNoteMedia
    }
}

import { containsInlineMedia, createExternalMediaPipeline, getInlineMediaSummary, isInlineMediaSource } from './mediaPipeline.js'
import { normalizeExternalMediaErrorCode, resolveUserFacingError } from './errors.js'

export const createExternalStorageService = ({ providers = [], defaultProviderId = '' } = {}) => {
    const providerMap = new Map((Array.isArray(providers) ? providers : []).map(provider => [provider.providerId, provider]))
    const fallbackProviderId = defaultProviderId || providerMap.keys().next().value || ''
    const providerSelectionStorageKey = 'external-storage-provider'
    const pipelineByProvider = new Map()

    const getSelectedProviderId = () => {
        const persistedProviderId = window.SafeStorage?.local?.get?.(providerSelectionStorageKey) || ''
        return providerMap.has(persistedProviderId) ? persistedProviderId : fallbackProviderId
    }

    const getProvider = (providerId = getSelectedProviderId()) => providerMap.get(providerId) || providerMap.get(fallbackProviderId) || null

    const getPipeline = (providerId = getSelectedProviderId()) => {
        if (pipelineByProvider.has(providerId)) return pipelineByProvider.get(providerId)
        const provider = getProvider(providerId)
        const pipeline = createExternalMediaPipeline({
            uploadDataUrl: (dataUrl, options = {}) => provider.uploadDataUrl(dataUrl, options),
            sanitizeFileNamePart: (value, fallback) => provider.sanitizeFileNamePart(value, fallback)
        })
        pipelineByProvider.set(providerId, pipeline)
        return pipeline
    }

    const service = {
        providerId: getSelectedProviderId(),
        getProvider,
        setProvider(providerId) {
            if (!providerMap.has(providerId)) return service.getStatus()
            window.SafeStorage?.local?.set?.(providerSelectionStorageKey, providerId)
            service.providerId = providerId
            return service.getStatus()
        },
        connect(options = {}) {
            return getProvider().connect(options)
        },
        unlink(options = {}) {
            return getProvider().unlink(options)
        },
        handleSignedInUser(user, options = {}) {
            return getProvider().handleSignedInUser(user, options)
        },
        handleSignedOutUser() {
            providerMap.forEach(provider => provider.handleSignedOutUser?.())
        },
        uploadFile(file, options = {}) {
            return getProvider().uploadFile(file, options)
        },
        uploadDataUrl(dataUrl, options = {}) {
            return getProvider().uploadDataUrl(dataUrl, options)
        },
        externalizeHtmlMedia(html, options = {}) {
            return getPipeline().externalizeHtmlMedia(html, options)
        },
        externalizePageDrawings(pageDrawings, options = {}) {
            return getPipeline().externalizePageDrawings(pageDrawings, options)
        },
        externalizeNoteMedia(note, options = {}) {
            return getPipeline().externalizeNoteMedia(note, options)
        },
        containsInlineMedia,
        isInlineMediaSource,
        getInlineMediaSummary,
        normalizeExternalMediaErrorCode,
        resolveUserFacingError,
        getStatus() {
            const provider = getProvider()
            return {
                activeProviderId: getSelectedProviderId(),
                ...(provider?.getStatus?.() || { providerId: getSelectedProviderId() })
            }
        }
    }

    return service
}

export const ERROR_CODES = {
    OFFLINE: "external-storage-offline",
    UNLINKED: "external-storage-unlinked",
    UNAVAILABLE: "external-storage-unavailable",
    SAVE_FAILED: "external-attachment-save-failed",
    INLINE_MEDIA_BLOCKED: "external-inline-media-blocked"
}

export const createExternalMediaError = (code, cause = null) => {
    const error = new Error(code)
    error.code = code
    if (cause) error.cause = cause
    return error
}

const inferAuthorizationErrorCode = (error) => {
    const code = String(error?.code || "").toLowerCase()
    const message = String(error?.message || "").toLowerCase()
    if (
        code.includes("popup")
        || code.includes("cancel")
        || code.includes("denied")
        || code.includes("interaction")
        || code.includes("login_required")
        || code.includes("account")
        || message.includes("popup")
        || message.includes("cancel")
        || message.includes("denied")
        || message.includes("interaction")
        || message.includes("login required")
        || message.includes("account")
        || message.includes("token")
        || message.includes("consent")
    ) {
        return ERROR_CODES.UNLINKED
    }
    return ERROR_CODES.UNAVAILABLE
}

export const normalizeExternalMediaErrorCode = (error) => {
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

export const resolveUserFacingError = (error, options = {}) => {
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

import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from '../../errors.js'
import { resolveBackendBaseUrl, createApiEndpoint } from '../../../backendConfig.js'

export const createGoogleDriveProvider = ({ backendBaseUrl } = {}) => {
    const providerId = 'google-drive'
    const normalizedBackendBaseUrl = resolveBackendBaseUrl({ backendBaseUrl })
    const uploadEndpoint = createApiEndpoint('drive/upload', { backendBaseUrl: normalizedBackendBaseUrl })
    const statusEndpoint = createApiEndpoint('drive/status', { backendBaseUrl: normalizedBackendBaseUrl })
    const connectUrlEndpoint = createApiEndpoint('drive/connect-url', { backendBaseUrl: normalizedBackendBaseUrl })
    const disconnectEndpoint = createApiEndpoint('drive/disconnect', { backendBaseUrl: normalizedBackendBaseUrl })
    const state = {
        linked: false,
        connected: false,
        available: true,
        pending: false,
        errorCode: '',
        checked: false,
        currentUser: null
    }
    const uploadCache = new Map()
    let providerApi = null

    const readOAuthRedirectFlag = () => {
        const search = typeof window !== 'undefined' ? window.location?.search : ''
        const params = new URLSearchParams(String(search || ''))
        return params.get('drive') === 'connected'
    }

    const clearOAuthRedirectFlag = () => {
        const currentUrl = new URL(window.location.href)
        if (currentUrl.searchParams.get('drive') !== 'connected') return
        currentUrl.searchParams.delete('drive')
        const nextSearch = currentUrl.searchParams.toString()
        const nextUrl = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${currentUrl.hash || ''}`
        window.history.replaceState(window.history.state, '', nextUrl)
        console.info('[GoogleDriveProvider] OAuth redirect query removed', { nextUrl })
    }

    const sanitizeFileNamePart = (value, fallback) => {
        const normalizedValue = String(value || '').trim().toLowerCase()
        const safeValue = normalizedValue
            .replace(/[^\p{L}\p{N}_-]+/gu, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
        return safeValue || fallback
    }

    const inferFileExtension = (mimeType) => {
        const normalizedMimeType = String(mimeType || '').toLowerCase()
        if (normalizedMimeType.includes('jpeg')) return 'jpg'
        if (normalizedMimeType.includes('png')) return 'png'
        if (normalizedMimeType.includes('webp')) return 'webp'
        if (normalizedMimeType.includes('gif')) return 'gif'
        if (normalizedMimeType.includes('mp3')) return 'mp3'
        if (normalizedMimeType.includes('mpeg')) return 'mp3'
        if (normalizedMimeType.includes('wav')) return 'wav'
        if (normalizedMimeType.includes('ogg')) return 'ogg'
        if (normalizedMimeType.includes('mp4')) return 'mp4'
        if (normalizedMimeType.includes('pdf')) return 'pdf'
        return 'bin'
    }

    const extractDriveFileId = (value) => {
        const source = String(value || '').trim()
        if (!source) return ''
        const idFromParam = source.match(/[?&]id=([^&#]+)/i)?.[1]
        if (idFromParam) return decodeURIComponent(idFromParam)
        const idFromFilePath = source.match(/\/file\/d\/([^/]+)/i)?.[1]
        if (idFromFilePath) return decodeURIComponent(idFromFilePath)
        return ''
    }

    const toDriveDirectImageUrl = (value) => {
        const fileId = extractDriveFileId(value)
        if (!fileId) return ''
        return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`
    }

    const toDriveThumbnailUrl = (value) => {
        const fileId = extractDriveFileId(value)
        if (!fileId) return ''
        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w2000`
    }

    const isImageMimeType = (mimeType) => String(mimeType || '').toLowerCase().startsWith('image/')

    const isGoogleDriveHost = (value) => /^https?:\/\/drive\.google\.com\//i.test(String(value || '').trim())

    const isDriveDownloadOrViewUrl = (value) => {
        const source = String(value || '').trim()
        if (!source) return false
        if (!isGoogleDriveHost(source)) return false
        if (/\/file\/d\//i.test(source)) return true
        if (/\/uc\?/i.test(source) && /export=(download|view)/i.test(source)) return true
        if (/export=(download|view)/i.test(source)) return true
        return false
    }

    const toRenderableImageUrl = (value, { preferBackendImageUrl = false } = {}) => {
        const source = String(value || '').trim()
        if (!source) return ''
        if (preferBackendImageUrl && /^https?:\/\//i.test(source)) return source
        if (isDriveDownloadOrViewUrl(source)) {
            return toDriveThumbnailUrl(source) || ''
        }
        if (/^https?:\/\/drive\.google\.com\/file\/d\//i.test(source)) {
            return toDriveThumbnailUrl(source) || ''
        }
        if (isGoogleDriveHost(source)) {
            return toDriveThumbnailUrl(source) || toDriveDirectImageUrl(source) || source
        }
        return source
    }

    const normalizePublicUrl = (file, options = {}) => {
        if (typeof file === 'string') return file
        const mimeType = String(options.mimeType || file?.mimeType || '')
        const imageMode = isImageMimeType(mimeType)
        const imageUrl = String(file?.imageUrl || '').trim()
        const publicUrl = String(file?.publicUrl || '').trim()
        const webContentLink = String(file?.webContentLink || '').trim()
        const genericUrl = String(file?.url || '').trim()
        const webViewLink = String(file?.webViewLink || '').trim()
        if (imageMode) {
            const preferredImageUrl = toRenderableImageUrl(imageUrl, { preferBackendImageUrl: true })
            const candidates = [
                preferredImageUrl,
                toRenderableImageUrl(publicUrl),
                toRenderableImageUrl(webContentLink),
                toRenderableImageUrl(genericUrl),
                toRenderableImageUrl(webViewLink),
                toDriveThumbnailUrl(genericUrl),
                toDriveThumbnailUrl(webViewLink),
                toDriveDirectImageUrl(genericUrl),
                toDriveDirectImageUrl(webViewLink)
            ]
            return candidates.find(candidate => /^https?:\/\//i.test(String(candidate || '').trim())) || ''
        }
        return genericUrl || publicUrl || webContentLink || webViewLink
    }

    const getCurrentUser = () => state.currentUser || window.auth?.currentUser || (typeof StateStore !== 'undefined' && typeof StateStore.read === 'function' ? StateStore.read().user : null) || null

    const requireIdToken = async () => {
        const user = getCurrentUser()
        if (!user || typeof user.getIdToken !== 'function') throw createExternalMediaError(ERROR_CODES.UNLINKED)
        try {
            return await user.getIdToken()
        } catch (error) {
            throw createExternalMediaError(ERROR_CODES.UNLINKED, error)
        }
    }

    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(createExternalMediaError(ERROR_CODES.SAVE_FAILED, reader.error))
        reader.readAsDataURL(blob)
    })

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

    const getIdTokenWithRetry = async ({ retries = 1, delayMs = 250 } = {}) => {
        let lastError = null
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                const token = await requireIdToken()
                return { token, attempt }
            } catch (error) {
                lastError = error
                if (attempt >= retries) break
                await sleep(delayMs)
            }
        }
        throw lastError || createExternalMediaError(ERROR_CODES.UNAVAILABLE)
    }

    const parseStatusPayload = (rawText) => {
        const source = String(rawText || '').trim()
        if (!source) return {}
        return JSON.parse(source)
    }

    const parseJsonSafe = (rawText) => {
        const source = String(rawText || '').trim()
        if (!source) return null
        try {
            return JSON.parse(source)
        } catch (error) {
            return null
        }
    }

    const isConfiguredEndpoint = (value) => {
        const endpoint = String(value || '').trim()
        if (!endpoint) return false
        if (/^https?:\/\//i.test(endpoint)) return true
        return endpoint.startsWith('/')
    }

    const normalizeStatusPayload = (payload) => {
        const normalizedPayload = payload && typeof payload === 'object' ? payload : {}
        const connected = normalizedPayload.connected === true || normalizedPayload.linked === true
        return {
            connected,
            linked: connected,
            available: true,
            payload: normalizedPayload
        }
    }

    const getStatusSnapshot = () => {
        const hasBackend = isConfiguredEndpoint(uploadEndpoint)
        return {
            providerId,
            configured: hasBackend,
            linked: !!state.linked,
            connected: !!state.connected,
            available: !!state.available,
            pending: !!state.pending,
            errorCode: state.errorCode || ''
        }
    }

    const resolveProviderStatus = () => providerApi?.getStatus?.() || getStatusSnapshot()

    const createAuthorizedHeaders = (idToken, includeJson = false) => includeJson
        ? {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json'
        }
        : {
            Authorization: `Bearer ${idToken}`
        }

    const syncStatusFromBackend = async ({ reason = 'default' } = {}) => {
        console.info('[GoogleDriveProvider] status refresh requested', { reason })
        state.pending = true
        state.errorCode = ''
        let failureBranch = ''
        try {
            failureBranch = 'id-token'
            const tokenResult = await getIdTokenWithRetry({ retries: reason === 'oauth-redirect' ? 2 : 1, delayMs: 300 })
            const idToken = tokenResult.token
            console.info('[GoogleDriveProvider] status refresh token resolved', { reason, attempt: tokenResult.attempt })
            failureBranch = 'fetch-start'
            console.info('[GoogleDriveProvider] status refresh fetch start', { reason, endpoint: statusEndpoint })
            let response = null
            try {
                response = await fetch(statusEndpoint, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${idToken}`
                    }
                })
            } catch (error) {
                failureBranch = 'fetch-throw'
                console.error('[GoogleDriveProvider] status refresh branch fetch-throw', { reason, error })
                throw createExternalMediaError(ERROR_CODES.UNAVAILABLE, error)
            }
            console.info('[GoogleDriveProvider] status refresh raw response meta', {
                reason,
                status: response.status,
                ok: response.ok,
                url: response.url
            })
            if (!response.ok) {
                failureBranch = `http-${response.status}`
                console.error('[GoogleDriveProvider] status refresh non-ok response', { reason, status: response.status })
                if (response.status === 401 || response.status === 403) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                throw createExternalMediaError(ERROR_CODES.UNAVAILABLE)
            }
            failureBranch = 'response-text'
            const rawBody = await response.text()
            console.info('[GoogleDriveProvider] status refresh raw response text', { reason, rawBody })
            failureBranch = 'payload-parse'
            let payload = {}
            try {
                payload = parseStatusPayload(rawBody)
            } catch (error) {
                failureBranch = 'payload-parse-failed'
                console.error('[GoogleDriveProvider] status refresh branch payload-parse-failed', { reason, rawBody, message: error?.message, stack: error?.stack, error })
                throw createExternalMediaError(ERROR_CODES.UNAVAILABLE, error)
            }
            console.info('[GoogleDriveProvider] status refresh parsed payload', payload)
            failureBranch = 'payload-normalize'
            const normalized = normalizeStatusPayload(payload)
            if (normalized.connected) {
                state.linked = true
                state.connected = true
                state.available = true
                state.errorCode = ''
                state.checked = true
                console.info('[GoogleDriveProvider] status refresh normalized state', { reason, branch: 'payload-connected-true', ...normalized, checked: state.checked, errorCode: state.errorCode })
                return resolveProviderStatus()
            }
            state.linked = false
            state.connected = false
            state.available = true
            state.checked = true
            state.errorCode = ''
            console.warn('[GoogleDriveProvider] status refresh returned connected=false', { reason, payload: normalized.payload })
            console.info('[GoogleDriveProvider] status refresh normalized state', {
                reason,
                branch: 'payload-connected-false',
                linked: state.linked,
                connected: state.connected,
                available: state.available,
                checked: state.checked,
                errorCode: state.errorCode
            })
            return resolveProviderStatus()
        } catch (error) {
            const code = normalizeExternalMediaErrorCode(error)
            state.errorCode = code
            state.linked = false
            state.connected = false
            state.available = false
            state.checked = true
            console.error('[GoogleDriveProvider] status refresh failed', { reason, code, failureBranch, message: error?.message, stack: error?.stack, error })
            if (code === ERROR_CODES.UNLINKED) return resolveProviderStatus()
            throw createExternalMediaError(code, error)
        } finally {
            state.pending = false
        }
    }

    const uploadDataUrl = async (dataUrl, options = {}) => {
        const source = String(dataUrl || '').trim()
        if (!source.startsWith('data:')) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        if (uploadCache.has(source)) return uploadCache.get(source)

        const uploadPromise = (async () => {
            state.pending = true
            state.errorCode = ''
            try {
                if (state.checked && !state.connected) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                const idToken = await requireIdToken()
                const mimeType = String(source.match(/^data:([^;,]+)/i)?.[1] || '')
                const fileNameBase = sanitizeFileNamePart(options.fileNameBase || 'attachment', 'attachment')
                const payload = {
                    dataUrl: source,
                    fileNameBase,
                    extension: inferFileExtension(mimeType)
                }
                console.info('[GoogleDriveProvider] upload request prepared', {
                    fileNameBase,
                    mimeType,
                    fileSizeBytes: Number(options.fileSizeBytes || 0) || source.length,
                    extension: payload.extension
                })
                const response = await fetch(uploadEndpoint, {
                    method: 'POST',
                    headers: createAuthorizedHeaders(idToken, true),
                    body: JSON.stringify(payload)
                })
                const rawResponseText = await response.text()
                const parsedResponse = parseJsonSafe(rawResponseText)
                console.info('[GoogleDriveProvider] upload response', {
                    status: response.status,
                    ok: response.ok,
                    rawResponseText,
                    parsedResponse
                })
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                    const uploadError = createExternalMediaError(ERROR_CODES.SAVE_FAILED)
                    uploadError.details = {
                        status: response.status,
                        rawResponseText,
                        parsedResponse,
                        fileNameBase,
                        mimeType
                    }
                    throw uploadError
                }
                const result = parsedResponse || {}
                const publicUrl = normalizePublicUrl(result, { mimeType })
                console.info('[GoogleDriveProvider] upload selected media url', {
                    mimeType,
                    imageMode: isImageMimeType(mimeType),
                    selectedUrl: publicUrl,
                    payload: result
                })
                if (!/^https?:\/\//i.test(publicUrl)) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
                state.linked = true
                state.connected = true
                state.available = true
                state.checked = true
                return publicUrl
            } catch (error) {
                const code = normalizeExternalMediaErrorCode(error)
                state.errorCode = code
                if (code === ERROR_CODES.UNLINKED) {
                    state.linked = false
                    state.connected = false
                }
                console.error('[GoogleDriveProvider] upload failed', {
                    code,
                    message: error?.message,
                    stack: error?.stack,
                    details: error?.details || null
                })
                throw createExternalMediaError(code, error)
            } finally {
                state.pending = false
            }
        })()

        uploadCache.set(source, uploadPromise)
        try {
            return await uploadPromise
        } catch (error) {
            uploadCache.delete(source)
            throw error
        }
    }

    const uploadFile = async (file, options = {}) => {
        if (!(file instanceof Blob)) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        const dataUrl = await blobToDataUrl(file)
        return uploadDataUrl(dataUrl, {
            ...options,
            fileNameBase: options.fileNameBase || String(file.name || 'attachment'),
            fileSizeBytes: Number(file.size || 0)
        })
    }

    providerApi = {
        providerId,
        sanitizeFileNamePart,
        normalizePublicUrl,
        async connect() {
            state.pending = true
            state.errorCode = ''
            try {
                const idToken = await requireIdToken()
                const response = await fetch(connectUrlEndpoint, {
                    method: 'POST',
                    headers: createAuthorizedHeaders(idToken, true)
                })
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                    throw createExternalMediaError(ERROR_CODES.UNAVAILABLE)
                }
                const payload = await response.json()
                const redirectUrl = String(payload?.url || '').trim()
                if (!/^https?:\/\//i.test(redirectUrl)) throw createExternalMediaError(ERROR_CODES.UNAVAILABLE)
                state.pending = false
                window.location.assign(redirectUrl)
                return this.getStatus()
            } catch (error) {
                const code = normalizeExternalMediaErrorCode(error)
                state.errorCode = code
                state.pending = false
                throw createExternalMediaError(code, error)
            }
        },
        async unlink() {
            state.pending = true
            state.errorCode = ''
            try {
                const idToken = await requireIdToken()
                const response = await fetch(disconnectEndpoint, {
                    method: 'POST',
                    headers: createAuthorizedHeaders(idToken, true)
                })
                const rawResponseText = await response.text()
                const parsedResponse = parseJsonSafe(rawResponseText)
                console.info('[GoogleDriveProvider] disconnect response', {
                    status: response.status,
                    ok: response.ok,
                    rawResponseText,
                    parsedResponse
                })
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                    throw createExternalMediaError(ERROR_CODES.UNAVAILABLE)
                }
                state.linked = false
                state.connected = false
                state.available = true
                state.checked = true
                state.errorCode = ''
                uploadCache.clear()
                return this.getStatus()
            } catch (error) {
                const code = normalizeExternalMediaErrorCode(error)
                state.errorCode = code
                if (code !== ERROR_CODES.UNLINKED) {
                    state.available = false
                }
                console.error('[GoogleDriveProvider] disconnect failed', {
                    code,
                    message: error?.message,
                    stack: error?.stack
                })
                throw createExternalMediaError(code, error)
            } finally {
                state.pending = false
            }
        },
        async handleSignedInUser(user) {
            state.currentUser = user || null
            const hasOAuthRedirectFlag = readOAuthRedirectFlag()
            console.info('[GoogleDriveProvider] oauth redirect flag detected', { hasOAuthRedirectFlag })
            const status = await syncStatusFromBackend.call(this, { reason: hasOAuthRedirectFlag ? 'oauth-redirect' : 'signed-in-user' })
            if (hasOAuthRedirectFlag) {
                if (status?.connected) {
                    clearOAuthRedirectFlag()
                } else {
                    console.warn('[GoogleDriveProvider] OAuth redirect status returned disconnected state', status)
                }
            }
            return status
        },
        handleSignedOutUser() {
            state.currentUser = null
            state.linked = false
            state.connected = false
            state.available = true
            state.pending = false
            state.errorCode = ''
            state.checked = false
            uploadCache.clear()
        },
        uploadFile,
        uploadDataUrl,
        resolveUserFacingError,
        getStatus() {
            return getStatusSnapshot()
        }
    }
    return providerApi
}
