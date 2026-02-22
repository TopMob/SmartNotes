const EventBus = (() => {
    const listenersByEvent = new Map()
    function publish(eventName, payload) {
        const listeners = listenersByEvent.get(String(eventName || "")) || new Set()
        listeners.forEach(listener => listener(payload))
    }
    function subscribe(eventName, handler) {
        const normalizedEventName = String(eventName || "")
        if (!listenersByEvent.has(normalizedEventName)) listenersByEvent.set(normalizedEventName, new Set())
        const listeners = listenersByEvent.get(normalizedEventName)
        listeners.add(handler)
        return () => listeners.delete(handler)
    }
    return { publish, subscribe }
})()
