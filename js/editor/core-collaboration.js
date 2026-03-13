const resolveReference = (note, user) => {
    if (!db || !user || !note) return null
    if (typeof CollaborationService !== "undefined") return CollaborationService.getNoteReference(note, user)
    return DataPath.getUserNotesCollection(user)?.doc(note.id) || null
}

const buildSignature = (serializeEditorStateSnapshot, note) => serializeEditorStateSnapshot({
    ...note,
    title: String(note?.title || ""),
    content: String(note?.content || ""),
    tags: Array.isArray(note?.tags) ? note.tags.map(tag => String(tag || "")) : [],
    pageTitles: Array.isArray(note?.pageTitles) ? note.pageTitles.map(value => String(value || "")) : [],
    pageDrawings: Array.isArray(note?.pageDrawings) ? note.pageDrawings.map(value => String(value || "")) : []
})

export const createCollaborationHandlers = (context) => {
    const {
        state,
        serializeEditorStateSnapshot,
        applyRemoteNote,
        canEditNote
    } = context

    const stopRemoteSync = () => {
        if (state.remoteSync?.unsubscribe) state.remoteSync.unsubscribe()
        state.remoteSync = {
            unsubscribe: null,
            lastPushedSignature: "",
            lastRemoteSignature: ""
        }
    }

    const pushLocalNoteNow = async () => {
        const currentState = StateStore.read()
        const note = currentState.currentNote
        const user = currentState.user
        if (!note || !user || !canEditNote(note)) return
        const ref = resolveReference(note, user)
        if (!ref) return
        const access = typeof CollaborationService === "undefined" ? null : CollaborationService.getAccess(note)
        const payload = window.NoteHelpers.buildNotePayload({ note, user, access })
        const signature = buildSignature(serializeEditorStateSnapshot, payload)
        if (signature === state.remoteSync.lastPushedSignature) return
        await ref.set({ ...payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
        state.remoteSync.lastPushedSignature = signature
    }

    const pushLocalNoteDebounced = Utils.debounce(() => {
        pushLocalNoteNow().catch(() => {})
    }, 700)

    const syncLocalNote = () => {
        pushLocalNoteDebounced()
    }

    const startRemoteSync = (note) => {
        stopRemoteSync()
        const user = StateStore.read().user
        const ref = resolveReference(note, user)
        if (!ref) return
        state.remoteSync.unsubscribe = ref.onSnapshot(snapshot => {
            if (!snapshot.exists) return
            const remoteNote = NoteIO.normalizeNote({ id: snapshot.id, ...snapshot.data() })
            const remoteSignature = buildSignature(serializeEditorStateSnapshot, remoteNote)
            if (remoteSignature === state.remoteSync.lastPushedSignature) return
            const currentNote = StateStore.read().currentNote
            if (!currentNote) return
            const currentSignature = buildSignature(serializeEditorStateSnapshot, currentNote)
            if (remoteSignature === currentSignature || remoteSignature === state.remoteSync.lastRemoteSignature) return
            state.remoteSync.lastRemoteSignature = remoteSignature
            applyRemoteNote(remoteNote)
        })
    }

    return {
        startRemoteSync,
        stopRemoteSync,
        syncLocalNote,
        pushLocalNoteNow
    }
}
