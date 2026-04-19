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

