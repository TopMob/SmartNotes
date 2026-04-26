"use strict";

import { CONFIG, createEditorState } from "./core-state.js"
import { createAutosaveHandlers } from "./core-autosave.js"
import { createEditingHistoryHandlers } from "./input-handlers.js"

export { CONFIG, createEditorState }

const createHistoryHandlers = (context) => {
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

export const createCoreEngine = (context) => {
    const autosave = createAutosaveHandlers(context)
    const history = createHistoryHandlers({ state: context.state, applySnapshot: context.applySnapshot })
    const editingHistory = createEditingHistoryHandlers({ undo: history.undo, redo: history.redo })

    return {
        autosave,
        history,
        editingHistory,
        undo: history.undo,
        redo: history.redo,
        queueSnapshot: autosave.queueSnapshot,
        captureSnapshot: autosave.captureSnapshot,
        persistDrawing: autosave.persistDrawing
    }
}
