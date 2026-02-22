const OwnedNotesService = (() => {
    const state = { unsubscribe: null, user: null, notes: [] }
    function normalizeDateValue(value) {
        if (!value) return 0
        if (typeof value === "number") return value
        if (typeof value === "string") {
            const parsedDate = Date.parse(value)
            return Number.isNaN(parsedDate) ? 0 : parsedDate
        }
        if (value.seconds) return value.seconds * 1000
        if (value.toDate) return value.toDate().getTime()
        return 0
    }
    function sortOwnedNotes(notes) {
        const shouldIgnoreUpdatedAt = !!StateStore.read().isEditing || !!StateStore.read().editorDirty
        return [...notes].sort((firstNote, secondNote) => {
            const firstOrder = Number.isFinite(firstNote?.order) ? firstNote.order : Number.POSITIVE_INFINITY
            const secondOrder = Number.isFinite(secondNote?.order) ? secondNote.order : Number.POSITIVE_INFINITY
            if (firstOrder !== secondOrder) return firstOrder - secondOrder
            const firstCreatedAt = normalizeDateValue(firstNote?.createdAt)
            const secondCreatedAt = normalizeDateValue(secondNote?.createdAt)
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            if (!shouldIgnoreUpdatedAt) {
                const firstUpdatedAt = normalizeDateValue(firstNote?.updatedAt)
                const secondUpdatedAt = normalizeDateValue(secondNote?.updatedAt)
                if (firstUpdatedAt !== secondUpdatedAt) return secondUpdatedAt - firstUpdatedAt
            }
            return String(firstNote?.id || "").localeCompare(String(secondNote?.id || ""), StateStore.read().config.lang || "ru")
        })
    }
    function applySnapshot(snapshot) {
        const incomingNotes = snapshot.docs.map(documentEntry => NoteIO.normalizeNote({ id: documentEntry.id, ...documentEntry.data() }))
        const existingNotesById = new Map(state.notes.map(note => [note.id, note]))
        const preservedNotes = state.notes.filter(note => !incomingNotes.find(incomingNote => incomingNote.id === note.id) && !incomingNotes.length)
        const merged = sortOwnedNotes([...incomingNotes, ...preservedNotes])
        state.notes = merged
        PaginationService.setOwnedPaginationInfo({ hasMoreOwnedNotes: snapshot.docs.length >= PaginationService.getOwnedPaginationInfo().pageSize, lastOwnedNoteDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null })
        return merged
    }
    async function loadMore() {
        if (!state.user) return []
        const paginationInfo = PaginationService.getOwnedPaginationInfo()
        if (!paginationInfo.hasMoreOwnedNotes || paginationInfo.loadingMoreOwnedNotes) return []
        PaginationService.setLoadingMoreOwnedNotes(true)
        try {
            const response = await NotesRepository.loadMoreOwnedNotes(state.user, { pageSize: paginationInfo.pageSize, startAfterDocument: paginationInfo.lastOwnedNoteDocument })
            const nextNotes = response.documents.map(documentEntry => NoteIO.normalizeNote({ id: documentEntry.id, ...documentEntry.data() }))
            const uniqueNotes = nextNotes.filter(nextNote => !state.notes.some(existingNote => existingNote.id === nextNote.id))
            state.notes = sortOwnedNotes([...state.notes, ...uniqueNotes])
            PaginationService.setOwnedPaginationInfo({ hasMoreOwnedNotes: response.documents.length >= paginationInfo.pageSize, lastOwnedNoteDocument: response.lastDocument })
            return state.notes
        } finally {
            PaginationService.setLoadingMoreOwnedNotes(false)
        }
    }
    function subscribe(user, next, error) {
        state.user = user
        if (state.unsubscribe) state.unsubscribe()
        state.unsubscribe = NotesRepository.subscribeOwnedNotes(user, { pageSize: PaginationService.getOwnedPaginationInfo().pageSize }, snapshot => next(applySnapshot(snapshot)), error)
    }
    function clear() { if (state.unsubscribe) state.unsubscribe(); state.unsubscribe = null; state.user = null; state.notes = [] }
    function getNotes() { return state.notes.slice() }
    return { subscribe, clear, loadMore, getNotes }
})()
