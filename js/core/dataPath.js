(() => {
    const usersCollectionName = "users"

    const resolveUserIdentifier = user => {
        if (!user || !user.uid) return ""
        return String(user.uid)
    }

    const getUserStorageCollectionName = () => usersCollectionName

    const getUserRootReference = user => {
        const userIdentifier = resolveUserIdentifier(user)
        if (!db || !userIdentifier) return null
        return db.collection(usersCollectionName).doc(userIdentifier)
    }

    const buildUserDocumentPayload = (user, createdAtValue) => {
        const userIdentifier = resolveUserIdentifier(user)
        const providerId = Array.isArray(user?.providerData) && user.providerData.length
            ? String(user.providerData[0]?.providerId || "")
            : ""
        const payload = {
            uid: userIdentifier,
            email: user?.email ? String(user.email).toLowerCase() : null,
            providerId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
        if (createdAtValue !== undefined) {
            payload.createdAt = createdAtValue
        }
        return payload
    }

    const ensureUserDocument = async user => {
        const rootReference = getUserRootReference(user)
        if (!rootReference) return null
        const existingDocument = await rootReference.get()
        const existingData = existingDocument.exists ? (existingDocument.data() || {}) : {}
        const createdAtValue = existingData.createdAt ?? firebase.firestore.FieldValue.serverTimestamp()
        const payload = buildUserDocumentPayload(user, createdAtValue)
        await rootReference.set(payload, { merge: true })
        return rootReference
    }

    window.DataPath = {
        getUserStorageCollectionName,
        getUserRootReference,
        ensureUserDocument,
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
        },
        getUserSettingsReference(user) {
            const rootReference = getUserRootReference(user)
            return rootReference ? rootReference.collection("settings").doc("profile") : null
        },
        getUserLegacySettingsReference(user) {
            const rootReference = getUserRootReference(user)
            return rootReference ? rootReference.collection("preferences").doc("profile") : null
        }
    }
})()
