const SettingsRepository = (() => {
    async function resolveReference(user) {
        const primaryReference = DataPath.getUserSettingsReference(user)
        const fallbackReference = DataPath.getUserLegacySettingsReference(user)
        if (!primaryReference && !fallbackReference) return { reference: null, snapshot: null, storageType: null }
        if (primaryReference) {
            try {
                const snapshot = await primaryReference.get()
                return { reference: primaryReference, snapshot, storageType: "settings" }
            } catch (error) {
                if (String(error?.code || "") !== "permission-denied") throw error
            }
        }
        if (!fallbackReference) return { reference: null, snapshot: null, storageType: null }
        const snapshot = await fallbackReference.get()
        return { reference: fallbackReference, snapshot, storageType: "preferences" }
    }
    async function write(reference, payload) {
        if (!reference) return
        await reference.set(payload, { merge: true })
    }
    function subscribe(reference, next, error) {
        if (!reference) return () => {}
        return reference.onSnapshot(next, error)
    }
    return { resolveReference, write, subscribe }
})()
