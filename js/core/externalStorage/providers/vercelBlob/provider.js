import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from '../../errors.js'

export const createVercelBlobProvider = ({ backendBaseUrl = 'https://backendfornmartnotes.vercel.app' } = {}) => {
    const providerId = 'vercel-blob'
    const uploadEndpoint = `${String(backendBaseUrl || '').replace(/\/+$/g, '')}/api/media/upload`
    const state = {
        currentUser: null,
        pending: false,
        errorCode: ''
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
        if (normalizedMimeType.includes('svg')) return 'svg'
        if (normalizedMimeType.includes('mp3')) return 'mp3'
        if (normalizedMimeType.includes('mpeg')) return 'mp3'
        if (normalizedMimeType.includes('wav')) return 'wav'
        if (normalizedMimeType.includes('ogg')) return 'ogg'
        if (normalizedMimeType.includes('mp4')) return 'mp4'
        if (normalizedMimeType.includes('pdf')) return 'pdf'
        if (normalizedMimeType.includes('json')) return 'json'
        return 'bin'
    }

    const getCurrentUser = () => state.currentUser || window.auth?.currentUser || (typeof StateStore !== 'undefined' && typeof StateStore.read === 'function' ? StateStore.read().user : null) || null

    const resolveCurrentNoteId = (options = {}) => {
        const optionNoteId = String(options.noteId || '').trim()
        if (optionNoteId) return optionNoteId
        const stateNoteId = typeof StateStore !== 'undefined' && typeof StateStore.read === 'function'
            ? String(StateStore.read()?.currentNote?.id || '').trim()
            : ''
        return stateNoteId
    }

    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(createExternalMediaError(ERROR_CODES.SAVE_FAILED, reader.error))
        reader.readAsDataURL(blob)
    })

    const authorizeRequest = async () => {
        const user = getCurrentUser()
        if (!user || typeof user.getIdToken !== 'function') {
            throw createExternalMediaError(ERROR_CODES.UNLINKED)
        }
        try {
            return await user.getIdToken()
        } catch (error) {
            throw createExternalMediaError(ERROR_CODES.UNLINKED, error)
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
                const idToken = await authorizeRequest()
                const mimeType = String(source.match(/^data:([^;,]+)/i)?.[1] || '')
                const payload = {
                    dataUrl: source,
                    noteId: resolveCurrentNoteId(options),
                    fileNameBase: `${sanitizeFileNamePart(options.fileNameBase || 'attachment', 'attachment')}.${inferFileExtension(mimeType)}`
                }
                const response = await fetch(uploadEndpoint, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                    throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
                }
                const result = await response.json()
                const publicUrl = String(result?.url || '').trim()
                if (!/^https?:\/\//i.test(publicUrl)) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
                return publicUrl
            } catch (error) {
                state.errorCode = normalizeExternalMediaErrorCode(error)
                throw createExternalMediaError(state.errorCode, error)
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
        async connect() {
            state.errorCode = ''
            return this.getStatus()
        },
        async unlink() {
            state.errorCode = ''
            state.pending = false
            return this.getStatus()
        },
        async handleSignedInUser(user) {
            state.currentUser = user || null
            state.errorCode = ''
            return this.getStatus()
        },
        handleSignedOutUser() {
            state.currentUser = null
            state.pending = false
            state.errorCode = ''
            uploadCache.clear()
        },
        uploadDataUrl,
        uploadFile,
        resolveUserFacingError,
        getStatus() {
            const hasUser = !!getCurrentUser()
            return {
                providerId,
                configured: /^https?:\/\//i.test(uploadEndpoint),
                linked: true,
                connected: hasUser,
                pending: state.pending,
                errorCode: state.errorCode || ''
            }
        }
    }
}
