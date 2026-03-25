import { createExternalStorageService } from './externalStorage/service.js'
import { createVercelBlobProvider } from './externalStorage/providers/vercelBlob/provider.js'
import { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode, resolveUserFacingError } from './externalStorage/errors.js'
import { containsInlineMedia, getInlineMediaSummary, isInlineMediaSource } from './externalStorage/mediaPipeline.js'

const vercelBlobProvider = createVercelBlobProvider({
    backendBaseUrl: 'https://backendfornmartnotes.vercel.app'
})

const externalStorageService = createExternalStorageService({
    providers: [vercelBlobProvider],
    defaultProviderId: vercelBlobProvider.providerId
})

export const VercelBlobMediaService = {
    ...externalStorageService,
    providerId: vercelBlobProvider.providerId,
    containsInlineMedia,
    isInlineMediaSource,
    getInlineMediaSummary,
    normalizeExternalMediaErrorCode,
    resolveUserFacingError,
    ERROR_CODES,
    createExternalMediaError
}
