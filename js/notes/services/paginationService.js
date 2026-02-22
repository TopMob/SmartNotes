const PaginationService = (() => {
    const state = { pageSize: 100, renderStep: 10, visibleLimit: 10, hasMoreOwnedNotes: false, loadingMoreOwnedNotes: false, lastOwnedNoteDocument: null, totalVisibleNotesCount: 0, renderedVisibleNotesCount: 0 }
    function configureFromSettings(settings) {
        const nextStep = Number(settings?.notesPerPage) || 10
        state.renderStep = nextStep
        state.visibleLimit = Math.max(nextStep, state.visibleLimit || nextStep)
    }
    function resetVisibleLimit() { state.visibleLimit = state.renderStep }
    function setOwnedPaginationInfo(info) {
        state.hasMoreOwnedNotes = !!info.hasMoreOwnedNotes
        state.lastOwnedNoteDocument = info.lastOwnedNoteDocument || null
    }
    function getOwnedPaginationInfo() {
        return { pageSize: state.pageSize, hasMoreOwnedNotes: state.hasMoreOwnedNotes, loadingMoreOwnedNotes: state.loadingMoreOwnedNotes, lastOwnedNoteDocument: state.lastOwnedNoteDocument }
    }
    function setLoadingMoreOwnedNotes(value) { state.loadingMoreOwnedNotes = !!value }
    function getVisibleNotesForRender(notesList, activeView) {
        const notes = Array.isArray(notesList) ? notesList : []
        const view = String(activeView || "notes")
        if (!["notes", "favorites", "archive", "folder", "reminders", "locked"].includes(view)) {
            state.totalVisibleNotesCount = notes.length
            state.renderedVisibleNotesCount = notes.length
            return notes
        }
        const visibleNotes = notes.slice(0, state.visibleLimit)
        state.totalVisibleNotesCount = notes.length
        state.renderedVisibleNotesCount = visibleNotes.length
        return visibleNotes
    }
    function loadMore() {
        state.visibleLimit += state.renderStep
    }
    function getLoadMoreState() {
        return { hasMoreItems: state.renderedVisibleNotesCount < state.totalVisibleNotesCount, isLoading: state.loadingMoreOwnedNotes, totalVisibleNotesCount: state.totalVisibleNotesCount, renderedVisibleNotesCount: state.renderedVisibleNotesCount }
    }
    return { configureFromSettings, resetVisibleLimit, setOwnedPaginationInfo, getOwnedPaginationInfo, setLoadingMoreOwnedNotes, getVisibleNotesForRender, loadMore, getLoadMoreState }
})()
