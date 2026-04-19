"use strict";

import { CONFIG, createEditorState } from "./core-state.js"
import { createHistoryHandlers } from "./core-history.js"
import { createAutosaveHandlers } from "./core-autosave.js"
import { createEditingHistoryHandlers } from "./input/editing-history.js"

export { CONFIG, createEditorState }

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
