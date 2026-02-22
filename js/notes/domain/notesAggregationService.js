const NotesAggregationService = (() => {
    function aggregate(ownedNotes, sharedNotes, activeUid) {
        const mergedNotes = NotesStorage.applyStoredFavorites([...(ownedNotes || []), ...(sharedNotes || [])])
        if (activeUid) NotesStorage.writeCachedNotes(activeUid, mergedNotes)
        NotesStorage.syncFavoritesStorage(mergedNotes)
        return mergedNotes
    }
    return { aggregate }
})()
