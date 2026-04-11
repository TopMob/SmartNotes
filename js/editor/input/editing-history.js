export const createEditingHistoryHandlers = (context) => {
    const { undo, redo } = context

    const handleBeforeInput = (event) => {
        if (event.defaultPrevented) return false
        const inputType = String(event.inputType || "")
        if (inputType === "historyUndo") {
            event.preventDefault()
            undo()
            return true
        }
        if (inputType === "historyRedo") {
            event.preventDefault()
            redo()
            return true
        }
        return false
    }

    const handleKeydown = (event) => {
        if (event.defaultPrevented || event.altKey) return false
        if (!event.ctrlKey && !event.metaKey) return false
        const key = String(event.key || "").toLowerCase()
        if (key === "z") {
            event.preventDefault()
            if (event.shiftKey) redo()
            else undo()
            return true
        }
        if (key === "y") {
            event.preventDefault()
            redo()
            return true
        }
        return false
    }

    return {
        handleBeforeInput,
        handleKeydown
    }
}
