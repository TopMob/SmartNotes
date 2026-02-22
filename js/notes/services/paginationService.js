const PaginationService = (() => {
    const state = {
        pageSize: 500,
        renderStep: 20,
        hasMoreOwnedNotes: false,
        loadingMoreOwnedNotes: false,
        lastOwnedNoteDocument: null,
        totalVisibleNotesCount: 0,
        renderedVisibleNotesCount: 0,
        searchActive: false
    }

    function normalizeRenderStep(settings) {
        const configuredValue = Number(settings?.notesPerPage)
        if (configuredValue === 5 || configuredValue === 10 || configuredValue === 20 || configuredValue === 50) return configuredValue
        return 20
    }

    function getDisplayLimit() {
        return Number(StateStore.read().pagination?.displayLimit) || state.renderStep
    }

    function setDisplayLimit(nextDisplayLimit) {
        const normalizedDisplayLimit = Math.max(state.renderStep, Number(nextDisplayLimit) || state.renderStep)
        if (normalizedDisplayLimit === getDisplayLimit()) return
        StateStore.update("pagination", { displayLimit: normalizedDisplayLimit })
    }

    function configureFromSettings(settings) {
        const nextRenderStep = normalizeRenderStep(settings)
        state.renderStep = nextRenderStep
        setDisplayLimit(Math.max(nextRenderStep, getDisplayLimit()))
    }

    function resetVisibleLimit() {
        setDisplayLimit(state.renderStep)
    }

    function setOwnedPaginationInfo(info) {
        state.hasMoreOwnedNotes = !!info.hasMoreOwnedNotes
        state.lastOwnedNoteDocument = info.lastOwnedNoteDocument || null
    }

    function getOwnedPaginationInfo() {
        return {
            pageSize: state.pageSize,
            hasMoreOwnedNotes: state.hasMoreOwnedNotes,
            loadingMoreOwnedNotes: state.loadingMoreOwnedNotes,
            lastOwnedNoteDocument: state.lastOwnedNoteDocument
        }
    }

    function setLoadingMoreOwnedNotes(value) {
        state.loadingMoreOwnedNotes = !!value
    }

    function getVisibleNotesForRender(notesList, activeView, searchQuery) {
        const notes = Array.isArray(notesList) ? notesList : []
        const view = String(activeView || "notes")
        const isSupportedView = ["notes", "favorites", "archive", "folder", "reminders", "locked"].includes(view)
        const hasActiveSearch = String(searchQuery || "").trim().length > 0
        state.searchActive = hasActiveSearch
        if (!isSupportedView || hasActiveSearch) {
            state.totalVisibleNotesCount = notes.length
            state.renderedVisibleNotesCount = notes.length
            return notes
        }

        const visibleNotes = notes.slice(0, getDisplayLimit())
        state.totalVisibleNotesCount = notes.length
        state.renderedVisibleNotesCount = visibleNotes.length
        return visibleNotes
    }

    function loadMoreVisibleNotes() {
        setDisplayLimit(getDisplayLimit() + state.renderStep)
    }

    function shouldLoadMoreOwnedFromServer() {
        return !state.searchActive
            && state.hasMoreOwnedNotes
            && !state.loadingMoreOwnedNotes
            && getDisplayLimit() >= state.totalVisibleNotesCount
    }

    function getLoadMoreState() {
        const canRevealMoreClientNotes = state.renderedVisibleNotesCount < state.totalVisibleNotesCount
        const shouldShowButton = !state.searchActive && canRevealMoreClientNotes
        return {
            hasMoreItems: shouldShowButton,
            isLoading: state.loadingMoreOwnedNotes,
            totalVisibleNotesCount: state.totalVisibleNotesCount,
            renderedVisibleNotesCount: state.renderedVisibleNotesCount,
            hasMoreOwnedNotes: state.hasMoreOwnedNotes,
            searchActive: state.searchActive
        }
    }

    return {
        configureFromSettings,
        resetVisibleLimit,
        setOwnedPaginationInfo,
        getOwnedPaginationInfo,
        setLoadingMoreOwnedNotes,
        getVisibleNotesForRender,
        loadMoreVisibleNotes,
        shouldLoadMoreOwnedFromServer,
        getLoadMoreState
    }
})()
