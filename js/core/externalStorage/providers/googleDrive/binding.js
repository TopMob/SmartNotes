export const createGoogleDriveBindingStore = ({ stateController }) => {
    const { getCurrentUserKey, persistState } = stateController

    const normalizeBinding = rawBinding => {
        const source = rawBinding && typeof rawBinding === 'object' ? rawBinding : null
        if (!source?.granted) return null
        return {
            granted: true,
            linkedAt: Number(source.linkedAt || Date.now()),
            rootId: String(source.rootId || ''),
            attachmentsId: String(source.attachmentsId || ''),
            backupsId: String(source.backupsId || ''),
            exportsId: String(source.exportsId || '')
        }
    }

    const resolveReference = async user => {
        if (!user || !window.DataPath) return { reference: null, snapshot: null }
        const primaryReference = window.DataPath.getUserSettingsReference?.(user) || null
        const fallbackReference = window.DataPath.getUserLegacySettingsReference?.(user) || null
        if (window.DataPath.ensureUserDocument) {
            try {
                await window.DataPath.ensureUserDocument(user)
            } catch {}
        }
        if (primaryReference) {
            try {
                const snapshot = await primaryReference.get()
                return { reference: primaryReference, snapshot }
            } catch (error) {
                if (String(error?.code || '') !== 'permission-denied') throw error
            }
        }
        if (!fallbackReference) return { reference: null, snapshot: null }
        return { reference: fallbackReference, snapshot: await fallbackReference.get() }
    }

    const readBindingFromSnapshot = snapshot => normalizeBinding(snapshot?.data?.()?.externalStorage?.googleDrive || null)

    const saveBinding = async (user, binding) => {
        const normalizedBinding = normalizeBinding(binding)
        if (!user || !normalizedBinding) return normalizedBinding
        const resolved = await resolveReference(user)
        if (!resolved.reference) return normalizedBinding
        await resolved.reference.set({
            externalStorage: {
                googleDrive: normalizedBinding
            }
        }, { merge: true })
        return normalizedBinding
    }

    const clearBinding = async user => {
        if (!user) return
        const resolved = await resolveReference(user)
        if (!resolved.reference) return
        await resolved.reference.set({
            externalStorage: {
                googleDrive: null
            }
        }, { merge: true })
    }

    const hydrateState = async (user, localBinding = null) => {
        const userKey = getCurrentUserKey(user)
        const normalizedLocalBinding = normalizeBinding(localBinding)
        if (!userKey) return normalizedLocalBinding
        const resolved = await resolveReference(user)
        const remoteBinding = readBindingFromSnapshot(resolved.snapshot)
        if (remoteBinding) {
            persistState(remoteBinding, userKey)
            return remoteBinding
        }
        if (normalizedLocalBinding) {
            await saveBinding(user, normalizedLocalBinding)
            return normalizedLocalBinding
        }
        return null
    }

    return {
        normalizeBinding,
        saveBinding,
        clearBinding,
        hydrateState
    }
}
