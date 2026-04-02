const NotesAggregationService = (() => {
    function aggregate(ownedNotes, sharedNotes, workspaceNotes, activeUid) {
        const mergedNotes = NotesStorage.applyStoredFavorites([...(ownedNotes || []), ...(sharedNotes || []), ...(workspaceNotes || [])])
        if (activeUid) NotesStorage.writeCachedNotes(activeUid, mergedNotes)
        NotesStorage.syncFavoritesStorage(mergedNotes)
        return mergedNotes
    }
    return { aggregate }
})()

