const NotesApplication = (() => {
    let unsubscribeStateRender = null
    let networkRetryTimer = null
    let initializationPromise = null
    let unsubscribeUiEvents = []
    let networkListenersController = null

    function getNotesScrollContainer() {
        return document.getElementById("notes-content-area")
    }

    function renderFromState(options = {}) {
        const shouldPreserveScrollPosition = !!options.preserveScrollPosition
        const scrollContainer = shouldPreserveScrollPosition ? getNotesScrollContainer() : null
        const scrollTopBeforeRender = scrollContainer ? scrollContainer.scrollTop : 0
        const viewModel = NotesPresenter.createViewModel(StateStore.read())
        NotesUIAdapter.render(viewModel)
        UI.updateNavigationActiveState()
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollTopBeforeRender
        }
    }

    function startStateRendering() {
        if (unsubscribeStateRender) return
        unsubscribeStateRender = StateStore.subscribe((nextState, previousState) => {
            const configChanged = nextState.config !== previousState.config
            const languageChanged = configChanged && nextState.config.lang !== previousState.config.lang
            if (languageChanged) {
                UI.applyLangToDom()
            }

            const folderUiDependenciesChanged = nextState.folders !== previousState.folders
                || nextState.activeFolderId !== previousState.activeFolderId
                || languageChanged
                || (configChanged && nextState.config.folderViewMode !== previousState.config.folderViewMode)
            if (folderUiDependenciesChanged) {
                UI.renderFolders()
            }

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

    function isNonCriticalSyncError(error) {
        const errorCode = String(error?.code || "")
        return errorCode === "permission-denied" || errorCode === "failed-precondition" || errorCode === "not-found"
    }

    function reportSyncError(error, context) {
        const details = { code: error?.code || "", message: error?.message || String(error || "") }
        if (isNonCriticalSyncError(error)) {
            console.info(`[Session] ${context} secondary error`, details)
            return
        }
        UI.showToast(UI.getText("sync_error", "Sync error"))
        console.error(`[Session] ${context} error`, details)
    }

    function startUiEventListeners() {
        if (unsubscribeUiEvents.length) {
            unsubscribeUiEvents.forEach(unsubscribe => {
                if (typeof unsubscribe === "function") unsubscribe()
            })
            unsubscribeUiEvents = []
        }
        unsubscribeUiEvents.push(EventBus.subscribe("reminderTriggered", note => {
            UI.showToast(`${UI.getText("reminder_note", "Reminder")}: ${note.title || UI.getText("untitled_note", "Untitled")}`)
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification(note.title || UI.getText("untitled_note", "Untitled"), { body: UI.getText("reminder_note", "Reminder") })
            }
        }))
        unsubscribeUiEvents.push(EventBus.subscribe("permissionRevoked", () => {
            UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
        }))
        unsubscribeUiEvents.push(EventBus.subscribe("settingsSaved", () => {
            UI.showToast(UI.getText("settings_saved", "Настройки сохранены"))
        }))
        unsubscribeUiEvents.push(EventBus.subscribe("notesLoadFailed", error => reportSyncError(error, "notes load")))
        unsubscribeUiEvents.push(EventBus.subscribe("notesSyncError", error => reportSyncError(error, "owned notes sync")))
        unsubscribeUiEvents.push(EventBus.subscribe("sharedSyncError", error => reportSyncError(error, "shared notes sync")))
        unsubscribeUiEvents.push(EventBus.subscribe("foldersSyncError", error => reportSyncError(error, "folders sync")))
    }

    function bindNetworkLifecycle() {
        if (networkListenersController) return
        networkListenersController = new AbortController()
        window.addEventListener("online", () => {
            clearTimeout(networkRetryTimer)
            networkRetryTimer = setTimeout(() => {
                const user = StateStore.read().user
                if (user?.uid) SessionService.startUserSession(user, { forceResubscribe: true }).catch(() => {})
            }, 1000)
        }, { signal: networkListenersController.signal })
    }

    async function disableServiceWorkerCaching() {
        try {
            if (!("serviceWorker" in navigator)) return
            const registrations = await navigator.serviceWorker.getRegistrations()
            await Promise.all(registrations.map(registration => registration.unregister()))
            if ("caches" in window) {
                const cacheKeys = await caches.keys()
                await Promise.all(cacheKeys.map(cacheKey => caches.delete(cacheKey)))
            }
        } catch (error) {
            console.warn("[Core] service worker cleanup skipped", { message: error?.message || String(error || "") })
        }
    }

    async function initializeRuntime() {
        await disableServiceWorkerCaching()
        if (typeof UI.init === "function") UI.init()
        if (typeof window.SmartNotesEditor?.init === "function") {
            window.SmartNotesEditor.init()
        }
        startStateRendering()
        startUiEventListeners()
        bindNetworkLifecycle()
        const user = StateStore.read().user
        if (user?.uid) {
            await SessionService.startUserSession(user)
        }
        renderFromState()
    }

    async function init() {
        if (!initializationPromise) {
            initializationPromise = initializeRuntime()
        }
        return initializationPromise
    }

    function initWhenDomReady() {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                init().catch(error => console.error("[Core] NotesApplication init failed", { message: error?.message || String(error || "") }))
            }, { once: true })
            return
        }
        init().catch(error => console.error("[Core] NotesApplication init failed", { message: error?.message || String(error || "") }))
    }

    return { init, initWhenDomReady }
})()

window.initApp = () => NotesApplication.init()
NotesApplication.initWhenDomReady()
