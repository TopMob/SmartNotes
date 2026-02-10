(() => {
    const getUserStorageCollectionName = (user) => {
        if (!user) return "users"
        if (user.isAnonymous) return "Guest"
        const providerIds = Array.isArray(user.providerData) ? user.providerData.map(provider => provider?.providerId).filter(Boolean) : []
        if (providerIds.includes("password")) return "Guest"
        return "users"
    }

    const getUserRootReference = (user) => {
        if (!db || !user) return null
        return db.collection(getUserStorageCollectionName(user)).doc(user.uid)
    }

    window.DataPath = {
        getUserStorageCollectionName,
        getUserRootReference,
        getUserNotesCollection(user) {
            const rootReference = getUserRootReference(user)
            return rootReference ? rootReference.collection("notes") : null
        },
        getUserFoldersCollection(user) {
            const rootReference = getUserRootReference(user)
            return rootReference ? rootReference.collection("folders") : null
        },
        getUserSharedCollection(user, sharedCollectionName) {
            const rootReference = getUserRootReference(user)
            return rootReference ? rootReference.collection(sharedCollectionName) : null
        }
    }
})()
