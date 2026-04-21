const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56",
    clientId: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
}

const firebaseRuntimeSources = [
    "https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"
]

const Utils = {
    clamp(value, min, max) {
        const numeric = Number(value)
        if (!Number.isFinite(numeric)) return min
        return Math.min(max, Math.max(min, numeric))
    },
    snap(value, step = 1) {
        const numeric = Number(value)
        const normalizedStep = Number(step) || 1
        if (!Number.isFinite(numeric)) return 0
        return Math.round(numeric / normalizedStep) * normalizedStep
    },
    generateId(prefix = "id") {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    },
    escapeHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;")
    },
    stripHtml(value) {
        return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    },
    sanitizeHtml(value) {
        const container = document.createElement("div")
        container.textContent = String(value || "")
        return container.innerHTML
    },
    formatDate(value) {
        const date = value instanceof Date ? value : new Date(value || Date.now())
        if (!Number.isFinite(date.getTime())) return ""
        const lang = window.StateStore?.read?.().config?.lang === "en" ? "en-US" : "ru-RU"
        return date.toLocaleString(lang, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    },
    debounce(fn, wait = 200) {
        let timeoutId = null
        return (...args) => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => fn(...args), wait)
        }
    },
    serverTimestamp() {
        return window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString()
    }
}

const APP_MESSAGES = {
    restored: "restored",
    folderLimitReached: "folder_limit_reached",
    folderNameTooLong: "folder_name_too_long",
    moveToTrashedFolderDenied: "move_to_trashed_folder_denied"
}

const getAppMessage = (ui, key) => {
    const map = {
        [APP_MESSAGES.restored]: "restore_note",
        [APP_MESSAGES.folderLimitReached]: "folder_limit_reached",
        [APP_MESSAGES.folderNameTooLong]: "folder_name_too_long",
        [APP_MESSAGES.moveToTrashedFolderDenied]: "move_to_trashed_folder_denied"
    }
    const textKey = map[key]
    if (textKey && ui?.getText) return ui.getText(textKey, textKey)
    return String(key || "")
}

const FOLDER_DESCRIPTION_SOFT_LIMIT = 120
const FOLDER_DESCRIPTION_HARD_LIMIT = 300

const Validators = {
    validateFolderName(name) {
        const normalized = String(name || "").trim().slice(0, 50)
        return normalized.length ? normalized : ""
    },
    validateFolderDescription(description) {
        return String(description || "").trim().slice(0, FOLDER_DESCRIPTION_HARD_LIMIT)
    },
    canAddFolder(count) {
        return Number(count || 0) < 100
    },
    canAddCustomTheme(count) {
        return Number(count || 0) < 30
    },
    canAssignToFolder(folder) {
        return !folder?.trashedAt
    },
    FOLDER_DESCRIPTION_SOFT_LIMIT,
    FOLDER_DESCRIPTION_HARD_LIMIT
}

const normalizeDateValue = (value) => {
    if (!value) return null
    if (typeof value === "string") return value
    if (typeof value?.toDate === "function") return value.toDate().toISOString()
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

const buildNotePayload = ({ note = {}, user = null, access = null }) => {
    const now = Utils.serverTimestamp()
    const content = String(note.content || "")
    const title = String(note.title || "").trim() || "Без названия"
    return {
        id: String(note.id || Utils.generateId("note")),
        ownerUid: String(note.ownerUid || user?.uid || ""),
        title,
        content,
        tags: Array.isArray(note.tags) ? note.tags.map(tag => String(tag || "").trim()).filter(Boolean) : [],
        folderId: note.folderId || null,
        isFavorite: !!note.isFavorite,
        isPinned: !!note.isPinned,
        isArchived: !!note.isArchived,
        trashedAt: note.trashedAt || null,
        reminderAt: note.reminderAt || null,
        access: access || note.access || null,
        createdAt: note.createdAt || now,
        updatedAt: now
    }
}

const buildNoteUpdatePayload = (updates = {}, options = {}) => {
    const payload = { ...updates }
    if (options.updateTimestamp !== false) payload.updatedAt = Utils.serverTimestamp()
    return payload
}

const DataPath = {
    getUserRootReference(user) {
        if (!window.db || !user?.uid) return null
        return window.db.collection("users").doc(user.uid)
    },
    ensureUserDocument(user) {
        const ref = this.getUserRootReference(user)
        if (!ref) return Promise.resolve(null)
        return ref.set({ updatedAt: Utils.serverTimestamp() }, { merge: true }).then(() => ref)
    },
    getUserNotesCollection(user) {
        return this.getUserRootReference(user)?.collection("notes") || null
    },
    getUserFoldersCollection(user) {
        return this.getUserRootReference(user)?.collection("folders") || null
    },
    getUserSharedCollection(user, key) {
        return this.getUserRootReference(user)?.collection(String(key || "shared")) || null
    },
    getUserSettingsReference(user) {
        return this.getUserRootReference(user)?.collection("settings").doc("ui") || null
    },
    getUserLegacySettingsReference(user) {
        return this.getUserRootReference(user)?.collection("preferences").doc("ui") || null
    }
}

const InfraEngine = { getRefs: () => DataPath }

const GoogleDriveMediaService = {
    providerId: "google-drive",
    normalizeDrivePublicUrl(url) {
        const value = String(url || "").trim()
        if (!value) return ""
        return value
            .replace(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/view.*$/i, "https://drive.google.com/thumbnail?id=$1&sz=w2048")
            .replace(/https:\/\/drive\.google\.com\/uc\?id=([^&]+)&export=download/i, "https://drive.google.com/thumbnail?id=$1&sz=w2048")
    },
    async uploadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ url: String(reader.result || ""), provider: this.providerId })
            reader.onerror = () => reject(reader.error || new Error("file-read-failed"))
            reader.readAsDataURL(file)
        })
    }
}

