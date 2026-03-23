const SharedFoldersService = (() => {
    const state = {
        user: null,
        unsubscribeEntries: null,
        sharedEntries: new Map(),
        sharedFolders: new Map(),
        sharedFolderUnsubscribers: new Map(),
        sharedFolderNotes: new Map(),
        sharedFolderNotesUnsubscribers: new Map()
    }

    function shouldIgnoreSharedError(error) {
        const code = String(error?.code || "")
        return code === "permission-denied" || code === "failed-precondition" || code === "not-found"
    }

    function publishSharedFolders() {
        EventBus.publish("sharedFoldersUpdated", [...state.sharedFolders.values()])
    }

    function publishSharedFolderNotes() {
        const sharedNotes = []
        state.sharedFolderNotes.forEach(notesMap => {
            notesMap.forEach(note => sharedNotes.push(note))
        })
        EventBus.publish("sharedFolderNotesUpdated", sharedNotes)
    }

    function removeFolderMapping(entry) {
        if (!entry?.ownerUid || !entry?.folderId) return
        CollaborationService.unregisterSharedFolder(entry.ownerUid, entry.folderId)
    }

    function removeSharedEntry(sharedId) {
        const entry = state.sharedEntries.get(sharedId)
        removeFolderMapping(entry)
        const unsubscribeFolder = state.sharedFolderUnsubscribers.get(sharedId)
        if (unsubscribeFolder) unsubscribeFolder()
        const unsubscribeFolderNotes = state.sharedFolderNotesUnsubscribers.get(sharedId)
        if (unsubscribeFolderNotes) unsubscribeFolderNotes()
        state.sharedFolderUnsubscribers.delete(sharedId)
        state.sharedFolderNotesUnsubscribers.delete(sharedId)
        state.sharedEntries.delete(sharedId)
        state.sharedFolders.delete(sharedId)
        state.sharedFolderNotes.delete(sharedId)
    }

    function normalizeSharedFolder(sharedId, entry, folderData) {
        const currentUserUid = state.user?.uid || ""
        const sharedFolderId = CollaborationService.sharedFolderId(entry.ownerUid, entry.folderId)
        CollaborationService.registerSharedFolder(entry.ownerUid, entry.folderId, sharedFolderId)
        return {
            id: sharedFolderId,
            sourceFolderId: entry.folderId,
            ownerUid: entry.ownerUid,
            name: String(folderData?.name || ""),
            description: String(folderData?.description || ""),
            isHidden: false,
            trashedAt: folderData?.trashedAt || null,
            folderOrder: typeof folderData?.folderOrder === "number" ? folderData.folderOrder : 0,
            createdAt: folderData?.createdAt || null,
            updatedAt: folderData?.updatedAt || null,
            access: {
                ownerUid: entry.ownerUid,
                ownerCollection: "users",
                folderId: entry.folderId,
                shareId: sharedId,
                roles: {
                    [entry.ownerUid]: "owner",
                    ...(currentUserUid ? { [currentUserUid]: entry.permission } : {})
                }
            }
        }
    }

    function normalizeSharedFolderNote(entry, noteId, noteData) {
        const currentUserUid = state.user?.uid || ""
        return NoteIO.normalizeNote({
            id: CollaborationService.sharedNoteId(entry.ownerUid, noteId),
            ...noteData,
            folderId: CollaborationService.sharedFolderId(entry.ownerUid, entry.folderId),
            ownerUid: entry.ownerUid,
            access: {
                ownerUid: entry.ownerUid,
                ownerCollection: "users",
                noteId,
                folderId: entry.folderId,
                shareId: entry.id,
                roles: {
                    [entry.ownerUid]: "owner",
                    ...(currentUserUid ? { [currentUserUid]: entry.permission } : {})
                }
            }
        })
    }

    function subscribeSharedFolder(sharedId, entry) {
        const unsubscribeFolder = FoldersRepository.subscribeSharedFolder(entry.ownerUid, entry.folderId, folderSnapshot => {
            if (!folderSnapshot.exists) {
                removeSharedEntry(sharedId)
                publishSharedFolders()
                publishSharedFolderNotes()
                return
            }
            state.sharedFolders.set(sharedId, normalizeSharedFolder(sharedId, entry, folderSnapshot.data() || {}))
            publishSharedFolders()
        }, error => {
            if (shouldIgnoreSharedError(error)) {
                removeSharedEntry(sharedId)
                publishSharedFolders()
                publishSharedFolderNotes()
                return
            }
            EventBus.publish("foldersSyncError", error)
        })
        state.sharedFolderUnsubscribers.set(sharedId, unsubscribeFolder)
    }

    function subscribeSharedFolderNotes(sharedId, entry) {
        const unsubscribeFolderNotes = NotesRepository.subscribeSharedFolderNotes(entry.ownerUid, entry.folderId, snapshot => {
            const notesMap = new Map()
            snapshot.forEach(documentEntry => {
                const note = normalizeSharedFolderNote(entry, documentEntry.id, documentEntry.data() || {})
                notesMap.set(note.id, note)
            })
            state.sharedFolderNotes.set(sharedId, notesMap)
            publishSharedFolderNotes()
        }, error => {
            if (shouldIgnoreSharedError(error)) {
                removeSharedEntry(sharedId)
                publishSharedFolders()
                publishSharedFolderNotes()
                return
            }
            EventBus.publish("sharedSyncError", error)
        })
        state.sharedFolderNotesUnsubscribers.set(sharedId, unsubscribeFolderNotes)
    }

    function updateEntries(nextEntries) {
        const removedIds = []
        state.sharedEntries.forEach((entry, sharedId) => {
            if (!nextEntries.has(sharedId)) removedIds.push(sharedId)
        })
        removedIds.forEach(removeSharedEntry)
        nextEntries.forEach((entry, sharedId) => {
            if (!entry.permission || !entry.ownerUid || !entry.folderId) {
                removeSharedEntry(sharedId)
                return
            }
            if (state.sharedEntries.has(sharedId)) return
            state.sharedEntries.set(sharedId, entry)
            subscribeSharedFolder(sharedId, entry)
            subscribeSharedFolderNotes(sharedId, entry)
        })
        publishSharedFolders()
        publishSharedFolderNotes()
    }

    function subscribe(user) {
        state.user = user
        if (state.unsubscribeEntries) state.unsubscribeEntries()
        state.unsubscribeEntries = FoldersRepository.subscribeSharedEntries(user, snapshot => {
            const entries = new Map()
            snapshot.forEach(documentEntry => {
                const entry = documentEntry.data() || {}
                entries.set(documentEntry.id, {
                    id: documentEntry.id,
                    ownerUid: String(entry.ownerUid || ""),
                    folderId: String(entry.folderId || ""),
                    permission: entry.permission === "editor" ? "editor" : "viewer"
                })
            })
            updateEntries(entries)
        }, error => {
            if (shouldIgnoreSharedError(error)) {
                state.sharedEntries.forEach(entry => removeFolderMapping(entry))
                state.sharedEntries.clear()
                state.sharedFolders.clear()
                state.sharedFolderNotes.clear()
                publishSharedFolders()
                publishSharedFolderNotes()
                return
            }
            EventBus.publish("foldersSyncError", error)
        })
    }

    function clear() {
        if (state.unsubscribeEntries) state.unsubscribeEntries()
        state.unsubscribeEntries = null
        state.sharedEntries.forEach(entry => removeFolderMapping(entry))
        state.sharedFolderUnsubscribers.forEach(unsubscribe => unsubscribe())
        state.sharedFolderNotesUnsubscribers.forEach(unsubscribe => unsubscribe())
        state.sharedFolderUnsubscribers.clear()
        state.sharedFolderNotesUnsubscribers.clear()
        state.sharedEntries.clear()
        state.sharedFolders.clear()
        state.sharedFolderNotes.clear()
        state.user = null
    }

    return { subscribe, clear }
})()
