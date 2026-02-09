const AppLifecycle = {
    initialized: false,
    activeUid: null,
    unsubscribers: [],
    ownedNotes: [],
    sharedNotes: new Map(),
    sharedEntries: new Map(),
    sharedUnsub: null,
    sharedNoteUnsubs: new Map(),
    pendingShareEntryId: null,
    sharedSyncEnabled: true,

    async initializeOnce() {
        if (this.initialized) return
        this.initialized = true
        await DriveService.init()
        ReminderService.init()
        if (typeof Editor !== "undefined") Editor.init()
        UI.init()
        UI.setLang(localStorage.getItem("app-lang") || "ru")
    },

    clearSubscriptions() {
        this.unsubscribers.forEach(unsub => {
            if (typeof unsub === "function") unsub()
        })
        this.unsubscribers = []
        if (typeof this.sharedUnsub === "function") this.sharedUnsub()
        this.sharedUnsub = null
        this.sharedNoteUnsubs.forEach(unsub => {
            if (typeof unsub === "function") unsub()
        })
        this.sharedNoteUnsubs = new Map()
        this.sharedEntries = new Map()
        this.sharedNotes = new Map()
        this.ownedNotes = []
        this.pendingShareEntryId = null
    },
    disableSharedSync() {
        this.sharedSyncEnabled = false
        if (typeof this.sharedUnsub === "function") this.sharedUnsub()
        this.sharedUnsub = null
        this.sharedNoteUnsubs.forEach(unsub => {
            if (typeof unsub === "function") unsub()
        })
        this.sharedNoteUnsubs = new Map()
        this.sharedEntries = new Map()
        this.sharedNotes = new Map()
    },
    shouldIgnoreSharedError(error) {
        if (!error) return false
        if (error.code === "permission-denied") return true
        if (typeof error.message === "string" && error.message.includes("Missing or insufficient permissions")) return true
        return false
    },
    handleSharedError(error) {
        if (!this.shouldIgnoreSharedError(error)) return false
        this.disableSharedSync()
        return true
    },

    stopUserSession() {
        this.activeUid = null
        this.sharedSyncEnabled = true
        this.clearSubscriptions()
    },

    async startUserSession(user) {
        if (!db || !user) return

        await this.initializeOnce()
        if (typeof CollaborationService !== "undefined") {
            CollaborationService.captureShareToken()
        }

        if (this.activeUid === user.uid) return
        this.stopUserSession()
        this.activeUid = user.uid

        const folderUnsub = db.collection("users").doc(user.uid).collection("folders")
            .orderBy("createdAt", "asc")
            .onSnapshot(snap => {
                const folders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                StateStore.update("folders", folders)
                UI.renderFolders()
                if (StateStore.read().view === "folders") {
                    filterAndRender(document.getElementById("search-input")?.value || "")
                }
            }, error => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
                console.error("Folders sync error", error)
            })

        const notesUnsub = db.collection("users").doc(user.uid).collection("notes")
            .orderBy("order", "asc")
            .onSnapshot(snap => {
                this.ownedNotes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                this.updateNotesState()
            }, error => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
                console.error("Notes sync error", error)
            })

        this.unsubscribers = [folderUnsub, notesUnsub]

        if (typeof CollaborationService !== "undefined" && this.sharedSyncEnabled) {
            this.sharedUnsub = db.collection("users").doc(user.uid).collection(CollaborationService.sharedNotesCollection)
                .onSnapshot(snap => {
                    const entries = new Map()
                    snap.docs.forEach(doc => {
                        const data = doc.data() || {}
                        if (!data.ownerUid || !data.noteId) return
                        entries.set(doc.id, {
                            id: doc.id,
                            ownerUid: String(data.ownerUid),
                            noteId: String(data.noteId),
                            permission: CollaborationService.normalizePermission(data.permission),
                            shareToken: data.shareToken || ""
                        })
                    })
                    this.applySharedEntries(entries)
                }, error => {
                    if (this.handleSharedError(error)) return
                    UI.showToast(UI.getText("sync_error", "Sync error"))
                    console.error("Shared notes sync error", error)
                })

            const accepted = await CollaborationService.acceptPendingShare(user)
            if (accepted?.id) {
                this.pendingShareEntryId = accepted.id
            }
        }

        const loader = document.getElementById("app-loader")
        if (loader) loader.classList.add("hidden")

        const search = document.getElementById("search-input")
        if (search) search.value = ""

        switchView("notes")
    },
    updateNotesState() {
        let notes = [...this.ownedNotes, ...this.sharedNotes.values()]
        notes = NotesStorage.applyStoredFavorites(notes)
        StateStore.update("notes", notes)
        NotesStorage.syncFavoritesStorage(notes)
        if (StateStore.read().isEditing) return
        this.syncOpenNote(notes)
        filterAndRender(document.getElementById("search-input")?.value || "")
    },
    syncOpenNote(notes) {
        const current = StateStore.read().currentNote
        if (!current) return
        const updated = notes.find(note => note.id === current.id)
        if (!updated) return
        const canEdit = typeof CollaborationService === "undefined" ? true : CollaborationService.canEdit(current)
        if (StateStore.read().editorDirty && canEdit) return
        if (typeof Editor !== "undefined" && Editor.refreshFromRemote) {
            Editor.refreshFromRemote(updated)
        }
    },
    applySharedEntries(entries) {
        const removed = []
        this.sharedEntries.forEach((entry, id) => {
            if (!entries.has(id)) removed.push(id)
        })
        removed.forEach(id => {
            const unsub = this.sharedNoteUnsubs.get(id)
            if (typeof unsub === "function") unsub()
            this.sharedNoteUnsubs.delete(id)
            this.sharedEntries.delete(id)
            this.sharedNotes.delete(id)
        })
        entries.forEach((entry, id) => {
            const existing = this.sharedEntries.get(id)
            this.sharedEntries.set(id, entry)
            if (existing) {
                const currentNote = this.sharedNotes.get(id)
                if (currentNote?.access?.role !== entry.permission) {
                    const updated = {
                        ...currentNote,
                        access: {
                            ...currentNote.access,
                            role: entry.permission
                        }
                    }
                    this.sharedNotes.set(id, updated)
                    this.updateNotesState()
                }
                return
            }
            const unsub = db.collection("users").doc(entry.ownerUid).collection("notes").doc(entry.noteId)
                .onSnapshot(doc => {
                    if (!doc.exists) {
                        this.sharedNotes.delete(id)
                        this.updateNotesState()
                        return
                    }
                    const baseNote = NoteIO.normalizeNote({ id: entry.noteId, ...doc.data() })
                    const sharedNote = {
                        ...baseNote,
                        id: CollaborationService.sharedNoteId(entry.ownerUid, entry.noteId),
                        access: {
                            role: entry.permission,
                            ownerUid: entry.ownerUid,
                            noteId: entry.noteId,
                            shareId: id
                        }
                    }
                    this.sharedNotes.set(id, sharedNote)
                    this.updateNotesState()
                    if (this.pendingShareEntryId === id) {
                        this.pendingShareEntryId = null
                        if (typeof Editor !== "undefined") Editor.openFromList(sharedNote)
                    }
                }, error => {
                    if (this.handleSharedError(error)) return
                    UI.showToast(UI.getText("sync_error", "Sync error"))
                    console.error("Shared note sync error", error)
                })
            this.sharedNoteUnsubs.set(id, unsub)
        })
        this.updateNotesState()
    }
}

async function initApp() {
    const user = StateStore.read().user
    if (!user) return
    await AppLifecycle.startUserSession(user)
}

window.initApp = initApp
window.startUserSession = (user) => AppLifecycle.startUserSession(user)
window.stopUserSession = () => AppLifecycle.stopUserSession()
