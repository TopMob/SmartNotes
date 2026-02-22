const NotesApplication = (() => {
    let unsubscribeStateRender = null
    let unsubscribeReminder = null
    let networkRetryTimer = null
    function renderFromState() {
        const stateSnapshot = StateStore.read()
        const viewModel = NotesQueryService.execute(stateSnapshot, stateSnapshot.searchQuery || "")
        NotesViewService.render(viewModel)
    }
    function startStateRendering() {
        if (unsubscribeStateRender) return
        unsubscribeStateRender = StateStore.subscribe((nextState, previousState) => {
            if (nextState.notes !== previousState.notes || nextState.view !== previousState.view || nextState.activeFolderId !== previousState.activeFolderId || nextState.searchQuery !== previousState.searchQuery || nextState.folders !== previousState.folders || nextState.config !== previousState.config) {
                renderFromState()
            }
        })
    }
    function startReminderNotifications() {
        if (unsubscribeReminder) return
        unsubscribeReminder = RemindersService.subscribe(note => {
            UI.showToast(`${UI.getText("reminder_note", "Reminder")}: ${note.title || UI.getText("untitled_note", "Untitled")}`)
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification(note.title || UI.getText("untitled_note", "Untitled"), { body: UI.getText("reminder_note", "Reminder") })
            }
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
    async function init() {
        startStateRendering()
        startReminderNotifications()
        bindNetworkLifecycle()
        const user = StateStore.read().user
        if (!user) return
        await SessionService.startUserSession(user)
        renderFromState()
    }
    return { init }
})()

window.initApp = () => NotesApplication.init()
