const SessionService = (() => {
    const state = {
        activeUid: null,
        sessionStartPromise: null,
        foldersUnsubscribe: null,
        ownedNotes: [],
        sharedNotes: [],
        sharedFolderNotes: [],
        ownedFolders: [],
        sharedFolders: []
    }

    function sortFolders(folders) {
        return [...folders].sort((firstFolder, secondFolder) => {
            const firstCreatedAt = firstFolder?.createdAt?.toDate ? firstFolder.createdAt.toDate().getTime() : Date.parse(firstFolder?.createdAt || "") || 0
            const secondCreatedAt = secondFolder?.createdAt?.toDate ? secondFolder.createdAt.toDate().getTime() : Date.parse(secondFolder?.createdAt || "") || 0
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            return String(firstFolder?.name || "").localeCompare(String(secondFolder?.name || ""), StateStore.read().config.lang || "ru")
        })
    }

    function publishNotes() {
        const aggregatedNotes = NotesAggregationService.aggregate([...state.ownedNotes], [...state.sharedNotes, ...state.sharedFolderNotes], state.activeUid)
        StateStore.update("notes", aggregatedNotes)
    }

    function publishFolders() {
        StateStore.update("folders", sortFolders([...state.ownedFolders, ...state.sharedFolders]))
    }

    function bindAggregation() {
        EventBus.subscribe("ownedNotesUpdated", ownedNotes => {
            state.ownedNotes = Array.isArray(ownedNotes) ? ownedNotes : []
            publishNotes()
        })
        EventBus.subscribe("sharedNotesUpdated", sharedNotes => {
            state.sharedNotes = Array.isArray(sharedNotes) ? sharedNotes : []
            publishNotes()
        })
        EventBus.subscribe("sharedFolderNotesUpdated", sharedFolderNotes => {
            state.sharedFolderNotes = Array.isArray(sharedFolderNotes) ? sharedFolderNotes : []
            publishNotes()
        })
        EventBus.subscribe("sharedFoldersUpdated", sharedFolders => {
            state.sharedFolders = Array.isArray(sharedFolders) ? sharedFolders : []
            publishFolders()
        })
    }

    bindAggregation()

    function stopUserSession() {
        if (state.foldersUnsubscribe) state.foldersUnsubscribe()
        state.foldersUnsubscribe = null
        SettingsSyncService.clear()
        OwnedNotesService.clear()
        SharedNotesService.clear()
        SharedFoldersService.clear()
        RemindersService.stop()
        state.activeUid = null
        state.ownedNotes = []
        state.sharedNotes = []
        state.sharedFolderNotes = []
        state.ownedFolders = []
        state.sharedFolders = []
        StateStore.resetSession()
    }

    async function startUserSession(user, options = {}) {
        console.info("[Session] startUserSession begin", user?.uid || "")
        if (!user?.uid) return
        const userIdentifier = String(user.uid)
        if (!options.forceResubscribe && state.activeUid === userIdentifier && state.sessionStartPromise) return state.sessionStartPromise
        state.activeUid = userIdentifier
        state.sessionStartPromise = (async () => {
            try {
                StateActions.setUser(user)
                await DataPath.ensureUserDocument(user)
                await SettingsSyncService.initialize(user)
                OwnedNotesService.subscribe(user)
                const cachedNotes = NotesStorage.readCachedNotes(user.uid)
                if (cachedNotes.length) {
                    StateStore.update("notes", NotesStorage.applyStoredFavorites(cachedNotes))
                }
                if (state.foldersUnsubscribe) state.foldersUnsubscribe()
                state.foldersUnsubscribe = FoldersRepository.subscribeFolders(user, snapshot => {
                    state.ownedFolders = sortFolders(snapshot.docs.map(documentEntry => ({ id: documentEntry.id, ...documentEntry.data() })))
                    publishFolders()
                }, error => EventBus.publish("foldersSyncError", error))
                SharedNotesService.subscribe(user)
                SharedFoldersService.subscribe(user)
                RemindersService.start()
                return true
            } catch (error) {
                console.error("[Session] error", { code: error?.code || "", message: error?.message || String(error || ""), stack: error?.stack || "" })
                EventBus.publish("notesLoadFailed", error)
                throw error
            }
        })()
        return state.sessionStartPromise
    }

    return { startUserSession, stopUserSession }
})()
