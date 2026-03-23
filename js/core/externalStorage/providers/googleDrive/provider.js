import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from '../../errors.js'
import { createGoogleDriveAuthFlow } from './auth.js'
import { createGoogleDriveFolderManager } from './folders.js'
import { createGoogleDriveState } from './state.js'

export const createGoogleDriveProvider = ({ firebaseConfig, requestGoogleAccessToken }) => {
    const providerId = 'google-drive'
    const uploadScope = 'https://www.googleapis.com/auth/drive.file'
    const uploadEndpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webContentLink'
    const filesEndpoint = 'https://www.googleapis.com/drive/v3/files'
    const folderMimeType = 'application/vnd.google-apps.folder'
    const stateController = createGoogleDriveState({ storageKey: 'google-drive-state' })
    const { state, applyStoredState, persistState, resetRuntimeState, getCurrentUserKey } = stateController
    const folderManager = createGoogleDriveFolderManager({
        stateController,
        errors: { ERROR_CODES, createExternalMediaError },
        filesEndpoint,
        folderMimeType,
        folderNames: {
            root: 'SmartNotes',
            attachments: 'Attachments',
            backups: 'Backups',
            exports: 'Exports'
        }
    })
    const getGoogleClientId = () => String(window.auth?.app?.options?.clientId || firebaseConfig.clientId || '').trim()
    const { getAccessToken, connectDrive } = createGoogleDriveAuthFlow({
        stateController,
        errors: { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode },
        folderManager,
        getGoogleClientId,
        requestGoogleAccessToken,
        uploadScope
    })

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
        return 'bin'
    }

    const buildFileName = ({ fileNameBase = 'attachment', mimeType = '' } = {}) => `${sanitizeFileNamePart(fileNameBase, 'attachment')}.${inferFileExtension(mimeType)}`

    const buildBlobCacheKey = (blob) => {
        if (!blob || typeof blob !== 'object') return ''
        const blobName = typeof blob.name === 'string' ? blob.name : ''
        const blobType = typeof blob.type === 'string' ? blob.type : ''
        const blobSize = Number.isFinite(blob.size) ? blob.size : 0
        const lastModified = Number.isFinite(blob.lastModified) ? blob.lastModified : 0
        return [blobName, blobType, blobSize, lastModified].join(':')
    }

    const dataUrlToBlob = (dataUrl) => {
        const source = String(dataUrl || '')
        const match = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/i)
        if (!match) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        const mimeType = String(match[1] || 'application/octet-stream')
        const payload = source.slice(source.indexOf(',') + 1)
        const binary = atob(payload)
        const bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
        return new Blob([bytes], { type: mimeType })
    }

    const normalizePublicUrl = (file) => {
        const fileId = typeof file === 'string' ? file : String(file?.id || '').trim()
        const webContentLink = typeof file?.webContentLink === 'string' ? file.webContentLink.trim() : ''
        if (String(file?.mimeType || '').toLowerCase().startsWith('image/') && fileId) {
            return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`
        }
        if (/^https:\/\//i.test(webContentLink)) return webContentLink
        if (!fileId) return ''
        return `https://drive.google.com/uc?id=${encodeURIComponent(fileId)}&export=download`
    }

    const createMultipartBody = (metadata, blob, boundary) => new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
        blob,
        `\r\n--${boundary}--`
    ], { type: `multipart/related; boundary=${boundary}` })

    const ensureDrivePermission = async (fileId, accessToken) => {
        const response = await fetch(`${filesEndpoint}/${encodeURIComponent(fileId)}/permissions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: 'anyone', role: 'reader' })
        })
        if (response.ok || response.status === 409) return
        throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
    }

    const uploadCache = new Map()

    const uploadBlob = async (blob, options = {}, attempt = 0) => {
        const mimeType = String(options.mimeType || blob.type || 'application/octet-stream')
        const fileName = String(options.fileName || buildFileName({ fileNameBase: options.fileNameBase, mimeType }))
        const accessToken = await getAccessToken(attempt > 0, { interactive: false })
        const folders = await folderManager.ensureFolders(accessToken)
        const boundary = `smartnotes_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
        const metadata = { name: fileName, mimeType }
        if (folders.attachmentsId) metadata.parents = [folders.attachmentsId]
        const response = await fetch(uploadEndpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: createMultipartBody(metadata, blob, boundary)
        })

        if (response.status === 401 && attempt === 0) {
            state.expiresAt = 0
            return uploadBlob(blob, options, 1)
        }
        if (response.status === 401) {
            state.lastErrorCode = ERROR_CODES.UNLINKED
            throw createExternalMediaError(ERROR_CODES.UNLINKED)
        }
        if (!response.ok) {
            state.lastErrorCode = ERROR_CODES.SAVE_FAILED
            throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        }

        const file = await response.json()
        if (!file?.id) {
            state.lastErrorCode = ERROR_CODES.SAVE_FAILED
            throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        }
        await ensureDrivePermission(file.id, accessToken)
        const publicUrl = normalizePublicUrl(file)
        if (!/^https:\/\//i.test(publicUrl)) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        return { ...file, publicUrl }
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
        const result = await uploadBlobCached(String(dataUrl || ''), blob, {
            fileNameBase: options.fileNameBase || 'attachment',
            mimeType: blob.type
        })
        return result.publicUrl
    }

    const uploadFile = async (file, options = {}) => {
        if (!(file instanceof Blob)) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        const result = await uploadBlobCached(buildBlobCacheKey(file), file, {
            fileName: options.fileName || '',
            fileNameBase: options.fileNameBase || String(file.name || 'attachment'),
            mimeType: file.type || options.mimeType || 'application/octet-stream'
        })
        return result.publicUrl
    }

    return {
        providerId,
        sanitizeFileNamePart,
        normalizePublicUrl,
        async connect(options = {}) {
            await connectDrive({ interactive: options.interactive !== false, userKey: options.userKey })
            return this.getStatus()
        },
        async handleSignedInUser(user, options = {}) {
            const userKey = getCurrentUserKey(user)
            const storedState = applyStoredState(userKey)
            const isGoogleUser = !!user?.providerData?.some?.(provider => String(provider?.providerId || '') === 'google.com')
            if (storedState?.granted) {
                try {
                    await connectDrive({ interactive: false, userKey })
                    return this.getStatus()
                } catch (error) {
                    const errorCode = normalizeExternalMediaErrorCode(error)
                    if (!options.interactiveAllowed || !isGoogleUser || state.interactivePromptedForUser === userKey || errorCode !== ERROR_CODES.UNLINKED) {
                        throw error
                    }
                }
            }
            if (!options.interactiveAllowed || !isGoogleUser || state.interactivePromptedForUser === userKey) return this.getStatus()
            state.interactivePromptedForUser = userKey
            await connectDrive({ interactive: true, userKey })
            return this.getStatus()
        },
        handleSignedOutUser() {
            resetRuntimeState()
        },
        uploadFile,
        uploadDataUrl,
        resolveUserFacingError,
        getStatus() {
            applyStoredState()
            const now = Date.now()
            return {
                providerId,
                configured: !!getGoogleClientId(),
                linked: !!state.granted,
                connected: !!state.accessToken && state.expiresAt - now > 60000,
                pending: !!state.pendingPromise,
                errorCode: state.lastErrorCode || '',
                rootId: state.folders.rootId || '',
                attachmentsId: state.folders.attachmentsId || '',
                backupsId: state.folders.backupsId || '',
                exportsId: state.folders.exportsId || ''
            }
        }
    }
}
