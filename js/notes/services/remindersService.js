const RemindersService = (() => {
    const reminderTimers = new Map()
    let unsubscribeState = null
    function clearTimers() {
        reminderTimers.forEach(timer => clearTimeout(timer))
        reminderTimers.clear()
    }
    function normalizeReminderTime(value) {
        if (value?.toDate) return value.toDate().getTime()
        const parsedTime = Date.parse(value || "")
        return Number.isNaN(parsedTime) ? 0 : parsedTime
    }
    function schedule(notes) {
        clearTimers()
        ;(notes || []).forEach(note => {
            const reminderTime = normalizeReminderTime(note?.reminderAt)
            if (!reminderTime) return
            const delay = reminderTime - Date.now()
            if (delay <= 0 || delay > 2147483647) return
            const timer = setTimeout(() => EventBus.publish("reminderTriggered", note), delay)
            reminderTimers.set(String(note.id || reminderTime), timer)
        })
    }
    function start() {
        if (unsubscribeState) return
        unsubscribeState = StateStore.subscribe(nextState => {
            schedule(nextState.notes || [])
        })
        schedule(StateStore.read().notes || [])
    }
    function stop() {
        if (unsubscribeState) unsubscribeState()
        unsubscribeState = null
        clearTimers()
    }
    return { start, stop }
})()
