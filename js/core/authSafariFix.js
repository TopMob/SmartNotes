function resolveAuthPersistenceEnum() {
    if (typeof firebase === "undefined") return null
    if (!firebase.auth || !firebase.auth.Auth || !firebase.auth.Auth.Persistence) return null
    return firebase.auth.Auth.Persistence
}

export async function setAuthPersistenceFromOrder(auth, persistenceOrder) {
    if (!auth || !Array.isArray(persistenceOrder) || !persistenceOrder.length) return null
    const persistenceEnum = resolveAuthPersistenceEnum()
    if (!persistenceEnum) return null

    for (const persistenceMode of persistenceOrder) {
        if (!persistenceMode) continue
        try {
            await auth.setPersistence(persistenceMode)
            return persistenceMode
        } catch {}
    }

    return null
}

export async function setupAuthPersistence(auth) {
    const persistenceEnum = resolveAuthPersistenceEnum()
    if (!persistenceEnum) return null
    return setAuthPersistenceFromOrder(auth, [persistenceEnum.LOCAL])
}
