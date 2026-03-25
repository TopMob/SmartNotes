import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from '../../errors.js'

export const createGoogleDriveProvider = ({ backendBaseUrl = 'https://backendfornmartnotes.vercel.app' } = {}) => {
    const providerId = 'google-drive'
    const normalizedBackendBaseUrl = String(backendBaseUrl || '').replace(/\/+$/g, '')
    const uploadEndpoint = `${normalizedBackendBaseUrl}/api/drive/upload`
    const statusEndpoint = `${normalizedBackendBaseUrl}/api/drive/status`
    const connectUrlEndpoint = `${normalizedBackendBaseUrl}/api/drive/connect-url`
    const state = {
        linked: false,
        connected: false,
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

    const syncStatusFromBackend = async ({ reason = 'default' } = {}) => {
        console.info('[GoogleDriveProvider] status refresh requested', { reason })
        state.pending = true
        state.errorCode = ''
        try {
            const idToken = await requireIdToken()
            console.info('[GoogleDriveProvider] status refresh fetch start', { reason })
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
            console.info('[GoogleDriveProvider] status refresh payload', payload)
            const isLinked = !!(payload?.linked || payload?.connected)
            if (!isLinked) {
                console.warn('[GoogleDriveProvider] status refresh returned disconnected response', payload)
            }
            state.linked = isLinked
            state.connected = isLinked
            state.checked = true
            console.info('[GoogleDriveProvider] provider state updated after status refresh', {
                reason,
                linked: state.linked,
                connected: state.connected,
                checked: state.checked,
                errorCode: state.errorCode
            })
            return this.getStatus()
        } catch (error) {
            const code = normalizeExternalMediaErrorCode(error)
            state.errorCode = code
            state.linked = false
            state.connected = false
            state.checked = true
            console.error('[GoogleDriveProvider] status refresh failed', { reason, code, error })
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
                if (state.checked && !state.connected) throw createExternalMediaError(ERROR_CODES.UNLINKED)
                const idToken = await requireIdToken()
                const mimeType = String(source.match(/^data:([^;,]+)/i)?.[1] || '')
                const fileNameBase = sanitizeFileNamePart(options.fileNameBase || 'attachment', 'attachment')
                const response = await fetch(uploadEndpoint, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        dataUrl: source,
                        fileNameBase,
                        extension: inferFileExtension(mimeType)
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
            state.linked = false
            state.connected = false
            state.checked = true
            state.errorCode = ''
            uploadCache.clear()
            return this.getStatus()
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
    return providerApi
}
