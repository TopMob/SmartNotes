import { createExternalStorageService } from './externalStorage/service.js'
import { createGoogleDriveProvider } from './externalStorage/providers/googleDrive/provider.js'
import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from './externalStorage/errors.js'
import { containsInlineMedia, getInlineMediaSummary, isInlineMediaSource } from './externalStorage/mediaPipeline.js'

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
    createExternalMediaError
}

