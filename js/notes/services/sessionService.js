const SessionService = (() => {
    const state = { activeUid: null, sessionStartPromise: null, foldersUnsubscribe: null, ownedNotes: [], sharedNotes: [] }
    function sortFolders(folders) {
        return [...folders].sort((firstFolder, secondFolder) => {
            const firstCreatedAt = firstFolder?.createdAt?.toDate ? firstFolder.createdAt.toDate().getTime() : Date.parse(firstFolder?.createdAt || "") || 0
            const secondCreatedAt = secondFolder?.createdAt?.toDate ? secondFolder.createdAt.toDate().getTime() : Date.parse(secondFolder?.createdAt || "") || 0
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            return String(firstFolder?.name || "").localeCompare(String(secondFolder?.name || ""), StateStore.read().config.lang || "ru")
        })
    }
    function publishNotesState() {
        const ownedNotes = OwnedNotesService.getNotes()
        const sharedNotes = state.sharedNotes
        const notes = NotesStorage.applyStoredFavorites([...ownedNotes, ...sharedNotes])
        StateStore.update("notes", notes)
        if (state.activeUid) NotesStorage.writeCachedNotes(state.activeUid, notes)
        NotesStorage.syncFavoritesStorage(notes)
    }
    function applySharedNotes(sharedNotesMap) {
        state.sharedNotes = [...sharedNotesMap.values()]
        publishNotesState()
    }
    function stopUserSession() {
        if (state.foldersUnsubscribe) state.foldersUnsubscribe()
        state.foldersUnsubscribe = null
        SettingsSyncService.clear()
        OwnedNotesService.clear()
        SharedNotesService.clear()
        state.activeUid = null
        state.ownedNotes = []
        state.sharedNotes = []
        StateStore.resetSession()
    }
    async function startUserSession(user, options = {}) {
        if (!user?.uid) return
        const userIdentifier = String(user.uid)
        if (!options.forceResubscribe && state.activeUid === userIdentifier && state.sessionStartPromise) return state.sessionStartPromise
        state.activeUid = userIdentifier
        state.sessionStartPromise = (async () => {
            StateActions.setUser(user)
            await DataPath.ensureUserDocument(user)
            await SettingsSyncService.initialize(user)
            OwnedNotesService.subscribe(user, () => publishNotesState(), error => console.error("Notes sync error", error))
            const cachedNotes = NotesStorage.readCachedNotes(user.uid)
            if (cachedNotes.length) {
                StateStore.update("notes", NotesStorage.applyStoredFavorites(cachedNotes))
            }
            if (state.foldersUnsubscribe) state.foldersUnsubscribe()
            state.foldersUnsubscribe = FoldersRepository.subscribeFolders(user, snapshot => {
                const folders = sortFolders(snapshot.docs.map(documentEntry => ({ id: documentEntry.id, ...documentEntry.data() })))
                StateStore.update("folders", folders)
            }, error => console.error("Folders sync error", error))
            SharedNotesService.subscribe(user, applySharedNotes)
RemindersService.start()
            return true
        })()
        return state.sessionStartPromise
    }
    async function loadMoreOwnedNotes() {
        await OwnedNotesService.loadMore()
        publishNotesState()
    }
    return { startUserSession, stopUserSession, loadMoreOwnedNotes }
})()
