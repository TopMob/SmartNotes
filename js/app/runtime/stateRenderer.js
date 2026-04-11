(() => {
    const getNotesScrollContainer = () => document.getElementById("notes-content-area")

    const renderFromState = (options = {}) => {
        const shouldPreserveScrollPosition = !!options.preserveScrollPosition
        const scrollContainer = shouldPreserveScrollPosition ? getNotesScrollContainer() : null
        const scrollTopBeforeRender = scrollContainer ? scrollContainer.scrollTop : 0
        const viewModel = NotesPresenter.createViewModel(StateStore.read())
        NotesUIAdapter.render(viewModel)
        UI.updateNavigationActiveState()
        if (scrollContainer) scrollContainer.scrollTop = scrollTopBeforeRender
    }

    const createStateRenderingController = () => {
        let unsubscribeStateRender = null

        const start = () => {
            if (unsubscribeStateRender) return
            unsubscribeStateRender = StateStore.subscribe((nextState, previousState) => {
                const configChanged = nextState.config !== previousState.config
                const languageChanged = configChanged && nextState.config.lang !== previousState.config.lang
                if (languageChanged) UI.applyLangToDom()

                const folderUiDependenciesChanged = nextState.folders !== previousState.folders
                    || nextState.activeFolderId !== previousState.activeFolderId
                    || languageChanged
                    || (configChanged && nextState.config.folderViewMode !== previousState.config.folderViewMode)
                if (folderUiDependenciesChanged) UI.renderFolders()

                const paginationStateChanged = nextState.pagination !== previousState.pagination
                const displayLimitChanged = paginationStateChanged && nextState.pagination.displayLimit !== previousState.pagination.displayLimit
                const loadMoreStateChanged = paginationStateChanged
                    && (
                        nextState.pagination.loadingMoreOwnedNotes !== previousState.pagination.loadingMoreOwnedNotes
                        || nextState.pagination.hasMoreOwnedNotes !== previousState.pagination.hasMoreOwnedNotes
                        || nextState.pagination.totalVisibleNotesCount !== previousState.pagination.totalVisibleNotesCount
                        || nextState.pagination.renderedVisibleNotesCount !== previousState.pagination.renderedVisibleNotesCount
                        || nextState.pagination.searchActive !== previousState.pagination.searchActive
                    )

                const shouldRenderNotes = nextState.notes !== previousState.notes
                    || nextState.view !== previousState.view
                    || nextState.activeFolderId !== previousState.activeFolderId
                    || nextState.searchQuery !== previousState.searchQuery
                    || nextState.folders !== previousState.folders
                    || nextState.sharedWorkspaces !== previousState.sharedWorkspaces
                    || languageChanged
                    || displayLimitChanged
                    || (configChanged && nextState.config.notesFilter !== previousState.config.notesFilter)

                if (shouldRenderNotes) {
                    renderFromState({ preserveScrollPosition: displayLimitChanged })
                    return
                }

                if (loadMoreStateChanged) {
                    UI.updateNotesLoadMoreButton(PaginationService.getLoadMoreState())
                }
            })
        }

        const stop = () => {
            if (typeof unsubscribeStateRender === "function") unsubscribeStateRender()
            unsubscribeStateRender = null
        }

        return { start, stop, renderFromState }
    }

    window.AppStateRenderer = {
        createStateRenderingController,
        renderFromState
    }
})()
