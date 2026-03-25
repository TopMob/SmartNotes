import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from '../../errors.js'

export const createGoogleDriveProvider = ({ backendBaseUrl = 'https://backendfornmartnotes.vercel.app' } = {}) => {
    const providerId = 'google-drive'
    const normalizedBackendBaseUrl = String(backendBaseUrl || '').replace(/\/+$/g, '')
    const uploadEndpoint = `${normalizedBackendBaseUrl}/api/drive/upload`
    const statusEndpoint = `${normalizedBackendBaseUrl}/api/drive/status`
    const connectEndpoint = '/api/drive/connect'
    const state = {
        linked: false,
        connected: false,
        pending: false,
        errorCode: '',
        checked: false,
        currentUser: null
    }
    const uploadCache = new Map()

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

    const normalizePublicUrl = (file) => {
        if (typeof file === 'string') return file
        return String(file?.url || file?.publicUrl || file?.webContentLink || '').trim()
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

    const syncStatusFromBackend = async () => {
        state.pending = true
        state.errorCode = ''
        try {
            const idToken = await requireIdToken()
            const response = await fetch(statusEndpoint, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            })
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                throw createExternalMediaError(ERROR_CODES.UNAVAILABLE)
            }
            const payload = await response.json()
            const isLinked = !!(payload?.linked || payload?.connected)
            state.linked = isLinked
            state.connected = isLinked
            state.checked = true
            return this.getStatus()
        } catch (error) {
            const code = normalizeExternalMediaErrorCode(error)
            state.errorCode = code
            state.linked = false
            state.connected = false
            state.checked = true
            if (code === ERROR_CODES.UNLINKED) return this.getStatus()
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
                const idToken = await requireIdToken()
                const mimeType = String(source.match(/^data:([^;,]+)/i)?.[1] || '')
                const fileNameBase = options.fileNameBase || 'attachment'
                const response = await fetch(uploadEndpoint, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        dataUrl: source,
                        fileNameBase: `${sanitizeFileNamePart(fileNameBase, 'attachment')}.${inferFileExtension(mimeType)}`
                    })
                })
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                    throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
                }
                const result = await response.json()
                const publicUrl = normalizePublicUrl(result)
                if (!/^https?:\/\//i.test(publicUrl)) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
                state.linked = true
                state.connected = true
                state.checked = true
                return publicUrl
            } catch (error) {
                const code = normalizeExternalMediaErrorCode(error)
                state.errorCode = code
                if (code === ERROR_CODES.UNLINKED) {
                    state.linked = false
                    state.connected = false
                }
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
            fileNameBase: options.fileNameBase || String(file.name || 'attachment')
        })
    }

    return {
        providerId,
        sanitizeFileNamePart,
        normalizePublicUrl,
        connect() {
            window.location.assign(connectEndpoint)
            return this.getStatus()
        },
        async unlink() {
            state.linked = false
            state.connected = false
            state.checked = true
            state.errorCode = ''
            uploadCache.clear()
            return this.getStatus()
        },
        async handleSignedInUser(user) {
            state.currentUser = user || null
            return syncStatusFromBackend.call(this)
        },
        handleSignedOutUser() {
            state.currentUser = null
            state.linked = false
            state.connected = false
            state.pending = false
            state.errorCode = ''
            state.checked = false
            uploadCache.clear()
        },
        uploadFile,
        uploadDataUrl,
        resolveUserFacingError,
        getStatus() {
            const hasBackend = /^https?:\/\//i.test(uploadEndpoint)
            return {
                providerId,
                configured: hasBackend,
                linked: !!state.linked,
                connected: !!state.connected,
                pending: !!state.pending,
                errorCode: state.errorCode || ''
            }
        }
    }
}
