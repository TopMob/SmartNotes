function updateSearchQuery(query) {
    const queryValue = String(query || "")
    if (StateStore.read().searchQuery === queryValue) return
    StateStore.update("searchQuery", queryValue)
}

function switchView(view, folderId = null) {
    const currentState = StateStore.read()
    const nextView = String(view || "notes")
    const nextFolderId = nextView === "folder" ? folderId : null
    if (currentState.view === nextView && currentState.activeFolderId === nextFolderId) return
    if (nextView === "admin_tools" && !(UI.hasSmartNotesFolderAccess && UI.hasSmartNotesFolderAccess())) return
    StateStore.set(previousState => ({ ...previousState, view: nextView, activeFolderId: nextFolderId }))
    document.querySelectorAll(".nav-item").forEach(button => {
        const viewIdentifier = button.dataset.view
        const folderIdentifier = button.dataset.folderId
        let isActive = false
        if (viewIdentifier) isActive = viewIdentifier === nextView
        else if (folderIdentifier) isActive = nextView === "folder" && folderIdentifier === nextFolderId
        button.classList.toggle("active", isActive)
    })
}

function getLockedNotes() {
    const currentState = StateStore.read()
    return (currentState.notes || []).filter(note => !!(note && note.lock && note.lock.hidden))
}
