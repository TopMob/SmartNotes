const NotesRepository = (() => {
    function getCollection(user) {
        return DataPath.getUserNotesCollection(user)
    }
    function subscribeOwnedNotes(user, options, next, error) {
        const collection = getCollection(user)
        if (!collection) return () => {}
        let query = collection.limit(options?.pageSize || 500)
        if (options.startAfterDocument) query = query.startAfter(options.startAfterDocument)
        return query.onSnapshot(next, error)
    }
    async function loadMoreOwnedNotes(user, options) {
        const collection = getCollection(user)
        if (!collection || !options.startAfterDocument) return { documents: [], lastDocument: null }
        const snapshot = await collection.startAfter(options.startAfterDocument).limit(options?.pageSize || 500).get()
        return { documents: snapshot.docs, lastDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : options.startAfterDocument }
    }
    function subscribeSharedEntries(user, next, error) {
        const collection = DataPath.getUserSharedCollection(user, "sharedNotes")
        if (!collection) return () => {}
        return collection.onSnapshot(next, error)
    }
    function subscribeSharedNote(ownerUid, noteId, next, error) {
        return db.collection("users").doc(ownerUid).collection("notes").doc(noteId).onSnapshot(next, error)
    }
    return { subscribeOwnedNotes, loadMoreOwnedNotes, subscribeSharedEntries, subscribeSharedNote }
})()
