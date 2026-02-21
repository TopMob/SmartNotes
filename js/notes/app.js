const AppLifecycle = {
    initialized: false,
    activeUid: null,
    foldersUnsubscribe: null,
    notesUnsubscribe: null,
    ownedNotes: [],
    sharedNotes: new Map(),
    sharedEntries: new Map(),
    sharedUnsub: null,
    sharedNoteUnsubs: new Map(),
    pendingShareEntryId: null,
    sharedSyncEnabled: true,
    reminderTimers: new Map(),
    networkListenersBound: false,
    networkRetryTimer: null,
    sessionStartPromise: null,
    notesPageSize: 100,
    hasMoreOwnedNotes: false,
    loadingMoreOwnedNotes: false,
    lastOwnedNoteDocument: null,
    notesRenderStep: 10,
    visibleNotesLimit: 10,
    totalVisibleNotesCount: 0,
    renderedVisibleNotesCount: 0,
    settingsUnsubscribe: null,
    settingsReference: null,
    settingsStorageType: "settings",
    createDefaultUserSettings() {
        const cachedThemeSettings = ThemeManager.getSavedSettings()
        return {
            notesPerPage: 10,
            themeId: cachedThemeSettings.preset || "oled",
            customTheme: {
                p: cachedThemeSettings.p || ThemeManager.themes.oled.p,
                bg: cachedThemeSettings.bg || ThemeManager.themes.oled.bg,
                t: cachedThemeSettings.t || ThemeManager.themes.oled.t,
                mainBackgroundImage: cachedThemeSettings.mainBackgroundImage || "",
                sidebarBackgroundImage: cachedThemeSettings.sidebarBackgroundImage || "",
                uiOpacity: typeof cachedThemeSettings.uiOpacity === "number" ? cachedThemeSettings.uiOpacity : 0.78,
                cardsOpacity: typeof cachedThemeSettings.cardsOpacity === "number" ? cachedThemeSettings.cardsOpacity : 0.9
            },
            backgroundType: cachedThemeSettings.mainBackgroundImage ? "image" : "none",
            backgroundValue: cachedThemeSettings.mainBackgroundImage || "",
            lang: StateStore.read().config.lang || "ru",
            folderViewMode: StateStore.read().config.folderViewMode || "compact",
            reduceMotion: !!StateStore.read().config.reduceMotion,
            customPresets: ThemeManager.getCustomPresets(),
            schemaVersion: 1
        }
    },
    normalizeUserSettings(rawSettings) {
        const defaults = this.createDefaultUserSettings()
        const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {}
        const notesPerPageOptions = new Set([5, 10, 20, 50])
        const parsedNotesPerPage = Number(source.notesPerPage)
        const notesPerPage = notesPerPageOptions.has(parsedNotesPerPage) ? parsedNotesPerPage : defaults.notesPerPage
        const customThemeSource = source.customTheme && typeof source.customTheme === "object" ? source.customTheme : defaults.customTheme
        const customPresets = Array.isArray(source.customPresets) ? source.customPresets : []
        return {
            notesPerPage,
            themeId: typeof source.themeId === "string" && source.themeId ? source.themeId : defaults.themeId,
            customTheme: customThemeSource,
            backgroundType: typeof source.backgroundType === "string" && source.backgroundType ? source.backgroundType : defaults.backgroundType,
            backgroundValue: typeof source.backgroundValue === "string" ? source.backgroundValue : defaults.backgroundValue,
            lang: source.lang === "en" ? "en" : "ru",
            folderViewMode: source.folderViewMode === "full" ? "full" : "compact",
            reduceMotion: !!source.reduceMotion,
            customPresets: customPresets,
            schemaVersion: 1
        }
    },
    cloneUserSettings(settings) {
        return JSON.parse(JSON.stringify(settings || this.createDefaultUserSettings()))
    },
    getUserSettingsCacheKey(uid) {
        return `user-settings-cache:${String(uid || "")}`
    },
    readCachedUserSettings(uid) {
        return SafeStorage.local.getJson(this.getUserSettingsCacheKey(uid), null)
    },
    writeCachedUserSettings(uid, settings) {
        SafeStorage.local.setJson(this.getUserSettingsCacheKey(uid), settings)
    },
    applyUserSettingsToRuntime(userSettings, options = {}) {
        const normalizedSettings = this.normalizeUserSettings(userSettings)
        const normalizedTheme = {
            preset: normalizedSettings.themeId,
            ...(normalizedSettings.customTheme || {})
        }
        if (Array.isArray(normalizedSettings.customPresets) && normalizedSettings.customPresets.length > 0) {
            ThemeManager.saveCustomPresets(normalizedSettings.customPresets)
        }
        ThemeManager.applySettings(normalizedTheme, true)
        StateActions.updateConfig({
            lang: normalizedSettings.lang,
            folderViewMode: normalizedSettings.folderViewMode,
            reduceMotion: normalizedSettings.reduceMotion
        })
        UI.applyLangToDom()
        UI.updateViewTitle()
        UI.updatePrimaryActionLabel()
        UI.renderFolders()
        this.notesRenderStep = normalizedSettings.notesPerPage
        if (options.resetVisibleLimit) {
            this.visibleNotesLimit = this.notesRenderStep
        } else {
            this.visibleNotesLimit = Math.max(this.notesRenderStep, Number(this.visibleNotesLimit) || this.notesRenderStep)
        }
        this.updateLoadMoreButton()
        filterAndRender(document.getElementById("search-input")?.value || "")
    },
    updateOriginalUserSettings(userSettings) {
        const normalizedSettings = this.normalizeUserSettings(userSettings)
        StateStore.update("originalUserSettings", this.cloneUserSettings(normalizedSettings))
    },
    isPermissionDeniedError(error) {
        return String(error?.code || "") === "permission-denied"
    },
    async resolveUserSettingsReference(user) {
        const primaryReference = DataPath.getUserSettingsReference(user)
        const fallbackReference = DataPath.getUserLegacySettingsReference(user)
        if (primaryReference) {
            try {
                const snapshot = await primaryReference.get()
                this.settingsStorageType = "settings"
                return { reference: primaryReference, snapshot }
            } catch (error) {
                if (!this.isPermissionDeniedError(error) || !fallbackReference) throw error
            }
        }
        if (!fallbackReference) return { reference: null, snapshot: null }
        const fallbackSnapshot = await fallbackReference.get()
        this.settingsStorageType = "preferences"
        return { reference: fallbackReference, snapshot: fallbackSnapshot }
    },
    async writeUserSettingsToReference(settingsReference, normalizedSettings) {
        if (!settingsReference) return
        await settingsReference.set({
            ...normalizedSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
    },
    async saveUserSettings(settingsToSave) {
        const user = StateStore.read().user
        if (!user) return null
        const normalizedSettings = this.normalizeUserSettings(settingsToSave)
        const activeSettingsReference = this.settingsReference || (await this.resolveUserSettingsReference(user)).reference
        if (!activeSettingsReference) return null
        try {
            await this.writeUserSettingsToReference(activeSettingsReference, normalizedSettings)
            this.settingsReference = activeSettingsReference
        } catch (error) {
            if (!this.isPermissionDeniedError(error)) throw error
            const fallbackReference = DataPath.getUserLegacySettingsReference(user)
            if (!fallbackReference) throw error
            await this.writeUserSettingsToReference(fallbackReference, normalizedSettings)
            this.settingsReference = fallbackReference
            this.settingsStorageType = "preferences"
        }
        this.writeCachedUserSettings(user.uid, normalizedSettings)
        this.updateOriginalUserSettings(normalizedSettings)
        return normalizedSettings
    },
    async initializeUserSettings(user) {
        const cachedSettings = this.readCachedUserSettings(user.uid)
        if (cachedSettings) {
            const normalizedCached = this.normalizeUserSettings(cachedSettings)
            this.updateOriginalUserSettings(normalizedCached)
            this.applyUserSettingsToRuntime(normalizedCached, { resetVisibleLimit: true })
        } else {
            const defaultSettings = this.createDefaultUserSettings()
            this.updateOriginalUserSettings(defaultSettings)
            this.applyUserSettingsToRuntime(defaultSettings, { resetVisibleLimit: true })
        }

        let resolvedReference = null
        let snapshot = null
        try {
            const resolved = await this.resolveUserSettingsReference(user)
            resolvedReference = resolved.reference
            snapshot = resolved.snapshot
        } catch (error) {
            console.error("Settings init error", error)
            return
        }
        if (!resolvedReference || !snapshot) return

        this.settingsReference = resolvedReference
        let loadedSettings = null
        if (!snapshot.exists) {
            loadedSettings = this.createDefaultUserSettings()
            await this.writeUserSettingsToReference(resolvedReference, loadedSettings)
        } else {
            loadedSettings = this.normalizeUserSettings(snapshot.data() || {})
        }

        this.writeCachedUserSettings(user.uid, loadedSettings)
        this.updateOriginalUserSettings(loadedSettings)
        this.applyUserSettingsToRuntime(loadedSettings, { resetVisibleLimit: true })

        if (this.settingsUnsubscribe) this.settingsUnsubscribe()
        this.settingsUnsubscribe = resolvedReference.onSnapshot(nextSnapshot => {
            if (!nextSnapshot.exists) return
            const incomingSettings = this.normalizeUserSettings(nextSnapshot.data() || {})
            const currentOriginalSettings = StateStore.read().originalUserSettings
            if (JSON.stringify(incomingSettings) === JSON.stringify(currentOriginalSettings || {})) return
            this.writeCachedUserSettings(user.uid, incomingSettings)
            this.updateOriginalUserSettings(incomingSettings)
            const settingsModal = document.getElementById("settings-modal")
            const isSettingsModalActive = !!settingsModal?.classList.contains("active")
            const isDraftDirty = typeof UI.isSettingsDirty === "function" ? UI.isSettingsDirty() : false
            if (!isSettingsModalActive || !isDraftDirty) {
                this.applyUserSettingsToRuntime(incomingSettings, { resetVisibleLimit: false })
                if (typeof UI.syncSettingsDraftFromOriginal === "function") UI.syncSettingsDraftFromOriginal()
                return
            }
            if (typeof UI.syncSettingsDraftFromOriginal === "function") UI.syncSettingsDraftFromOriginal()
        }, error => {
            if (this.isPermissionDeniedError(error)) return
            console.error("Settings sync error", error)
        })
    },
    normalizeDateValue(value) {
        if (window.NoteHelpers && typeof window.NoteHelpers.normalizeDateValue === "function") {
            return window.NoteHelpers.normalizeDateValue(value)
        }
        return 0
    },
    sortFolders(folders) {
        return [...folders].sort((firstFolder, secondFolder) => {
            const firstCreatedAt = this.normalizeDateValue(firstFolder?.createdAt)
            const secondCreatedAt = this.normalizeDateValue(secondFolder?.createdAt)
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            const firstTitle = String(firstFolder?.name || "")
            const secondTitle = String(secondFolder?.name || "")
            const languageCode = StateStore.read().config.lang || "ru"
            return firstTitle.localeCompare(secondTitle, languageCode)
        })
    },
    sortOwnedNotes(notes) {
        const shouldIgnoreUpdatedAt = !!StateStore.read().isEditing || !!StateStore.read().editorDirty
        return [...notes].sort((firstNote, secondNote) => {
            const firstOrder = Number.isFinite(firstNote?.order) ? firstNote.order : Number.POSITIVE_INFINITY
            const secondOrder = Number.isFinite(secondNote?.order) ? secondNote.order : Number.POSITIVE_INFINITY
            if (firstOrder !== secondOrder) return firstOrder - secondOrder
            const firstCreatedAt = this.normalizeDateValue(firstNote?.createdAt)
            const secondCreatedAt = this.normalizeDateValue(secondNote?.createdAt)
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            if (!shouldIgnoreUpdatedAt) {
                const firstUpdatedAt = this.normalizeDateValue(firstNote?.updatedAt)
                const secondUpdatedAt = this.normalizeDateValue(secondNote?.updatedAt)
                if (firstUpdatedAt !== secondUpdatedAt) return secondUpdatedAt - firstUpdatedAt
            }
            const languageCode = StateStore.read().config.lang || "ru"
            return String(firstNote?.id || "").localeCompare(String(secondNote?.id || ""), languageCode)
        })
    },
    scheduleReminders(notes) {
        this.reminderTimers.forEach(timer => clearTimeout(timer))
        this.reminderTimers.clear()
        notes.forEach(note => {
            const reminderAt = note?.reminderAt?.toDate ? note.reminderAt.toDate().getTime() : Date.parse(note?.reminderAt || "")
            if (!reminderAt || Number.isNaN(reminderAt)) return
            const delay = reminderAt - Date.now()
            if (delay <= 0 || delay > 2147483647) return
            const timer = setTimeout(() => {
                UI.showToast(`${UI.getText("reminder_note", "Reminder")}: ${note.title || UI.getText("untitled_note", "Untitled")}`)
                const notificationSupported = typeof window !== "undefined" && "Notification" in window
                if (notificationSupported && Notification.permission === "granted") {
                    new Notification(note.title || UI.getText("untitled_note", "Untitled"), { body: UI.getText("reminder_note", "Reminder") })
                }
            }, delay)
            this.reminderTimers.set(note.id, timer)
        })
        const notificationSupported = typeof window !== "undefined" && "Notification" in window
        if (notificationSupported && Notification.permission === "default") Notification.requestPermission().catch(() => null)
    },


    async initializeOnce() {
        if (this.initialized) return
        this.initialized = true
        window.SmartNotesEditor?.init()
        UI.init()
        UI.setLang(SafeStorage.local.get("app-lang") || "ru")
    },

    clearSubscriptions() {
        if (this.foldersUnsubscribe) this.foldersUnsubscribe()
        this.foldersUnsubscribe = null
        if (this.notesUnsubscribe) this.notesUnsubscribe()
        this.notesUnsubscribe = null
        if (this.sharedUnsub) this.sharedUnsub()
        this.sharedUnsub = null
        this.sharedNoteUnsubs.forEach(unsub => {
            if (unsub) unsub()
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
            if (unsub) unsub()
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
        this.hasMoreOwnedNotes = false
        this.loadingMoreOwnedNotes = false
        this.lastOwnedNoteDocument = null
        this.notesRenderStep = 10
        this.visibleNotesLimit = this.notesRenderStep
        this.totalVisibleNotesCount = 0
        if (this.settingsUnsubscribe) this.settingsUnsubscribe()
        this.settingsUnsubscribe = null
        this.settingsReference = null
        this.settingsStorageType = "settings"
        if (typeof ThemeManager !== "undefined" && typeof ThemeManager.resetLocalThemeCache === "function") {
            ThemeManager.resetLocalThemeCache()
        }
        StateStore.update("originalUserSettings", null)
        StateStore.update("draftUserSettings", null)
        this.renderedVisibleNotesCount = 0
        this.clearSubscriptions()
        this.updateLoadMoreButton()
    },
    applyFoldersSnapshot(snapshot) {
        const folders = this.sortFolders(snapshot.docs.map(documentEntry => {
            const folderData = documentEntry.data() || {}
            const normalizedDescription = window.Validators.validateFolderDescription(folderData.description)
            return {
                id: documentEntry.id,
                ...folderData,
                description: normalizedDescription == null ? "" : normalizedDescription
            }
        }))
        StateStore.update("folders", folders)
        UI.renderFolders()
        if (StateStore.read().view === "folders") {
            filterAndRender(document.getElementById("search-input")?.value || "")
        }
    },
    applyNotesSnapshot(snapshot) {
        const incomingNotes = snapshot.docs.map(documentEntry => ({ id: documentEntry.id, ...documentEntry.data() }))
        const incomingNoteIds = new Set(incomingNotes.map(note => String(note.id || "")))
        const preservedNotes = this.ownedNotes.filter(note => !incomingNoteIds.has(String(note.id || "")))
        this.ownedNotes = this.sortOwnedNotes([...incomingNotes, ...preservedNotes])
        this.lastOwnedNoteDocument = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null
        this.hasMoreOwnedNotes = snapshot.docs.length >= this.notesPageSize
        this.updateLoadMoreButton()
        this.updateNotesState()
    },

    getEffectiveTotalNotesCount() {
        return this.totalVisibleNotesCount + (this.hasMoreOwnedNotes ? 1 : 0)
    },
    getVisibleNotesForRender(notesList, activeView) {
        const normalizedList = Array.isArray(notesList) ? notesList : []
        const isNotesViewActive = String(activeView || "") === "notes"
        if (!isNotesViewActive) {
            this.totalVisibleNotesCount = normalizedList.length
            this.renderedVisibleNotesCount = normalizedList.length
            this.updateLoadMoreButton()
            return normalizedList
        }
        const safeLimit = Math.max(this.notesRenderStep, Number(this.visibleNotesLimit) || this.notesRenderStep)
        this.visibleNotesLimit = safeLimit
        this.totalVisibleNotesCount = normalizedList.length
        const slicedList = normalizedList.slice(0, safeLimit)
        this.renderedVisibleNotesCount = slicedList.length
        this.updateLoadMoreButton()
        return slicedList
    },
    updateLoadMoreButton() {
        const loadMoreButton = document.getElementById("load-more-notes-button")
        if (!loadMoreButton) return
        const isNotesViewActive = String(StateStore.read().view || "") === "notes"
        const totalNotesCount = this.getEffectiveTotalNotesCount()
        const shouldShowButton = !!this.activeUid && isNotesViewActive && this.renderedVisibleNotesCount < totalNotesCount
        loadMoreButton.classList.toggle("hidden", !shouldShowButton)
        loadMoreButton.disabled = this.loadingMoreOwnedNotes
    },
    async loadMoreOwnedNotes() {
        const activeView = String(StateStore.read().view || "")
        if (activeView !== "notes") {
            this.updateLoadMoreButton()
            return
        }

        const previousScrollContainer = document.getElementById("notes-content-area")
        const previousScrollTop = previousScrollContainer ? previousScrollContainer.scrollTop : 0

        if (this.renderedVisibleNotesCount < this.totalVisibleNotesCount) {
            this.visibleNotesLimit += this.notesRenderStep
            filterAndRender(document.getElementById("search-input")?.value || "")
            requestAnimationFrame(() => {
                if (previousScrollContainer) previousScrollContainer.scrollTop = previousScrollTop
            })
            return
        }

        if (!db || !this.activeUid || this.loadingMoreOwnedNotes || !this.lastOwnedNoteDocument || !this.hasMoreOwnedNotes) {
            this.updateLoadMoreButton()
            return
        }

        const user = StateStore.read().user
        if (!user) return
        const notesCollection = DataPath.getUserNotesCollection(user)
        if (!notesCollection) return

        this.visibleNotesLimit += this.notesRenderStep
        this.loadingMoreOwnedNotes = true
        this.updateLoadMoreButton()
        try {
            const nextSnapshot = await notesCollection
                .startAfter(this.lastOwnedNoteDocument)
                .limit(this.notesPageSize)
                .get()
            const nextNotes = nextSnapshot.docs.map(documentEntry => ({ id: documentEntry.id, ...documentEntry.data() }))
            if (nextNotes.length) {
                const existingIds = new Set(this.ownedNotes.map(note => String(note.id || "")))
                const uniqueNextNotes = nextNotes.filter(note => !existingIds.has(String(note.id || "")))
                this.ownedNotes = this.sortOwnedNotes([...this.ownedNotes, ...uniqueNextNotes])
                this.updateNotesState()
            }
            this.lastOwnedNoteDocument = nextSnapshot.docs.length ? nextSnapshot.docs[nextSnapshot.docs.length - 1] : this.lastOwnedNoteDocument
            this.hasMoreOwnedNotes = nextSnapshot.docs.length >= this.notesPageSize
        } catch (error) {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            console.error("Load more notes error", error)
        } finally {
            this.loadingMoreOwnedNotes = false
            this.updateLoadMoreButton()
            requestAnimationFrame(() => {
                if (previousScrollContainer) previousScrollContainer.scrollTop = previousScrollTop
            })
        }
    },

    subscribeCollection(options) {
        const { collectionReference, onSnapshotData, onSnapshotError } = options
        const unsubscribe = collectionReference.onSnapshot(onSnapshotData, error => {
            onSnapshotError(error)
        })
        return () => {
            if (unsubscribe) unsubscribe()
        }
    },

    handleOfflineMode() {
        UI.showToast(UI.getText("offline_mode", "Offline mode"))
    },
    handleOnlineMode() {
        UI.showToast(UI.getText("syncing", "Syncing"))
        const currentUser = StateStore.read().user
        if (!currentUser) return
        if (this.networkRetryTimer) clearTimeout(this.networkRetryTimer)
        this.networkRetryTimer = setTimeout(() => {
            this.startUserSession(currentUser, { forceResubscribe: true }).catch(() => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
            })
        }, 300)
    },
    async startUserSession(user, options = {}) {
        if (!db || !user) return
        const newUserUid = String(user.uid || "")
        if (!newUserUid) return
        if (this.activeUid === newUserUid && !options.forceResubscribe) return
        if (this.sessionStartPromise) return this.sessionStartPromise

        this.sessionStartPromise = (async () => {
            await this.initializeOnce()
        if (typeof CollaborationService !== "undefined") {
            CollaborationService.captureShareToken()
        }

        this.stopUserSession()
        this.activeUid = newUserUid

        const cachedNotes = NotesStorage.readCachedNotes(user.uid)
        if (cachedNotes.length) {
            this.ownedNotes = cachedNotes
            this.updateNotesState({ fromCache: true })
        }

        const userRootReference = await DataPath.ensureUserDocument(user)
        if (!userRootReference) {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            return
        }

        await this.initializeUserSettings(user)

        const userFoldersCollection = DataPath.getUserFoldersCollection(user)
        const userNotesCollection = DataPath.getUserNotesCollection(user)
        if (!userFoldersCollection || !userNotesCollection) {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            return
        }

        if (this.foldersUnsubscribe) {
            this.foldersUnsubscribe()
            this.foldersUnsubscribe = null
        }
        this.foldersUnsubscribe = this.subscribeCollection({
            collectionReference: userFoldersCollection,
            onSnapshotData: snapshot => {
                this.applyFoldersSnapshot(snapshot)
            },
            onSnapshotError: error => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
                console.error("Folders sync error", error)
            }
        })

        if (this.notesUnsubscribe) {
            this.notesUnsubscribe()
            this.notesUnsubscribe = null
        }
        this.notesUnsubscribe = this.subscribeCollection({
            collectionReference: userNotesCollection.limit(this.notesPageSize),
            onSnapshotData: snapshot => {
                this.applyNotesSnapshot(snapshot)
            },
            onSnapshotError: error => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
                console.error("Notes sync error", error)
            }
        })

        const loader = document.getElementById("app-loader")
        if (loader) loader.classList.add("hidden")

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

        const search = document.getElementById("search-input")
        if (search) search.value = ""

        switchView("notes")
        })()

        try {
            await this.sessionStartPromise
        } finally {
            this.sessionStartPromise = null
        }
    },
    updateNotesState(options = {}) {
        let notes = [...this.ownedNotes, ...this.sharedNotes.values()]
        notes = notes.map(note => {
            const normalizedNote = NoteIO.normalizeNote(note)
            if (note && note.access) normalizedNote.access = note.access
            return normalizedNote
        })
        notes = NotesStorage.applyStoredFavorites(notes)
        StateStore.update("notes", notes)
        if (this.activeUid && !options.fromCache) {
            NotesStorage.writeCachedNotes(this.activeUid, notes)
        }
        NotesStorage.syncFavoritesStorage(notes)
        this.scheduleReminders(notes)
        const state = StateStore.read()
        if (!state.isEditing && !state.isTyping) {
            this.syncOpenNote(notes)
        }
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
window.loadMoreNotes = () => AppLifecycle.loadMoreOwnedNotes()
window.getVisibleNotesForRender = (notesList, activeView) => AppLifecycle.getVisibleNotesForRender(notesList, activeView)
window.updateNotesLoadMoreButton = () => AppLifecycle.updateLoadMoreButton()