const loadFirebaseRuntime = async () => {
    if (typeof window.firebase !== "undefined") return true
    for (const source of firebaseRuntimeSources) {
        await new Promise((resolve, reject) => {
            const exists = document.querySelector(`script[src="${source}"]`)
            if (exists) {
                resolve()
                return
            }
            const script = document.createElement("script")
            script.src = source
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error(`failed:${source}`))
            document.head.appendChild(script)
        }).catch(() => null)
    }
    return typeof window.firebase !== "undefined"
}

const initFirebase = async () => {
    const ready = await loadFirebaseRuntime()
    if (!ready) return { app: null, auth: null, db: null }
    const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig)
    const auth = window.firebase.auth(app)
    const db = window.firebase.firestore(app)
    window.auth = auth
    window.db = db
    return { app, auth, db }
}

const createAuthManager = () => {
    const manager = {
        async login() {
            if (!window.auth || !window.firebase?.auth) return false
            const provider = new window.firebase.auth.GoogleAuthProvider()
            provider.setCustomParameters({ prompt: "select_account" })
            await window.auth.signInWithPopup(provider)
            return true
        },
        async loginWithEmail() {
            if (!window.auth) return false
            const signInForm = document.getElementById("email-signin-form")
            const signUpForm = document.getElementById("email-signup-form")
            const signInActive = !signInForm?.classList.contains("hidden")
            if (signInActive) {
                const email = String(document.getElementById("email-signin-input")?.value || "").trim()
                const password = String(document.getElementById("password-signin-input")?.value || "")
                if (!email || !password) return false
                await window.auth.signInWithEmailAndPassword(email, password)
                return true
            }
            const email = String(document.getElementById("email-signup-input")?.value || "").trim()
            const password = String(document.getElementById("password-signup-input")?.value || "")
            const repeat = String(document.getElementById("password-signup-repeat-input")?.value || "")
            if (!email || !password || password !== repeat) return false
            await window.auth.createUserWithEmailAndPassword(email, password)
            return true
        },
        async logout() {
            if (!window.auth) return false
            await window.auth.signOut()
            return true
        },
        async switchAccount() {
            await this.logout()
            return this.login()
        },
        async updateDisplayName(displayName) {
            if (!window.auth?.currentUser) return false
            await window.auth.currentUser.updateProfile({ displayName: String(displayName || "").trim().slice(0, 50) })
            return true
        },
        async updateAvatarFromFile(file) {
            if (!window.auth?.currentUser || !file) return false
            const upload = await GoogleDriveMediaService.uploadFromFile(file)
            await window.auth.currentUser.updateProfile({ photoURL: upload.url })
            return true
        }
    }
    return manager
}

const bindAuthUi = () => {
    const handleForm = (id) => {
        const form = document.getElementById(id)
        if (!form) return
        form.addEventListener("submit", async event => {
            event.preventDefault()
            await window.Auth.loginWithEmail().catch(() => null)
        })
    }
    handleForm("email-signin-form")
    handleForm("email-signup-form")
}

const bootstrap = async () => {
    const { auth } = await initFirebase()
    window.Utils = Utils
    window.AppMessages = { APP_MESSAGES, getAppMessage }
    window.Validators = Validators
    window.NoteHelpers = { normalizeDateValue, buildNotePayload, buildNoteUpdatePayload }
    window.GoogleDriveMediaService = GoogleDriveMediaService
    window.ExternalMediaService = GoogleDriveMediaService
    window.DataPath = DataPath
    window.InfraEngine = InfraEngine
    window.Auth = createAuthManager()
    bindAuthUi()
    if (auth?.onAuthStateChanged) {
        auth.onAuthStateChanged(user => {
            window.StateActions?.setUser?.(user || null)
            const loginScreen = document.getElementById("login-screen")
            if (loginScreen) loginScreen.classList.toggle("active", !user)
            const appRoot = document.getElementById("app")
            if (appRoot) appRoot.classList.toggle("hidden", !user)
        })
    }
}

bootstrap().catch(error => console.error("Core bootstrap failed", error))
