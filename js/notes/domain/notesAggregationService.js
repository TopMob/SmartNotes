const NotesAggregationService = (() => {
    function aggregate(ownedNotes, sharedNotes, activeUid) {
        const mergedMap = new Map()
        ;[...(ownedNotes || []), ...(sharedNotes || [])].forEach(note => {
            if (!note?.id) return
            if (!mergedMap.has(note.id)) mergedMap.set(note.id, note)
            else mergedMap.set(note.id, { ...mergedMap.get(note.id), ...note })
        })
        const mergedNotes = NotesStorage.applyStoredFavorites([...mergedMap.values()])
        if (activeUid) NotesStorage.writeCachedNotes(activeUid, mergedNotes)
        NotesStorage.syncFavoritesStorage(mergedNotes)
        return mergedNotes
    }
    return { aggregate }
})()
