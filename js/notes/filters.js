function getLockedNotes() {
    const currentState = StateStore.read()
    return (currentState.notes || []).filter(note => !!(note && note.lock && note.lock.hidden))
}

function getNormalizedViewState(stateSnapshot) {
    let nextView = stateSnapshot.view
    let nextActiveFolderId = stateSnapshot.activeFolderId
    if (nextView === "folder" && !nextActiveFolderId) {
        nextView = "notes"
        nextActiveFolderId = null
    }
    if (nextView === "hidden") {
        nextView = "notes"
        nextActiveFolderId = null
    }
    return {
        ...stateSnapshot,
        view: nextView,
        activeFolderId: nextActiveFolderId
    }
}

function filterAndRender(query) {
    const queryValue = String(query || "")
    const currentState = StateStore.read()
    if (currentState.searchQuery !== queryValue) {
        StateStore.update("searchQuery", queryValue)
    }

    const normalizedState = getNormalizedViewState(StateStore.read())
    if (normalizedState.view !== currentState.view || normalizedState.activeFolderId !== currentState.activeFolderId) {
        StateStore.set(previousState => ({
            ...previousState,
            view: normalizedState.view,
            activeFolderId: normalizedState.activeFolderId
        }))
    }

    const viewModel = NotesQueryService.execute(normalizedState, queryValue)
    NotesViewService.render(viewModel)
}

function switchView(view, folderId = null) {
    const currentState = StateStore.read()
    const nextView = String(view || "notes")
    const nextFolderId = nextView === "folder" ? folderId : null
    if (currentState.view === nextView && currentState.activeFolderId === nextFolderId) return
    if (nextView === "admin_tools" && !(typeof UI !== "undefined" && UI.hasSmartNotesFolderAccess && UI.hasSmartNotesFolderAccess())) return

    StateStore.set(previousState => ({ ...previousState, view: nextView, activeFolderId: nextFolderId }))

    document.querySelectorAll(".nav-item").forEach(button => {
        const viewIdentifier = button.dataset.view
        const folderIdentifier = button.dataset.folderId
        let isActive = false
        if (viewIdentifier) isActive = viewIdentifier === nextView
        else if (folderIdentifier) isActive = nextView === "folder" && folderIdentifier === nextFolderId
        button.classList.toggle("active", isActive)
    })

    const searchInput = document.getElementById("search-input")
    filterAndRender(searchInput ? searchInput.value : "")
}
