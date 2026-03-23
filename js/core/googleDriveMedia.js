import { createExternalStorageService } from './externalStorage/service.js'
import { createGoogleDriveProvider } from './externalStorage/providers/googleDrive/provider.js'
import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from './externalStorage/errors.js'
import { containsInlineMedia, getInlineMediaSummary, isInlineMediaSource } from './externalStorage/mediaPipeline.js'
import { firebaseConfig } from './firebase.js'
import { requestGoogleAccessToken } from './googleIdentityAuth.js'

const googleDriveProvider = createGoogleDriveProvider({ firebaseConfig, requestGoogleAccessToken })
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
