const NotesUIAdapter = (() => {
    function syncViewMeta() {
        UI.updateViewTitle()
        UI.updatePrimaryActionLabel()
    }

    function render(viewModel) {
        syncViewMeta()
        if (viewModel.view === "folders") {
            UI.renderFolderGrid()
            return
        }
        if (viewModel.view === "hidden_folders") {
            UI.renderHiddenFolders()
            return
        }
        if (viewModel.view === "shared_access") {
            UI.renderSharedAccessView()
            return
        }
        if (viewModel.view === "admin_tools") {
            UI.renderAdminToolsView()
            return
        }
        if (viewModel.view === "trash") {
            UI.renderTrash(viewModel.notes)
            return
        }
        UI.updateEmptyState(viewModel.emptyState.icon, viewModel.emptyState.text)
        NotesRenderer.render(viewModel.visibleNotes)
        UI.updateNotesLoadMoreButton(viewModel.loadMoreState)
    }
    return { render }
})()
