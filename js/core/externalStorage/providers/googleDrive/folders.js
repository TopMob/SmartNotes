export const createGoogleDriveFolderManager = ({ stateController, errors, filesEndpoint, folderMimeType, folderNames }) => {
    const { createExternalMediaError, ERROR_CODES } = errors
    const { state, applyStoredState, persistState, getCurrentUserKey } = stateController

    const escapeDriveQueryValue = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")

    const authorizedDriveRequest = async (accessToken, url, options = {}) => {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(options.headers || {})
            },
            body: options.body
        })
        if (response.status === 401) {
            state.expiresAt = 0
            state.lastErrorCode = ERROR_CODES.UNLINKED
            throw createExternalMediaError(ERROR_CODES.UNLINKED)
        }
        if (!response.ok) {
            state.lastErrorCode = ERROR_CODES.SAVE_FAILED
            throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        }
        return response
    }

    const findDriveFolder = async (name, parentId, accessToken) => {
        const normalizedName = String(name || '').trim()
        if (!normalizedName) return null
        const parentClause = parentId ? `'${escapeDriveQueryValue(parentId)}' in parents` : "'root' in parents"
        const query = [
            `mimeType='${folderMimeType}'`,
            'trashed=false',
            `name='${escapeDriveQueryValue(normalizedName)}'`,
            parentClause
        ].join(' and ')
        const response = await authorizedDriveRequest(accessToken, `${filesEndpoint}?q=${encodeURIComponent(query)}&spaces=drive&pageSize=1&fields=files(id,name,parents)`)
        const payload = await response.json()
        const folder = Array.isArray(payload?.files) ? payload.files[0] : null
        return folder?.id ? { id: String(folder.id), name: String(folder.name || normalizedName) } : null
    }

    const createDriveFolder = async (name, parentId, accessToken) => {
        const normalizedName = String(name || '').trim()
        if (!normalizedName) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        const payload = { name: normalizedName, mimeType: folderMimeType }
        if (parentId) payload.parents = [parentId]
        const response = await authorizedDriveRequest(accessToken, `${filesEndpoint}?fields=id,name,parents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        const folder = await response.json()
        if (!folder?.id) throw createExternalMediaError(ERROR_CODES.SAVE_FAILED)
        return { id: String(folder.id), name: normalizedName }
    }

    const ensureFolders = async (accessToken, options = {}) => {
        const userKey = String(options.userKey || getCurrentUserKey()).trim()
        const storedState = applyStoredState(userKey) || {}
        let rootId = String(options.rootId || state.folders.rootId || storedState.rootId || '')
        let attachmentsId = String(options.attachmentsId || state.folders.attachmentsId || storedState.attachmentsId || '')
        let backupsId = String(options.backupsId || state.folders.backupsId || storedState.backupsId || '')
        let exportsId = String(options.exportsId || state.folders.exportsId || storedState.exportsId || '')

        if (!rootId) {
            rootId = String((await findDriveFolder(folderNames.root, '', accessToken))?.id || '')
            if (!rootId) rootId = String((await createDriveFolder(folderNames.root, '', accessToken))?.id || '')
        }
        if (!attachmentsId) {
            attachmentsId = String((await findDriveFolder(folderNames.attachments, rootId, accessToken))?.id || '')
            if (!attachmentsId) attachmentsId = String((await createDriveFolder(folderNames.attachments, rootId, accessToken))?.id || '')
        }
        if (!backupsId) {
            backupsId = String((await findDriveFolder(folderNames.backups, rootId, accessToken))?.id || '')
            if (!backupsId) backupsId = String((await createDriveFolder(folderNames.backups, rootId, accessToken))?.id || '')
        }
        if (!exportsId) {
            exportsId = String((await findDriveFolder(folderNames.exports, rootId, accessToken))?.id || '')
            if (!exportsId) exportsId = String((await createDriveFolder(folderNames.exports, rootId, accessToken))?.id || '')
        }

        persistState({ granted: true, linkedAt: Date.now(), rootId, attachmentsId, backupsId, exportsId }, userKey)
        return { rootId, attachmentsId, backupsId, exportsId }
    }

    return {
        authorizedDriveRequest,
        ensureFolders
    }
}

