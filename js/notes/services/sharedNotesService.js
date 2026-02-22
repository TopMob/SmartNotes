const SharedNotesService = (() => {
    const state = { user: null, unsubscribeEntries: null, sharedEntries: new Map(), sharedNotes: new Map(), sharedNoteUnsubscribers: new Map() }
    function shouldIgnoreSharedError(error) {
        const code = String(error?.code || "")
        return code === "permission-denied" || code === "failed-precondition"
    }
    function removeSharedEntry(sharedId) {
        const unsubscribeNote = state.sharedNoteUnsubscribers.get(sharedId)
        if (unsubscribeNote) unsubscribeNote()
        state.sharedNoteUnsubscribers.delete(sharedId)
        state.sharedEntries.delete(sharedId)
        state.sharedNotes.delete(sharedId)
    }
    function updateEntries(nextEntries, onChange) {
        const removedIds = []
        state.sharedEntries.forEach((entry, sharedId) => {
            if (!nextEntries.has(sharedId)) removedIds.push(sharedId)
        })
        removedIds.forEach(removeSharedEntry)
        nextEntries.forEach((entry, sharedId) => {
            if (!entry.permission) {
                removeSharedEntry(sharedId)
                return
            }
            if (state.sharedEntries.has(sharedId)) return
            state.sharedEntries.set(sharedId, entry)
            const unsubscribeNote = NotesRepository.subscribeSharedNote(entry.ownerUid, entry.noteId, noteSnapshot => {
                if (!noteSnapshot.exists) {
                    removeSharedEntry(sharedId)
                    onChange(new Map(state.sharedNotes))
                    return
                }
                const normalizedNote = NoteIO.normalizeNote({ id: entry.noteId, ...noteSnapshot.data() })
                const currentUserUid = state.user?.uid || ""
                const roles = normalizedNote.access?.roles && typeof normalizedNote.access.roles === "object" ? normalizedNote.access.roles : {}
                if (currentUserUid && !roles[currentUserUid]) {
                    removeSharedEntry(sharedId)
                    onChange(new Map(state.sharedNotes))
                    return
                }
                state.sharedNotes.set(sharedId, {
                    ...normalizedNote,
                    id: CollaborationService.sharedNoteId(entry.ownerUid, entry.noteId),
                    access: { ownerUid: entry.ownerUid, ownerCollection: "users", noteId: entry.noteId, shareId: sharedId, roles: { ...roles, ...(currentUserUid ? { [currentUserUid]: entry.permission } : {}) } }
                })
                onChange(new Map(state.sharedNotes))
            }, error => {
                if (shouldIgnoreSharedError(error)) {
                    removeSharedEntry(sharedId)
                    onChange(new Map(state.sharedNotes))
                    return
                }
                console.error("Shared note sync error", error)
            })
            state.sharedNoteUnsubscribers.set(sharedId, unsubscribeNote)
        })
        onChange(new Map(state.sharedNotes))
    }
    function subscribe(user, onChange) {
        state.user = user
        if (state.unsubscribeEntries) state.unsubscribeEntries()
        state.unsubscribeEntries = NotesRepository.subscribeSharedEntries(user, snapshot => {
            const entries = new Map()
            snapshot.forEach(documentEntry => {
                const entry = documentEntry.data() || {}
                entries.set(documentEntry.id, { id: documentEntry.id, noteId: entry.noteId, ownerUid: entry.ownerUid, permission: entry.permission || "viewer" })
            })
            updateEntries(entries, onChange)
        }, error => console.error("Shared sync error", error))
    }
    function clear() {
        if (state.unsubscribeEntries) state.unsubscribeEntries()
        state.unsubscribeEntries = null
        state.sharedNoteUnsubscribers.forEach(unsubscribe => unsubscribe())
        state.sharedNoteUnsubscribers.clear()
        state.sharedEntries.clear()
        state.sharedNotes.clear()
        state.user = null
    }
    return { subscribe, clear }
})()
