export const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56",
    clientId: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
}

let firebaseSingleton = null

export function initFirebase() {
    if (firebaseSingleton) return firebaseSingleton

    if (typeof firebase === "undefined") {
        return { app: null, auth: null, db: null }
    }

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig)
    const auth = firebase.auth(app)
    const db = firebase.firestore(app)

    db.settings({ ignoreUndefinedProperties: true })
    db.enablePersistence({ synchronizeTabs: true }).catch(() => null)

    firebaseSingleton = { app, auth, db }
    return firebaseSingleton
}
