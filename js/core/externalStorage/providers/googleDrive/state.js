export const createGoogleDriveState = ({ storageKey }) => {
    const state = {
        accessToken: '',
        expiresAt: 0,
        pendingPromise: null,
        lastErrorCode: '',
        currentUserKey: '',
        granted: false,
        folders: {
            rootId: '',
            attachmentsId: '',
            backupsId: '',
            exportsId: ''
        },
        interactivePromptedForUser: ''
    }

    const getCurrentUser = () => window.auth?.currentUser || (typeof StateStore !== 'undefined' && typeof StateStore.read === 'function' ? StateStore.read().user : null) || null
    const getCurrentUserKey = (user = getCurrentUser()) => String(user?.uid || user?.email || '').trim()

    const readStoredState = (userKey = getCurrentUserKey()) => {
        const normalizedUserKey = String(userKey || '').trim()
        if (!normalizedUserKey || !window.SafeStorage?.local?.getJson) return null
        const allStates = window.SafeStorage.local.getJson(storageKey, {}) || {}
        const storedState = allStates[normalizedUserKey]
        return storedState && typeof storedState === 'object' ? storedState : null
    }

    const writeStoredState = (nextState, userKey = getCurrentUserKey()) => {
        const normalizedUserKey = String(userKey || '').trim()
        if (!normalizedUserKey || !window.SafeStorage?.local?.getJson || !window.SafeStorage?.local?.setJson) return
        const allStates = window.SafeStorage.local.getJson(storageKey, {}) || {}
        if (!nextState) {
            delete allStates[normalizedUserKey]
            window.SafeStorage.local.setJson(storageKey, allStates)
            return
        }
        allStates[normalizedUserKey] = nextState
        window.SafeStorage.local.setJson(storageKey, allStates)
    }

    const applyStoredState = (userKey = getCurrentUserKey()) => {
        const normalizedUserKey = String(userKey || '').trim()
        if (!normalizedUserKey) {
            state.currentUserKey = ''
            state.granted = false
            state.folders = { rootId: '', attachmentsId: '', backupsId: '', exportsId: '' }
            return null
        }
        if (state.currentUserKey === normalizedUserKey) return readStoredState(normalizedUserKey)
        state.currentUserKey = normalizedUserKey
        const storedState = readStoredState(normalizedUserKey)
        state.granted = !!storedState?.granted
        state.folders = {
            rootId: String(storedState?.rootId || ''),
            attachmentsId: String(storedState?.attachmentsId || ''),
            backupsId: String(storedState?.backupsId || ''),
            exportsId: String(storedState?.exportsId || '')
        }
        return storedState
    }

    const persistState = (updates = {}, userKey = getCurrentUserKey()) => {
        const normalizedUserKey = String(userKey || '').trim()
        if (!normalizedUserKey) return
        const previousState = readStoredState(normalizedUserKey) || {}
        const nextState = {
            granted: !!updates.granted,
            linkedAt: Number(updates.linkedAt || previousState.linkedAt || Date.now()),
            rootId: String(updates.rootId || ''),
            attachmentsId: String(updates.attachmentsId || ''),
            backupsId: String(updates.backupsId || ''),
            exportsId: String(updates.exportsId || '')
        }
        state.currentUserKey = normalizedUserKey
        state.granted = nextState.granted
        state.folders = {
            rootId: nextState.rootId,
            attachmentsId: nextState.attachmentsId,
            backupsId: nextState.backupsId,
            exportsId: nextState.exportsId
        }
        writeStoredState(nextState, normalizedUserKey)
    }

    const resetRuntimeState = () => {
        state.accessToken = ''
        state.expiresAt = 0
        state.pendingPromise = null
        state.lastErrorCode = ''
        state.currentUserKey = ''
        state.granted = false
        state.folders = { rootId: '', attachmentsId: '', backupsId: '', exportsId: '' }
        state.interactivePromptedForUser = ''
    }

    return {
        state,
        getCurrentUser,
        getCurrentUserKey,
        readStoredState,
        writeStoredState,
        applyStoredState,
        persistState,
        resetRuntimeState
    }
}

