export const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56",
    clientId: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
}

export function initFirebase() {
    let auth = null
    let db = null

    if (typeof firebase !== "undefined") {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)
        auth = firebase.auth()
        db = firebase.firestore()
        db.enablePersistence({ synchronizeTabs: true }).catch(() => null)
    }

    return { auth, db }
}
