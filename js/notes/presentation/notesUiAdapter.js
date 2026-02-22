const NotesUIAdapter = (() => {
    function render(viewModel) {
        if (viewModel.view === "folders") {
            UI.renderFolderGrid()
            return
        }
        if (viewModel.view === "hidden_folders") {
            UI.renderHiddenFolders()
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
        UI.updateViewTitle()
        UI.updatePrimaryActionLabel()
        UI.updateNotesLoadMoreButton(viewModel.loadMoreState)
    }
    return { render }
})()
