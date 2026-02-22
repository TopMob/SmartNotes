(() => {
    const imageDataPrefixPattern = /^data:image\//i
    const base64Marker = "base64,"
    const maxStringLength = 2000
    const maxStringPreviewLength = 200
    const maxDepth = 3
    const maxEntries = 200
    const maxObjectKeys = 100
    const consoleEntries = []

    function sanitizeString(value) {
        const text = String(value)
        if (imageDataPrefixPattern.test(text) && text.includes(base64Marker)) {
            return `[data:image;base64 omitted, length=${text.length}]`
        }
        if (text.length > maxStringLength) {
            return `${text.slice(0, maxStringPreviewLength)}...[truncated length=${text.length}]`
        }
        return text
    }

    function sanitizeError(error, depth, visited) {
        return {
            name: sanitizeString(error?.name || "Error"),
            message: sanitizeString(error?.message || ""),
            stack: sanitizeString(error?.stack || "")
        }
    }

    function sanitizeLogValue(value, depth = 0, visited = new WeakSet()) {
        if (depth > maxDepth) return "[max-depth]"
        if (value === null || value === undefined) return value
        if (typeof value === "string") return sanitizeString(value)
        if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value
        if (value instanceof Error) return sanitizeError(value, depth, visited)
        if (typeof value !== "object") return sanitizeString(value)
        if (visited.has(value)) return "[circular]"
        visited.add(value)

        if (Array.isArray(value)) {
            return value.map(item => sanitizeLogValue(item, depth + 1, visited))
        }

        const sanitizedObject = {}
        Object.keys(value).slice(0, maxObjectKeys).forEach(key => {
            sanitizedObject[key] = sanitizeLogValue(value[key], depth + 1, visited)
        })
        return sanitizedObject
    }

    function saveEntry(level, args) {
        const sanitizedArgs = args.map(argument => sanitizeLogValue(argument))
        consoleEntries.push({ timestamp: Date.now(), level, args: sanitizedArgs })
        if (consoleEntries.length > maxEntries) consoleEntries.shift()
        return sanitizedArgs
    }

    function wrapConsoleMethod(level) {
        const originalMethod = console[level]
        if (typeof originalMethod !== "function") return
        console[level] = (...args) => {
            const sanitizedArgs = saveEntry(level, args)
            originalMethod.apply(console, sanitizedArgs)
        }
    }

    wrapConsoleMethod("log")
    wrapConsoleMethod("info")
    wrapConsoleMethod("warn")
    wrapConsoleMethod("error")

    window.sanitizeLogValue = sanitizeLogValue
    window.ConsoleLogStore = {
        getEntries() {
            return consoleEntries.slice()
        }
    }

    console.info("SmartNotes version:", window.APP_VERSION || "unknown")
})()
