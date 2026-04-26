const getNotesScrollContainer = () => document.getElementById("notes-content-area")

const renderCurrentView = (stateSnapshot) => {
    const queriedNotes = NotesQueryService.execute(stateSnapshot, stateSnapshot.searchQuery || "").notes
    const visibleNotes = PaginationService.getVisibleNotesForRender(queriedNotes, stateSnapshot.view, stateSnapshot.searchQuery || "")

    UI.updateViewTitle()
    UI.updateNavigationActiveState()

    if (stateSnapshot.view === "folders") {
        UI.renderFolderGrid()
    } else if (stateSnapshot.view === "hidden_folders") {
        UI.renderHiddenFolders()
    } else if (stateSnapshot.view === "admin_tools") {
        UI.renderAdminToolsView()
    } else if (stateSnapshot.view === "trash") {
        UI.renderTrash(visibleNotes)
    } else {
        NotesRenderer.render(visibleNotes)
    }

    UI.updateNotesLoadMoreButton(PaginationService.getLoadMoreState())
}

const renderFromState = (options = {}) => {
    const shouldPreserveScrollPosition = !!options.preserveScrollPosition
    const scrollContainer = shouldPreserveScrollPosition ? getNotesScrollContainer() : null
    const scrollTopBeforeRender = scrollContainer ? scrollContainer.scrollTop : 0
    renderCurrentView(StateStore.read())
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

const isNonCriticalSyncError = (error) => {
    const errorCode = String(error?.code || "")
    const errorMessage = String(error?.message || "").toLowerCase()
    return errorCode === "permission-denied"
        || errorCode === "failed-precondition"
        || errorCode === "not-found"
        || errorMessage.includes("401")
        || errorMessage.includes("unauthorized")
        || errorMessage.includes("jwt")
        || errorMessage.includes("token")
}

const reportSyncError = (error, context) => {
    const details = { code: error?.code || "", message: error?.message || String(error || "") }
    if (isNonCriticalSyncError(error)) {
        console.info(`[Session] ${context} secondary error`, details)
        return
    }
    UI.showToast(UI.getText("sync_error", "Sync error"))
    console.error(`[Session] ${context} error`, details)
}

const createUiEventsController = () => {
    let unsubscribeUiEvents = []

    const clear = () => {
        if (!unsubscribeUiEvents.length) return
        unsubscribeUiEvents.forEach(unsubscribe => {
            if (typeof unsubscribe === "function") unsubscribe()
        })
        unsubscribeUiEvents = []
    }

    const start = () => {
        clear()
        unsubscribeUiEvents.push(EventBus.subscribe("reminderTriggered", note => {
            UI.showToast(`${UI.getText("reminder_note", "Reminder")}: ${note.title || UI.getText("untitled_note", "Untitled")}`)
            window.NotificationService?.showReminderNotification?.(
                note.title || UI.getText("untitled_note", "Untitled"),
                UI.getText("reminder_note", "Reminder")
            )
        }))
        unsubscribeUiEvents.push(EventBus.subscribe("settingsSaved", () => {
            UI.showToast(UI.getText("settings_saved", "Настройки сохранены"))
        }))
        unsubscribeUiEvents.push(EventBus.subscribe("notesLoadFailed", error => reportSyncError(error, "notes load")))
        unsubscribeUiEvents.push(EventBus.subscribe("notesSyncError", error => reportSyncError(error, "owned notes sync")))
        unsubscribeUiEvents.push(EventBus.subscribe("foldersSyncError", error => reportSyncError(error, "folders sync")))
    }

    return { start, stop: clear }
}

const createNetworkLifecycleController = () => {
    let networkRetryTimer = null
    let networkListenersController = null
    const getSessionService = () => globalThis.SessionService || window.SessionService || null

    const start = () => {
        if (networkListenersController) return
        networkListenersController = new AbortController()
        window.addEventListener("online", () => {
            clearTimeout(networkRetryTimer)
            networkRetryTimer = setTimeout(() => {
                const user = StateStore.read().user
                const sessionService = getSessionService()
                if (user?.uid && sessionService?.startUserSession) {
                    sessionService.startUserSession(user, { forceResubscribe: true }).catch(() => {})
                }
            }, 1000)
        }, { signal: networkListenersController.signal })
    }

    const stop = () => {
        clearTimeout(networkRetryTimer)
        if (networkListenersController) networkListenersController.abort()
        networkListenersController = null
    }

    return { start, stop }
}

const createRuntimeInitializer = () => {
    let initializationPromise = null

    const stateRenderer = createStateRenderingController()
    const uiEvents = createUiEventsController()
    const networkLifecycle = createNetworkLifecycleController()

    const initializeRuntime = async () => {
        if (typeof UI.init === "function") UI.init()
        if (typeof window.SmartNotesEditor?.init === "function") window.SmartNotesEditor.init()
        stateRenderer.start()
        uiEvents.start()
        networkLifecycle.start()
        const user = StateStore.read().user
        if (user?.uid && typeof UI.handleInviteLinkFromUrl === "function") {
            await UI.handleInviteLinkFromUrl()
        }
        stateRenderer.renderFromState()
    }

    const init = async () => {
        if (!initializationPromise) initializationPromise = initializeRuntime()
        return initializationPromise
    }

    const initWhenDomReady = () => {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                init().catch(error => console.error("[Core] NotesApplication init failed", { message: error?.message || String(error || "") }))
            }, { once: true })
            return
        }
        init().catch(error => console.error("[Core] NotesApplication init failed", { message: error?.message || String(error || "") }))
    }

    return {
        init,
        initWhenDomReady
    }
}

const NotesApplication = (() => {
    const runtime = createRuntimeInitializer()
    return {
        init: runtime.init,
        initWhenDomReady: runtime.initWhenDomReady
    }
})()

window.initApp = () => NotesApplication.init()
NotesApplication.initWhenDomReady()
