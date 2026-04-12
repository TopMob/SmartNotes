(() => {
    const isFileProtocol = String(window.location?.protocol || "") === "file:"
    if (!isFileProtocol) return

    const ensureLang = () => {
        if (window.LANG) return
        window.LANG = { ru: {}, en: {} }
    }

    const ensureThemeManager = () => {
        if (window.ThemeManager) return
        window.ThemeManager = {
            maxCustomPresets: 5,
            init() {},
            normalizeHex(value) {
                const source = String(value || "").trim()
                return /^#[0-9a-f]{6}$/i.test(source) ? source.toUpperCase() : "#2563EB"
            },
            getSavedSettings() {
                return { preset: "oled", p: "#2563EB", bg: "#000000", t: "#FFFFFF", uiOpacity: 0.78, cardsOpacity: 0.9 }
            },
            applySettings() {}
        }
    }

    const ensureUtils = () => {
        if (window.Utils) return
        window.Utils = {
            generateId: () => Math.random().toString(36).slice(2, 11),
            serverTimestamp: () => window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || Date.now(),
            formatDate: value => {
                if (!value) return ""
                if (typeof value?.toDate === "function") return value.toDate().toLocaleString()
                const date = new Date(value)
                return Number.isNaN(date.getTime()) ? "" : date.toLocaleString()
            },
            stripHtml: html => {
                const wrapper = document.createElement("div")
                wrapper.innerHTML = String(html || "")
                return wrapper.textContent || ""
            },
            escapeHtml: value => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"),
            sanitizeHtml: html => String(html || "")
        }
    }

    const ensureHelpers = () => {
        window.Validators = window.Validators || {
            validateFolderName: name => {
                const normalized = String(name || "").trim()
                if (!normalized || normalized.length > 50) return null
                return normalized
            },
            validateFolderDescription: description => {
                const normalized = String(description || "").trim()
                return normalized.length <= 300 ? normalized : null
            },
            canAddFolder: count => Number(count) < 10,
            canAddCustomTheme: count => Number(count) < 5,
            canAssignToFolder: folder => !!folder && folder.trashedAt == null,
            FOLDER_DESCRIPTION_SOFT_LIMIT: 300,
            FOLDER_DESCRIPTION_HARD_LIMIT: 300
        }
        window.NoteHelpers = window.NoteHelpers || {
            normalizeDateValue(value) {
                if (!value) return 0
                if (typeof value?.toDate === "function") return value.toDate().getTime()
                const parsed = Date.parse(String(value))
                return Number.isFinite(parsed) ? parsed : 0
            },
            buildNotePayload({ note, user } = {}) {
                const id = String(note?.id || window.Utils.generateId())
                const ownerUid = String(note?.ownerUid || user?.uid || "local-user")
                return {
                    id,
                    ownerUid,
                    title: String(note?.title || ""),
                    content: String(note?.content || ""),
                    tags: Array.isArray(note?.tags) ? note.tags : [],
                    createdAt: note?.createdAt || window.Utils.serverTimestamp(),
                    updatedAt: window.Utils.serverTimestamp(),
                    isFavorite: !!note?.isFavorite,
                    isArchived: !!note?.isArchived,
                    isPinned: !!note?.isPinned,
                    trashedAt: note?.trashedAt || null,
                    folderId: note?.folderId || null
                }
            },
            buildNoteUpdatePayload(updates = {}, options = {}) {
                const payload = { ...updates }
                if (options.updateTimestamp !== false && payload.updatedAt === undefined) payload.updatedAt = window.Utils.serverTimestamp()
                return payload
            }
        }
        window.AppMessages = window.AppMessages || { APP_MESSAGES: {}, getAppMessage: (_, descriptor) => descriptor?.fallback || "" }
    }

    const ensureNoteText = () => {
        if (window.NoteText) return
        const getText = html => {
            const wrapper = document.createElement("div")
            wrapper.innerHTML = String(html || "")
            return (wrapper.textContent || "").trim()
        }
        window.NoteText = {
            buildAutoTitle(note) {
                const text = getText(note?.content || "")
                if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text
                return String(note?.title || "Без названия")
            },
            buildPreviewText(note) {
                const text = getText(note?.content || "")
                return text || ""
            }
        }
    }

    const createTimestamp = (date = new Date()) => ({
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1_000_000,
        toDate: () => new Date(date.getTime()),
        toMillis: () => date.getTime()
    })

    const createSentinel = type => ({ __sentinel: type })
    const normalizeWrite = value => {
        if (Array.isArray(value)) return value.map(item => normalizeWrite(item))
        if (!value || typeof value !== "object") return value
        if (value.__sentinel === "serverTimestamp") return createTimestamp(new Date())
        const out = {}
        for (const [key, nested] of Object.entries(value)) out[key] = normalizeWrite(nested)
        return out
    }

    const ensureBackend = () => {
        if (window.db && window.auth && window.firebase) return
        const docs = new Map()
        const listeners = new Set()
        const split = path => String(path || "").split("/").filter(Boolean)
        const join = parts => parts.filter(Boolean).join("/")
        const colOf = path => join(split(path).slice(0, -1))

        const emit = changed => listeners.forEach(listener => listener(changed))

        class DocumentSnapshot {
            constructor(path, data) {
                this.ref = new DocumentReference(path)
                this.id = split(path).at(-1)
                this.exists = !!data
                this._data = data ? structuredClone(data) : null
            }
            data() { return this._data ? structuredClone(this._data) : undefined }
        }

        class QuerySnapshot {
            constructor(items) {
                this.docs = items
                this.empty = items.length === 0
                this.size = items.length
            }
        }

        class DocumentReference {
            constructor(path) { this.path = join(split(path)); this.id = split(this.path).at(-1) }
            collection(name) { return new CollectionReference(join([this.path, String(name || "")])) }
            async get() { return new DocumentSnapshot(this.path, docs.get(this.path) || null) }
            async set(payload, options = {}) {
                const merge = options.merge === true
                const normalized = normalizeWrite(payload)
                const current = docs.get(this.path) || {}
                docs.set(this.path, merge ? { ...current, ...normalized } : normalized)
                emit(new Set([this.path]))
            }
            async update(payload) {
                const current = docs.get(this.path) || {}
                const normalized = normalizeWrite(payload)
                for (const [key, value] of Object.entries(normalized)) current[key] = value
                docs.set(this.path, current)
                emit(new Set([this.path]))
            }
            async delete() { docs.delete(this.path); emit(new Set([this.path])) }
            onSnapshot(next) {
                const notify = () => next(new DocumentSnapshot(this.path, docs.get(this.path) || null))
                notify()
                const listener = changed => { if (changed.has(this.path)) notify() }
                listeners.add(listener)
                return () => listeners.delete(listener)
            }
        }

        class Query {
            constructor(path, options = {}) { this.path = path; this.options = options }
            limit(count) { return new Query(this.path, { ...this.options, limit: Number(count) || 0 }) }
            startAfter(snapshot) { return new Query(this.path, { ...this.options, startAfter: snapshot?.id || "" }) }
            where(field, operator, value) { return new Query(this.path, { ...this.options, where: [...(this.options.where || []), { field, operator, value }] }) }
            _docs() {
                let rows = Array.from(docs.entries()).filter(([path]) => colOf(path) === this.path).map(([path, data]) => ({ path, data }))
                for (const clause of this.options.where || []) rows = rows.filter(row => clause.operator === "==" ? row.data?.[clause.field] === clause.value : true)
                rows.sort((a, b) => (b.data?.updatedAt?.toMillis?.() || 0) - (a.data?.updatedAt?.toMillis?.() || 0))
                if (this.options.startAfter) {
                    const index = rows.findIndex(row => split(row.path).at(-1) === this.options.startAfter)
                    if (index >= 0) rows = rows.slice(index + 1)
                }
                if (this.options.limit > 0) rows = rows.slice(0, this.options.limit)
                return rows.map(row => new DocumentSnapshot(row.path, row.data))
            }
            async get() { return new QuerySnapshot(this._docs()) }
            onSnapshot(next) {
                const notify = () => next(new QuerySnapshot(this._docs()))
                notify()
                const listener = changed => { if (Array.from(changed).some(path => colOf(path) === this.path)) notify() }
                listeners.add(listener)
                return () => listeners.delete(listener)
            }
        }

        class CollectionReference extends Query {
            constructor(path) { super(path); this.path = path }
            doc(id = "") { return new DocumentReference(join([this.path, String(id || "").trim() || window.Utils.generateId()])) }
            async add(payload) { const ref = this.doc(); await ref.set(payload); return ref }
        }

        window.firebase = {
            firestore: {
                Timestamp: class {
                    constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds }
                    toDate() { return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000)) }
                    toMillis() { return this.toDate().getTime() }
                },
                FieldValue: {
                    serverTimestamp: () => createSentinel("serverTimestamp"),
                    delete: () => createSentinel("delete")
                }
            }
        }

        window.db = {
            collection(name) { return new CollectionReference(String(name || "")) },
            batch() {
                const ops = []
                return {
                    set: (ref, payload, options = {}) => ops.push(() => ref.set(payload, options)),
                    update: (ref, payload) => ops.push(() => ref.update(payload)),
                    delete: ref => ops.push(() => ref.delete()),
                    async commit() { for (const op of ops) await op() }
                }
            }
        }

        const user = {
            uid: "local-user",
            email: "local@smartnotes.app",
            displayName: "Local User",
            photoURL: "",
            providerData: [{ providerId: "local" }],
            async getIdToken() { return "local-token" },
            async updateProfile(patch = {}) {
                if (typeof patch.displayName === "string") this.displayName = patch.displayName
                if (typeof patch.photoURL === "string") this.photoURL = patch.photoURL
            }
        }

        window.auth = {
            currentUser: user,
            onAuthStateChanged(next) {
                setTimeout(() => next(user), 0)
                return () => {}
            }
        }
    }

    const ensureAuthAndCore = () => {
        if (window.Auth) return
        window.GoogleDriveMediaService = window.GoogleDriveMediaService || {
            providerId: "local-media",
            connect: async () => ({ linked: true, connected: true }),
            unlink: async () => ({ linked: false, connected: false }),
            handleSignedInUser: async () => ({}),
            handleSignedOutUser: () => {},
            uploadFile: async () => ({ url: "", publicUrl: "" }),
            uploadDataUrl: async dataUrl => ({ url: dataUrl, publicUrl: dataUrl }),
            externalizeHtmlMedia: async html => ({ html, items: [] }),
            externalizePageDrawings: async pageDrawings => ({ pageDrawings, items: [] }),
            externalizeNoteMedia: async note => ({ note, items: [] }),
            containsInlineMedia: () => false,
            isInlineMediaSource: () => false,
            getInlineMediaSummary: () => ({ total: 0, images: 0, audio: 0, video: 0, files: 0 }),
            normalizeDrivePublicUrl: value => String(value || ""),
            getStatus: () => ({ providerId: "local-media", linked: true, connected: true, available: true })
        }
        window.ExternalMediaService = window.GoogleDriveMediaService

        const applySignedInUi = user => {
            const appScreen = document.getElementById("app")
            if (appScreen) {
                appScreen.style.display = "flex"
                appScreen.classList.add("active")
                appScreen.style.opacity = "1"
            }
            const userName = document.getElementById("user-name")
            const userUid = document.getElementById("user-uid")
            if (userName) userName.textContent = user.displayName || "Local User"
            if (userUid) userUid.textContent = user.uid
            if (typeof window.hideSplashScreen === "function") {
                window.hideSplashScreen()
            } else {
                const splash = document.getElementById("splash-screen")
                if (splash) {
                    splash.classList.remove("active")
                    splash.classList.add("hidden")
                    splash.style.display = "none"
                }
            }
        }

        window.Auth = {
            async init() {
                const user = window.auth.currentUser
                StateActions.setUser(user)
                if (typeof SessionService !== "undefined" && typeof SessionService.startUserSession === "function") await SessionService.startUserSession(user)
                applySignedInUi(user)
            },
            async login() { return true },
            async loginWithEmail() { return true },
            async logout() { return true },
            async switchAccount() { return true },
            async updateDisplayName(name = "") {
                const normalized = String(name || "").trim()
                if (!normalized) return false
                await window.auth.currentUser.updateProfile({ displayName: normalized })
                applySignedInUi(window.auth.currentUser)
                return true
            },
            async updateAvatarFromFile(file) {
                if (!(file instanceof Blob)) return false
                const source = await new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(String(reader.result || ""))
                    reader.onerror = () => reject(new Error("avatar_read_failed"))
                    reader.readAsDataURL(file)
                })
                await window.auth.currentUser.updateProfile({ photoURL: source })
                return true
            }
        }
    }

    const ensureEditor = () => {
        if (window.SmartNotesEditor) return
        const toolState = new Map()
        const baseTools = [
            { id: "bold" }, { id: "italic" }, { id: "underline" }, { id: "link" }, { id: "image" }
        ]
        const readEditorNote = () => StateStore.read().currentNote || null
        const buildPayload = () => {
            const state = StateStore.read()
            const current = state.currentNote
            if (!current) return null
            const title = document.getElementById("note-title")?.value || ""
            const content = document.getElementById("note-content-editable")?.innerHTML || ""
            return window.NoteHelpers.buildNotePayload({ note: { ...current, title, content }, user: state.user })
        }
        window.SmartNotesEditor = {
            init() {},
            async open() {},
            async openFromList(note) {
                if (!note) return
                StateStore.update("currentNote", note)
                StateStore.update("isEditing", true)
                const title = document.getElementById("note-title")
                const content = document.getElementById("note-content-editable")
                if (title) title.value = note.title || ""
                if (content) content.innerHTML = note.content || ""
                const wrapper = document.getElementById("note-editor")
                if (wrapper) wrapper.classList.add("active")
            },
            async close() {
                StateStore.update("isEditing", false)
                const wrapper = document.getElementById("note-editor")
                if (wrapper) wrapper.classList.remove("active")
            },
            async save() {
                const payload = buildPayload()
                if (!payload) return false
                const user = StateStore.read().user
                if (!user?.uid) return false
                await DataPath.getUserNotesCollection(user).doc(payload.id).set(payload, { merge: true })
                StateStore.update("currentNote", payload)
                StateStore.update("editorDirty", false)
                return true
            },
            undo() {},
            redo() {},
            deleteCurrent() {
                const note = readEditorNote()
                if (!note) return
                NotesActions.removeNote(note)
            },
            toggleToolbar() {},
            getToolList() { return baseTools },
            getEnabledTools() { return new Set(baseTools.filter(tool => toolState.get(tool.id) !== false).map(tool => tool.id)) },
            setToolEnabled(id, enabled) { toolState.set(id, !!enabled) },
            resetMediaTransform() {},
            alignMediaOrText() {},
            deleteSelectedMedia() {},
            confirmEquation() {},
            addPage() {},
            deleteActivePage() {},
            selectPage() {},
            nextPage() {},
            prevPage() {},
            applyLink() {},
            handlePaste() {},
            saveSnapshot() {}
        }
    }

    const bootstrapFallback = async () => {
        ensureLang()
        ensureThemeManager()
        ensureUtils()
        ensureHelpers()
        ensureNoteText()
        ensureBackend()
        ensureAuthAndCore()
        ensureEditor()
        if (window.ThemeManager?.init) window.ThemeManager.init()
        await window.Auth.init()
    }

    window.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
            const hasWorkingCore = !!window.__smartnotesCore?.db && !!window.__smartnotesCore?.Auth
            if (!hasWorkingCore) {
                bootstrapFallback().catch(error => {
                    console.error("[Fallback] startup failed", error)
                    if (typeof window.hideSplashScreen === "function") window.hideSplashScreen()
                })
            }
        }, 50)
    })
})()
