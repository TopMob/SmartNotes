import { createExternalStorageService } from './externalStorage/service.js'
import { createGoogleDriveProvider } from './externalStorage/providers/googleDrive/provider.js'
import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from './externalStorage/errors.js'
import { containsInlineMedia, getInlineMediaSummary, isInlineMediaSource } from './externalStorage/mediaPipeline.js'

const isGoogleDriveFeatureEnabled = () => window.AppFeatures?.googleDrive === true

const googleDriveProvider = createGoogleDriveProvider()
const externalStorageService = createExternalStorageService({
    providers: [googleDriveProvider],
    defaultProviderId: googleDriveProvider.providerId
})

export const GoogleDriveMediaService = {
    ...externalStorageService,
    providerId: googleDriveProvider.providerId,
    normalizeDrivePublicUrl: googleDriveProvider.normalizePublicUrl,
    containsInlineMedia,
    isInlineMediaSource,
    getInlineMediaSummary,
    normalizeExternalMediaErrorCode,
    resolveUserFacingError,
    ERROR_CODES,
    createExternalMediaError,
    getStatus() {
        if (!isGoogleDriveFeatureEnabled()) {
            return { configured: false, linked: false, connected: false, pending: false, errorCode: "feature-disabled" }
        }
        return externalStorageService.getStatus()
    },
    async connect() {
        if (!isGoogleDriveFeatureEnabled()) throw createExternalMediaError("feature-disabled")
        return externalStorageService.connect()
    },
    async unlink() {
        if (!isGoogleDriveFeatureEnabled()) return false
        return externalStorageService.unlink()
    },
    async externalizeNoteMedia(...args) {
        if (!isGoogleDriveFeatureEnabled()) throw createExternalMediaError("feature-disabled")
        return externalStorageService.externalizeNoteMedia(...args)
    },
    async backupBundle(...args) {
        if (!isGoogleDriveFeatureEnabled()) throw createExternalMediaError("feature-disabled")
        return externalStorageService.backupBundle(...args)
    }
}

