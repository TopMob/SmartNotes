(() => {
    const imageDataPattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i
    const maxStringLength = 2000
    const maxDepth = 3
    const maxEntries = 200
    const consoleEntries = []

    function sanitizeString(value) {
        const text = String(value)
        if (imageDataPattern.test(text)) return `[data:image;base64 omitted, length=${text.length}]`
        if (text.length > maxStringLength) return `${text.slice(0, 120)}...[truncated length=${text.length}]`
        return text
    }

    function sanitizeLogValue(value, depth = 0) {
        if (depth > maxDepth) return "[max-depth]"
        if (value === null || value === undefined) return value
        if (typeof value === "string") return sanitizeString(value)
        if (typeof value === "number" || typeof value === "boolean") return value
        if (value instanceof Error) {
            return {
                name: sanitizeString(value.name || "Error"),
                message: sanitizeString(value.message || ""),
                stack: sanitizeString(value.stack || "")
            }
        }
        if (Array.isArray(value)) return value.map(item => sanitizeLogValue(item, depth + 1))
        if (typeof value === "object") {
            const sanitizedObject = {}
            Object.keys(value).slice(0, 100).forEach(key => {
                sanitizedObject[key] = sanitizeLogValue(value[key], depth + 1)
            })
            return sanitizedObject
        }
        return sanitizeString(value)
    }

    function saveEntry(level, args) {
        consoleEntries.push({
            timestamp: Date.now(),
            level,
            args: args.map(item => sanitizeLogValue(item))
        })
        if (consoleEntries.length > maxEntries) consoleEntries.shift()
    }

    function wrapConsoleMethod(level) {
        const original = console[level]
        if (typeof original !== "function") return
        console[level] = (...args) => {
            const sanitizedArgs = args.map(item => sanitizeLogValue(item))
            saveEntry(level, args)
            original.apply(console, sanitizedArgs)
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
