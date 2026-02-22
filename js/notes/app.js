const NotesApplication = (() => {
    let unsubscribeStateRender = null
    let networkRetryTimer = null
    function renderFromState() {
        const viewModel = NotesPresenter.createViewModel(StateStore.read())
        NotesUIAdapter.render(viewModel)
    }
    function startStateRendering() {
        if (unsubscribeStateRender) return
        unsubscribeStateRender = StateStore.subscribe((nextState, previousState) => {
            if (nextState.notes !== previousState.notes || nextState.view !== previousState.view || nextState.activeFolderId !== previousState.activeFolderId || nextState.searchQuery !== previousState.searchQuery || nextState.folders !== previousState.folders || nextState.config !== previousState.config) {
                renderFromState()
            }
        })
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
        EventBus.subscribe("notesLoadFailed", error => {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            console.error("[Session] error", { code: error?.code || "", message: error?.message || String(error || "") })
        })
        EventBus.subscribe("notesSyncError", error => {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            console.error("[Session] error", { code: error?.code || "", message: error?.message || String(error || "") })
        })
        EventBus.subscribe("sharedSyncError", error => {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            console.error("[Session] error", { code: error?.code || "", message: error?.message || String(error || "") })
        })
        EventBus.subscribe("foldersSyncError", error => {
            UI.showToast(UI.getText("sync_error", "Sync error"))
            console.error("[Session] error", { code: error?.code || "", message: error?.message || String(error || "") })
        })

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
        if (!("serviceWorker" in navigator)) return
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(registration => registration.unregister()))
        if ("caches" in window) {
            const cacheKeys = await caches.keys()
            await Promise.all(cacheKeys.map(cacheKey => caches.delete(cacheKey)))
        }
    }

    async function init() {
        await disableServiceWorkerCaching()
        startStateRendering()
        startUiEventListeners()
        bindNetworkLifecycle()
        const user = StateStore.read().user
        if (!user) return
        await SessionService.startUserSession(user)
        renderFromState()
    }
    return { init }
})()

window.initApp = () => NotesApplication.init()
