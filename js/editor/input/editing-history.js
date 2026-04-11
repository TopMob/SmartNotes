export const createEditingHistoryHandlers = (context) => {
    const { undo, redo } = context

    const runUndo = () => {
        if (typeof undo === "function") undo()
    }

    const runRedo = () => {
        if (typeof redo === "function") redo()
    }

    const handleBeforeInput = (event) => {
        if (event.defaultPrevented) return false
        const inputType = String(event.inputType || "")
        if (inputType === "historyUndo") {
            event.preventDefault()
            runUndo()
            return true
        }
        if (inputType === "historyRedo") {
            event.preventDefault()
            runRedo()
            return true
        }
        return false
    }

    const handleKeydown = (event) => {
        if (event.defaultPrevented || event.altKey) return false
        const hasPrimaryModifier = event.ctrlKey || event.metaKey
        if (!hasPrimaryModifier) return false
        const key = String(event.key || "").toLowerCase()
        if (key === "z") {
            event.preventDefault()
            if (event.shiftKey) runRedo()
            else runUndo()
            return true
        }
        if (key === "y") {
            event.preventDefault()
            runRedo()
            return true
        }
        return false
    }

    return {
        handleBeforeInput,
        handleKeydown
    }
}
