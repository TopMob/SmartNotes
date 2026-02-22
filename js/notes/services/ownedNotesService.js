const OwnedNotesService = (() => {
    const state = { unsubscribe: null, user: null, notes: [] }
    function applySnapshot(snapshot) {
        const incomingNotes = snapshot.docs.map(documentEntry => NoteIO.normalizeNote({ id: documentEntry.id, ...documentEntry.data() }))
        state.notes = NotesSortingStrategy.sortOwnedNotes(incomingNotes, StateStore.read().config.lang || "ru")
        console.info("[Session] subscribe owned notes snapshot size=", state.notes.length)
        PaginationService.setOwnedPaginationInfo({ hasMoreOwnedNotes: snapshot.docs.length >= PaginationService.getOwnedPaginationInfo().pageSize, lastOwnedNoteDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null })
        EventBus.publish("ownedNotesUpdated", state.notes.slice())
    }
    async function loadMore() {
        if (!state.user) return
        const paginationInfo = PaginationService.getOwnedPaginationInfo()
        if (!paginationInfo.hasMoreOwnedNotes || paginationInfo.loadingMoreOwnedNotes) return
        PaginationService.setLoadingMoreOwnedNotes(true)
        try {
            const response = await NotesRepository.loadMoreOwnedNotes(state.user, { pageSize: paginationInfo.pageSize, startAfterDocument: paginationInfo.lastOwnedNoteDocument })
            const nextNotes = response.documents.map(documentEntry => NoteIO.normalizeNote({ id: documentEntry.id, ...documentEntry.data() }))
            const existingById = new Map(state.notes.map(note => [note.id, note]))
            nextNotes.forEach(note => existingById.set(note.id, note))
            state.notes = NotesSortingStrategy.sortOwnedNotes([...existingById.values()], StateStore.read().config.lang || "ru")
            PaginationService.setOwnedPaginationInfo({ hasMoreOwnedNotes: response.documents.length >= paginationInfo.pageSize, lastOwnedNoteDocument: response.lastDocument })
            EventBus.publish("ownedNotesUpdated", state.notes.slice())
        } finally {
            PaginationService.setLoadingMoreOwnedNotes(false)
            EventBus.publish("paginationUpdated", PaginationService.getLoadMoreState())
        }
    }
    function subscribe(user) {
        state.user = user
        if (state.unsubscribe) state.unsubscribe()
        console.info("[Session] subscribe owned notes begin")
        state.unsubscribe = NotesRepository.subscribeOwnedNotes(user, { pageSize: PaginationService.getOwnedPaginationInfo().pageSize }, applySnapshot, error => EventBus.publish("notesSyncError", error))
    }
    function clear() {
        if (state.unsubscribe) state.unsubscribe()
        state.unsubscribe = null
        state.user = null
        state.notes = []
    }
    function getNotes() {
        return state.notes.slice()
    }
    return { subscribe, clear, loadMore, getNotes }
})()
