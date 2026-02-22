const PaginationService = (() => {
    function readPaginationState() {
        return StateStore.read().pagination || {}
    }

    function writePaginationState(updater) {
        StateStore.set(previousState => {
            const currentPagination = previousState.pagination || {}
            const nextPagination = typeof updater === "function"
                ? updater(currentPagination)
                : { ...currentPagination, ...updater }
            if (nextPagination === currentPagination) return previousState
            const keys = Object.keys(nextPagination)
            const sameShape = keys.length === Object.keys(currentPagination).length
            const sameValues = sameShape && keys.every(key => currentPagination[key] === nextPagination[key])
            if (sameValues) return previousState
            return { ...previousState, pagination: nextPagination }
        })
    }

    function normalizeRenderStep(settings) {
        const configuredValue = Number(settings?.notesPerPage)
        if (configuredValue === 5 || configuredValue === 10 || configuredValue === 20 || configuredValue === 50) return configuredValue
        return 20
    }

    function getDisplayLimit() {
        const pagination = readPaginationState()
        return Number(pagination.displayLimit) || Number(pagination.renderStep) || 20
    }

    function setDisplayLimit(nextDisplayLimit) {
        const pagination = readPaginationState()
        const baseRenderStep = Number(pagination.renderStep) || 20
        const normalizedDisplayLimit = Math.max(baseRenderStep, Number(nextDisplayLimit) || baseRenderStep)
        if (normalizedDisplayLimit === Number(pagination.displayLimit)) return
        writePaginationState(previousPagination => ({ ...previousPagination, displayLimit: normalizedDisplayLimit }))
    }

    function configureFromSettings(settings) {
        const nextRenderStep = normalizeRenderStep(settings)
        writePaginationState(previousPagination => {
            const displayLimit = Math.max(nextRenderStep, Number(previousPagination.displayLimit) || nextRenderStep)
            if (Number(previousPagination.renderStep) === nextRenderStep && Number(previousPagination.displayLimit) === displayLimit) return previousPagination
            return { ...previousPagination, renderStep: nextRenderStep, displayLimit }
        })
    }

    function resetVisibleLimit() {
        const renderStep = Number(readPaginationState().renderStep) || 20
        setDisplayLimit(renderStep)
    }

    function setOwnedPaginationInfo(info) {
        const source = info && typeof info === "object" ? info : {}
        writePaginationState(previousPagination => ({
            ...previousPagination,
            hasMoreOwnedNotes: !!source.hasMoreOwnedNotes,
            lastOwnedNoteDocument: source.lastOwnedNoteDocument || null
        }))
    }

    function getOwnedPaginationInfo() {
        const pagination = readPaginationState()
        return {
            pageSize: Number(pagination.pageSize) || 500,
            hasMoreOwnedNotes: !!pagination.hasMoreOwnedNotes,
            loadingMoreOwnedNotes: !!pagination.loadingMoreOwnedNotes,
            lastOwnedNoteDocument: pagination.lastOwnedNoteDocument || null
        }
    }

    function setLoadingMoreOwnedNotes(value) {
        const nextValue = !!value
        writePaginationState(previousPagination => {
            if (!!previousPagination.loadingMoreOwnedNotes === nextValue) return previousPagination
            return { ...previousPagination, loadingMoreOwnedNotes: nextValue }
        })
    }

    function getVisibleNotesForRender(notesList, activeView, searchQuery) {
        const notes = Array.isArray(notesList) ? notesList : []
        const view = String(activeView || "notes")
        const isSupportedView = ["notes", "favorites", "archive", "folder", "reminders", "locked"].includes(view)
        const hasActiveSearch = String(searchQuery || "").trim().length > 0

        if (!isSupportedView || hasActiveSearch) {
            const total = notes.length
            writePaginationState(previousPagination => ({
                ...previousPagination,
                searchActive: hasActiveSearch,
                totalVisibleNotesCount: total,
                renderedVisibleNotesCount: total
            }))
            return notes
        }

        const visibleNotes = notes.slice(0, getDisplayLimit())
        writePaginationState(previousPagination => ({
            ...previousPagination,
            searchActive: false,
            totalVisibleNotesCount: notes.length,
            renderedVisibleNotesCount: visibleNotes.length
        }))
        return visibleNotes
    }

    function loadMoreVisibleNotes() {
        setDisplayLimit(getDisplayLimit() + (Number(readPaginationState().renderStep) || 20))
    }

    function shouldLoadMoreOwnedFromServer() {
        const pagination = readPaginationState()
        return !pagination.searchActive
            && !!pagination.hasMoreOwnedNotes
            && !pagination.loadingMoreOwnedNotes
            && getDisplayLimit() >= Number(pagination.totalVisibleNotesCount || 0)
    }

    function getLoadMoreState() {
        const pagination = readPaginationState()
        const totalVisibleNotesCount = Number(pagination.totalVisibleNotesCount || 0)
        const renderedVisibleNotesCount = Number(pagination.renderedVisibleNotesCount || 0)
        const canRevealMoreClientNotes = renderedVisibleNotesCount < totalVisibleNotesCount
        const shouldShowButton = !pagination.searchActive && (canRevealMoreClientNotes || !!pagination.hasMoreOwnedNotes)
        return {
            hasMoreItems: shouldShowButton,
            isLoading: !!pagination.loadingMoreOwnedNotes,
            totalVisibleNotesCount,
            renderedVisibleNotesCount,
            hasMoreOwnedNotes: !!pagination.hasMoreOwnedNotes,
            searchActive: !!pagination.searchActive
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
