(() => {
    const isNonCriticalSyncError = (error) => {
        const errorCode = String(error?.code || "")
        return errorCode === "permission-denied" || errorCode === "failed-precondition" || errorCode === "not-found"
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

        return { start, stop: clear }
    }

    window.AppUiEvents = {
        createUiEventsController
    }
})()
