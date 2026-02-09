export const createHistoryHandlers = (context) => {
    const { state, applySnapshot } = context

    const undo = () => {
        if (state.history.length <= 1) return
        const current = state.history.pop()
        state.future.push(current)
        const prev = state.history[state.history.length - 1]
        applySnapshot(prev)
    }

    const redo = () => {
        const next = state.future.pop()
        if (!next) return
        state.history.push(next)
        applySnapshot(next)
    }

    return { undo, redo }
}
