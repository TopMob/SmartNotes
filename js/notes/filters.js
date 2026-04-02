function updateSearchQuery(query) {
    const queryValue = String(query || "")
    if (StateStore.read().searchQuery === queryValue) return
    StateStore.update("searchQuery", queryValue)
}

function switchView(view, folderId = null, sharedWorkspaceId = null) {
    const currentState = StateStore.read()
    const nextView = String(view || "notes")
    const nextFolderId = nextView === "folder" ? folderId : null
    const nextWorkspaceId = nextView === "shared_workspace" ? sharedWorkspaceId : null
    if (currentState.view === nextView && currentState.activeFolderId === nextFolderId && currentState.activeSharedWorkspaceId === nextWorkspaceId) return
    if (nextView === "admin_tools" && !(UI.hasSmartNotesFolderAccess && UI.hasSmartNotesFolderAccess())) return
    StateStore.set(previousState => ({ ...previousState, view: nextView, activeFolderId: nextFolderId, activeSharedWorkspaceId: nextWorkspaceId }))
}

function getLockedNotes() {
    const currentState = StateStore.read()
    return (currentState.notes || []).filter(note => !!(note && note.lock && note.lock.hidden))
}

