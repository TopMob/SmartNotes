const RemindersService = (() => {
    const reminderTimers = new Map()
    const listeners = new Set()
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
    function emitReminder(note) { listeners.forEach(listener => listener(note)) }
    function schedule(notes) {
        clearTimers()
        ;(notes || []).forEach(note => {
            const reminderTime = normalizeReminderTime(note?.reminderAt)
            if (!reminderTime) return
            const delay = reminderTime - Date.now()
            if (delay <= 0 || delay > 2147483647) return
            const timer = setTimeout(() => emitReminder(note), delay)
            reminderTimers.set(String(note.id || Math.random()), timer)
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
    function subscribe(listener) {
        if (typeof listener !== "function") return () => {}
        listeners.add(listener)
        return () => listeners.delete(listener)
    }
    return { start, stop, subscribe }
})()
