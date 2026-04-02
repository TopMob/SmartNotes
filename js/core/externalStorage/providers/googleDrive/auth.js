export const createGoogleDriveAuthFlow = ({ stateController, errors, folderManager, getGoogleClientId, requestGoogleAccessToken, uploadScope }) => {
    const { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode } = errors
    const { state, applyStoredState, getCurrentUser, getCurrentUserKey, writeStoredState } = stateController

    const getLoginHint = () => {
        const user = getCurrentUser()
        return String(
            user?.email
            || user?.providerData?.find?.(provider => String(provider?.providerId || '') === 'google.com')?.email
            || ''
        ).trim()
    }

    const requestAccessToken = async ({ interactive, userKey }) => {
        try {
            const tokenResponse = await requestGoogleAccessToken({
                clientId: getGoogleClientId(),
                scope: uploadScope,
                prompt: interactive ? (state.granted ? '' : 'consent') : 'none',
                loginHint: getLoginHint()
            })
            if (!tokenResponse?.accessToken) throw createExternalMediaError(ERROR_CODES.UNLINKED)
            state.accessToken = tokenResponse.accessToken
            state.expiresAt = Date.now() + (Math.max(1, Number(tokenResponse.expiresIn || 3600)) * 1000)
            state.lastErrorCode = ''
            if (userKey) await folderManager.ensureFolders(state.accessToken, { userKey })
            return state.accessToken
        } catch (error) {
            const normalizedErrorCode = normalizeExternalMediaErrorCode(error)
            state.accessToken = ''
            state.expiresAt = 0
            state.lastErrorCode = normalizedErrorCode
            if (interactive && normalizedErrorCode === ERROR_CODES.UNLINKED) {
                state.granted = false
                if (userKey) writeStoredState(null, userKey)
            }
            throw createExternalMediaError(normalizedErrorCode, error)
        } finally {
            state.pendingPromise = null
        }
    }

    const getAccessToken = async (forceRefresh = false, options = {}) => {
        const userKey = String(options.userKey || getCurrentUserKey()).trim()
        applyStoredState(userKey)
        if (!getGoogleClientId()) {
            state.lastErrorCode = ERROR_CODES.UNLINKED
            throw createExternalMediaError(ERROR_CODES.UNLINKED)
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            state.lastErrorCode = ERROR_CODES.OFFLINE
            throw createExternalMediaError(ERROR_CODES.OFFLINE)
        }
        const now = Date.now()
        if (!forceRefresh && state.accessToken && state.expiresAt - now > 60000) {
            state.lastErrorCode = ''
            return state.accessToken
        }
        if (!forceRefresh && !state.granted) {
            state.lastErrorCode = ERROR_CODES.UNLINKED
            throw createExternalMediaError(ERROR_CODES.UNLINKED)
        }
        if (state.pendingPromise) return state.pendingPromise
        state.pendingPromise = requestAccessToken({ interactive: options.interactive === true, userKey })
        return state.pendingPromise
    }

    const connectDrive = async (options = {}) => {
        const userKey = String(options.userKey || getCurrentUserKey()).trim()
        await getAccessToken(true, { interactive: options.interactive !== false, userKey })
        return true
    }

    return {
        getAccessToken,
        connectDrive
    }
}

