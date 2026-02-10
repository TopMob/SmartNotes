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
    reminderTimers: new Map(),
    scheduleReminders(notes) {
        this.reminderTimers.forEach(timer => clearTimeout(timer))
        this.reminderTimers.clear()
        notes.forEach(note => {
            const reminderAt = note?.reminderAt?.toDate ? note.reminderAt.toDate().getTime() : Date.parse(note?.reminderAt || "")
            if (!reminderAt || Number.isNaN(reminderAt)) return
            const delay = reminderAt - Date.now()
            if (delay <= 0 || delay > 2147483647) return
            const timer = setTimeout(() => {
                UI.showToast(`${UI.getText("future_note", "Reminder")}: ${note.title || UI.getText("untitled_note", "Untitled")}`)
                if (window.Notification && Notification.permission === "granted") {
                    new Notification(note.title || UI.getText("untitled_note", "Untitled"), { body: UI.getText("future_note", "Reminder") })
                }
            }, delay)
            this.reminderTimers.set(note.id, timer)
        })
        if (window.Notification && Notification.permission === "default") Notification.requestPermission().catch(() => null)
    },


    async initializeOnce() {
        if (this.initialized) return
        this.initialized = true
        window.SmartNotesEditor?.init()
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
    removeSharedEntry(id, options = {}) {
        const entry = this.sharedEntries.get(id)
        if (!entry) return
        const unsub = this.sharedNoteUnsubs.get(id)
        if (typeof unsub === "function") unsub()
        this.sharedNoteUnsubs.delete(id)
        this.sharedEntries.delete(id)
        this.sharedNotes.delete(id)
        if (options.removeRemote && db && this.activeUid) {
            const currentUser = StateStore.read().user
            const sharedCollection = DataPath.getUserSharedCollection(currentUser, CollaborationService.sharedNotesCollection)
            if (sharedCollection) sharedCollection.doc(id).delete()
        }
        this.updateNotesState()
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

        const userRootReference = await DataPath.ensureUserDocument(user)
        if (!userRootReference) {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            return
        }

        const userFoldersCollection = DataPath.getUserFoldersCollection(user)
        const userNotesCollection = DataPath.getUserNotesCollection(user)
        if (!userFoldersCollection || !userNotesCollection) {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            return
        }

        const folderUnsub = userFoldersCollection
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

        const notesUnsub = userNotesCollection
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
            this.sharedUnsub = DataPath.getUserSharedCollection(user, CollaborationService.sharedNotesCollection)
                .onSnapshot(snap => {
                    const entries = new Map()
                    snap.docs.forEach(doc => {
                        const data = doc.data() || {}
                        if (!data.ownerUid || !data.noteId) return
                        entries.set(doc.id, {
                            id: doc.id,
                            ownerUid: String(data.ownerUid),
                            ownerCollection: "users",
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
        this.scheduleReminders(notes)
        if (StateStore.read().isEditing || StateStore.read().isTyping) return
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
        window.SmartNotesEditor?.refreshFromRemote?.(updated)
    },
    applySharedEntries(entries) {
        const removed = []
        this.sharedEntries.forEach((entry, id) => {
            if (!entries.has(id)) removed.push(id)
        })
        removed.forEach(id => {
            this.removeSharedEntry(id)
        })
        entries.forEach((entry, id) => {
            if (!entry.permission) {
                this.removeSharedEntry(id, { removeRemote: true })
                return
            }
            const existing = this.sharedEntries.get(id)
            this.sharedEntries.set(id, entry)
            if (existing) {
                const currentNote = this.sharedNotes.get(id)
                if (currentNote?.access?.roles?.[StateStore.read().user?.uid || ""] !== entry.permission) {
                    const currentUserUid = StateStore.read().user?.uid || ""
                    const nextRoles = { ...(currentNote.access?.roles || {}) }
                    if (currentUserUid) nextRoles[currentUserUid] = entry.permission
                    const updated = {
                        ...currentNote,
                        access: {
                            ...currentNote.access,
                            roles: nextRoles
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
                        this.removeSharedEntry(id)
                        return
                    }
                    const baseNote = NoteIO.normalizeNote({ id: entry.noteId, ...doc.data() })
                    const currentUserUid = StateStore.read().user?.uid || ""
                    const remoteRoles = baseNote.access?.roles && typeof baseNote.access.roles === "object"
                        ? baseNote.access.roles
                        : {}
                    if (currentUserUid && !remoteRoles[currentUserUid]) {
                        UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
                        this.removeSharedEntry(id, { removeRemote: true })
                        return
                    }
                    const sharedNote = {
                        ...baseNote,
                        id: CollaborationService.sharedNoteId(entry.ownerUid, entry.noteId),
                        access: {
                            ownerUid: entry.ownerUid,
                            ownerCollection: "users",
                            noteId: entry.noteId,
                            shareId: id,
                            roles: {
                                ...remoteRoles,
                                ...(currentUserUid ? { [currentUserUid]: entry.permission } : {})
                            }
                        }
                    }
                    this.sharedNotes.set(id, sharedNote)
                    this.updateNotesState()
                    if (this.pendingShareEntryId === id) {
                        this.pendingShareEntryId = null
                        window.SmartNotesEditor?.openFromList?.(sharedNote)
                    }
                }, error => {
                    if (this.shouldIgnoreSharedError(error)) {
                        this.removeSharedEntry(id, { removeRemote: true })
                        return
                    }
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
