"use strict";

import { initFirebase } from "./firebase.js"
import { createAuthManager } from "./auth.js"

const usersCollectionName = "users"

const resolveUserIdentifier = user => {
    if (!user || !user.uid) return ""
    return String(user.uid)
}

const getUserRootReference = (db, user) => {
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
    if (createdAtValue !== undefined) payload.createdAt = createdAtValue
    return payload
}

const createRefsApi = (db) => ({
    getUserStorageCollectionName: () => usersCollectionName,
    getUserRootReference: user => getUserRootReference(db, user),
    ensureUserDocument: async (user) => {
        const rootReference = getUserRootReference(db, user)
        if (!rootReference) return null
        const existingDocument = await rootReference.get()
        const existingData = existingDocument.exists ? (existingDocument.data() || {}) : {}
        const createdAtValue = existingData.createdAt ?? firebase.firestore.FieldValue.serverTimestamp()
        const payload = buildUserDocumentPayload(user, createdAtValue)
        await rootReference.set(payload, { merge: true })
        return rootReference
    },
    getUserNotesCollection(user) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection("notes") : null
    },
    getUserFoldersCollection(user) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection("folders") : null
    },
    getUserSharedCollection(user, sharedCollectionName) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection(sharedCollectionName) : null
    },
    getUserSettingsReference(user) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection("settings").doc("profile") : null
    },
    getUserLegacySettingsReference(user) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection("preferences").doc("profile") : null
    }
})

const infraState = {
    app: null,
    auth: null,
    db: null,
    authManager: null,
    refsApi: null
}

const InfraEngine = {
    init() {
        if (infraState.auth && infraState.db) return infraState
        const { app, auth, db } = initFirebase()
        infraState.app = app
        infraState.auth = auth
        infraState.db = db
        infraState.refsApi = createRefsApi(db)
        window.auth = auth
        window.db = db
        window.DataPath = infraState.refsApi
        return infraState
    },
    createAuth() {
        if (infraState.authManager) return infraState.authManager
        if (!infraState.auth) this.init()
        infraState.authManager = createAuthManager({ auth: infraState.auth })
        return infraState.authManager
    },
    login() {
        const manager = this.createAuth()
        return manager.login()
    },
    logout() {
        const manager = this.createAuth()
        return manager.logout()
    },
    getUser() {
        return infraState.auth?.currentUser || null
    },
    getRefs() {
        if (!infraState.refsApi) this.init()
        return infraState.refsApi
    },
    getAuth() {
        if (!infraState.auth) this.init()
        return infraState.auth
    },
    getDb() {
        if (!infraState.db) this.init()
        return infraState.db
    }
}

window.InfraEngine = InfraEngine

export { InfraEngine }
