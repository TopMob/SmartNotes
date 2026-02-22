const NotesApplication = (() => {
    let unsubscribeStateRender = null
    let networkRetryTimer = null
    let initializationPromise = null

    function renderFromState() {
        const viewModel = NotesPresenter.createViewModel(StateStore.read())
        NotesUIAdapter.render(viewModel)
    }

    function startStateRendering() {
        if (unsubscribeStateRender) return
        unsubscribeStateRender = StateStore.subscribe((nextState, previousState) => {
            const configChanged = nextState.config !== previousState.config
            if (configChanged && nextState.config.lang !== previousState.config.lang) {
                UI.applyLangToDom()
            }
            if (nextState.folders !== previousState.folders || configChanged) {
                UI.renderFolders()
            }
            const paginationChanged = nextState.pagination !== previousState.pagination
            if (nextState.notes !== previousState.notes || nextState.view !== previousState.view || nextState.activeFolderId !== previousState.activeFolderId || nextState.searchQuery !== previousState.searchQuery || nextState.folders !== previousState.folders || configChanged || paginationChanged) {
                renderFromState()
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
        EventBus.subscribe("reminderTriggered", note => {
            UI.showToast(`${UI.getText("reminder_note", "Reminder")}: ${note.title || UI.getText("untitled_note", "Untitled")}`)
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification(note.title || UI.getText("untitled_note", "Untitled"), { body: UI.getText("reminder_note", "Reminder") })
            }
        })
        EventBus.subscribe("permissionRevoked", () => {
            UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
        })
        EventBus.subscribe("settingsSaved", () => {
            UI.showToast(UI.getText("settings_saved", "Настройки сохранены"))
        })
        EventBus.subscribe("notesLoadFailed", error => reportSyncError(error, "notes load"))
        EventBus.subscribe("notesSyncError", error => reportSyncError(error, "owned notes sync"))
        EventBus.subscribe("sharedSyncError", error => reportSyncError(error, "shared notes sync"))
        EventBus.subscribe("foldersSyncError", error => reportSyncError(error, "folders sync"))
    }

    function bindNetworkLifecycle() {
        window.addEventListener("online", () => {
            clearTimeout(networkRetryTimer)
            networkRetryTimer = setTimeout(() => {
                const user = StateStore.read().user
                if (user?.uid) SessionService.startUserSession(user, { forceResubscribe: true }).catch(() => {})
            }, 1000)
        })
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
