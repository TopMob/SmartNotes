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
        const hasBackend = /^https?:\/\//i.test(uploadEndpoint)
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
                    headers: {
                        Authorization: `Bearer ${idToken}`
                    }
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
                    headers: createAuthorizedHeaders(idToken)
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
