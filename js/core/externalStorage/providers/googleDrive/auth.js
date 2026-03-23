export const createGoogleDriveAuthFlow = ({ stateController, errors, folderManager, getGoogleClientId, requestGoogleAccessToken, uploadScope }) => {
    const { ERROR_CODES, createExternalMediaError, normalizeExternalMediaErrorCode } = errors
    const { state, applyStoredState, getCurrentUserKey, writeStoredState } = stateController

    let connectDrive = async () => ({})

    const getAccessToken = async (forceRefresh = false, options = {}) => {
        const interactive = options.interactive === true
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
        if (!forceRefresh && state.granted) {
            await connectDrive({ interactive: false, userKey })
            if (state.accessToken && state.expiresAt - Date.now() > 60000) return state.accessToken
        }
        if (!forceRefresh) {
            state.lastErrorCode = ERROR_CODES.UNLINKED
            throw createExternalMediaError(ERROR_CODES.UNLINKED)
        }
        if (state.pendingPromise) return state.pendingPromise
        state.pendingPromise = (async () => {
            try {
                const tokenResponse = await requestGoogleAccessToken({
                    clientId: getGoogleClientId(),
                    scope: uploadScope,
                    prompt: interactive ? (state.granted ? '' : 'consent') : ''
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
                if (normalizedErrorCode === ERROR_CODES.UNLINKED) {
                    state.granted = false
                    if (userKey) writeStoredState(null, userKey)
                }
                throw createExternalMediaError(normalizedErrorCode, error)
            } finally {
                state.pendingPromise = null
            }
        })()
        return state.pendingPromise
    }

    connectDrive = async (options = {}) => {
        const userKey = String(options.userKey || getCurrentUserKey()).trim()
        await getAccessToken(true, { interactive: options.interactive !== false, userKey })
        return true
    }

    return {
        getAccessToken,
        connectDrive
    }
}
