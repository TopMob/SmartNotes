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

function getUserAgentDataBrands() {
    const userAgentData = navigator.userAgentData
    if (!userAgentData || !Array.isArray(userAgentData.brands)) return ""
    return userAgentData.brands.map(brandEntry => String(brandEntry.brand || "")).join(" ").toLowerCase()
}

function detectBraveBrowser() {
    if (typeof navigator === "undefined") return false
    if (typeof navigator.brave !== "undefined") return true
    const userAgent = String(navigator.userAgent || "").toLowerCase()
    if (userAgent.includes("brave")) return true
    const brands = getUserAgentDataBrands()
    return brands.includes("brave")
}


function detectSafariBrowser() {
    if (typeof navigator === "undefined") return false
    const userAgent = String(navigator.userAgent || "")
    const hasSafari = /Safari/i.test(userAgent)
    const hasExcludedBrowser = /Chrome|Chromium|CriOS|FxiOS|Edg|EdgiOS|OPR|Opera|SamsungBrowser/i.test(userAgent)
    return hasSafari && !hasExcludedBrowser
}

function resolveFirestoreSettings() {
    const baseSettings = {
        ignoreUndefinedProperties: true,
        useFetchStreams: false
    }

    if (detectBraveBrowser() || detectSafariBrowser()) {
        return {
            ...baseSettings,
            experimentalForceLongPolling: true
        }
    }

    return {
        ...baseSettings,
        experimentalAutoDetectLongPolling: true
    }
}

export function initFirebase() {
    if (firebaseSingleton) return firebaseSingleton

    if (typeof firebase === "undefined") {
        return { app: null, auth: null, db: null }
    }

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig)
    const auth = firebase.auth(app)
    const db = firebase.firestore(app)

    db.settings({ ...resolveFirestoreSettings(), merge: true })
    try {
        db.enablePersistence().catch(() => null)
    } catch {}


    firebaseSingleton = { app, auth, db }
    console.info("[Firebase] db initialized", !!db)
    return firebaseSingleton
}
