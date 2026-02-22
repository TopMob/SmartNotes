const NotesViewService = (() => {
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
        if (viewModel.view === "locked") UI.updateEmptyState("lock", UI.getText("lock_center_empty", "No protected notes"))
        else if (viewModel.view === "reminders") UI.updateEmptyState("schedule", UI.getText("reminder_empty", "No reminders"))
        else UI.updateEmptyState("note_add", UI.getText("empty", "Nothing here yet"))
        const visibleNotes = PaginationService.getVisibleNotesForRender(viewModel.notes, viewModel.view)
        NotesRenderer.render(visibleNotes)
        UI.updateViewTitle()
        UI.updatePrimaryActionLabel()
        UI.updateNotesLoadMoreButton?.(PaginationService.getLoadMoreState())
    }
    return { render }
})()
