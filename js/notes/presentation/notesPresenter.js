const NotesPresenter = (() => {
    function getText(stateSnapshot, key, fallback) {
        const dict = LANG[stateSnapshot.config?.lang] || LANG.ru
        return dict[key] || fallback
    }
    function createViewModel(stateSnapshot) {
        const queryResult = NotesQueryService.execute(stateSnapshot, stateSnapshot.searchQuery || "")
        const visibleNotes = PaginationService.getVisibleNotesForRender(queryResult.notes, queryResult.view, stateSnapshot.searchQuery || "")
        const emptyState = queryResult.view === "locked"
            ? { icon: "lock", text: getText(stateSnapshot, "lock_center_empty", "No protected notes") }
            : queryResult.view === "reminders"
                ? { icon: "schedule", text: getText(stateSnapshot, "reminder_empty", "No reminders") }
                : { icon: "note_add", text: getText(stateSnapshot, "empty", "Nothing here yet") }
        return { view: queryResult.view, notes: queryResult.notes, visibleNotes, emptyState, loadMoreState: PaginationService.getLoadMoreState() }
    }
    return { createViewModel }
})()
