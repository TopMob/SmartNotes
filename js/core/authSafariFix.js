export async function setupAuthPersistence(auth) {
    if (!auth || typeof firebase === "undefined" || !firebase.auth || !firebase.auth.Auth || !firebase.auth.Auth.Persistence) return
    const persistenceModes = [
        firebase.auth.Auth.Persistence.LOCAL,
        firebase.auth.Auth.Persistence.SESSION,
        firebase.auth.Auth.Persistence.NONE
    ]

    for (const persistenceMode of persistenceModes) {
        try {
            await auth.setPersistence(persistenceMode)
            return
        } catch {}
    }

    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
    } catch {}
}
