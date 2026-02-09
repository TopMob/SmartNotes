import { CONFIG } from "./core-state.js"
import { normalizePageDrawings } from "./core-drawing.js"

export const createAutosaveHandlers = (context) => {
    const {
        elements,
        state,
        getPages,
        updateNotePageDrawings,
        syncAutoTitle,
        save,
        updateSnapshotFrame
    } = context

    const captureSnapshot = () => {
        const currentNote = StateStore.read().currentNote
        let drawings = []
        try {
            drawings = normalizePageDrawings(currentNote, getPages().length)
        } catch (error) {
            console.warn("drawing normalize failed", error)
        }
        const activeDrawing = typeof EditorDrawing === "undefined" ? null : EditorDrawing.getDrawingSnapshot?.()
        if (typeof activeDrawing === "string") drawings[state.pageIndex] = activeDrawing
        return {
            title: elements.title.value || "",
            content: elements.content.innerHTML || "",
            tags: [...(currentNote?.tags || [])],
            pageDrawings: drawings
        }
    }

    const persistDrawing = (drawingData) => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        const nextDrawing = typeof drawingData === "string" ? drawingData : ""
        const drawings = normalizePageDrawings(currentNote, getPages().length)
        if (drawings[state.pageIndex] === nextDrawing) return
        drawings[state.pageIndex] = nextDrawing
        const nextNote = updateNotePageDrawings(currentNote, drawings, true)
        StateStore.update("currentNote", nextNote)
        StateStore.update("editorDirty", true)
        queueSnapshot()
    }

    const snapshotsEqual = (a, b) =>
        a.title === b.title &&
        a.content === b.content &&
        JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
        JSON.stringify(a.pageDrawings) === JSON.stringify(b.pageDrawings)

    const resetTypingState = Utils.debounce(() => {
        StateStore.update("isTyping", false)
    }, 1200)

    const persistSnapshot = (snapshot) => {
        const note = StateStore.read().currentNote
        if (!note) return
        StateStore.update("currentNote", {
            ...note,
            title: snapshot.title,
            content: snapshot.content,
            pageDrawings: snapshot.pageDrawings
        })
    }

    const queueSnapshot = Utils.debounce(() => {
        syncAutoTitle()
        StateStore.update("editorDirty", true)
        StateStore.update("isTyping", true)
        resetTypingState()
        const prev = state.history[state.history.length - 1]
        const current = captureSnapshot()

        if (prev && snapshotsEqual(prev, current)) return

        state.history.push(current)
        if (state.history.length > CONFIG.MAX_HISTORY) state.history.shift()
        state.future = []

        persistSnapshot(current)
        scheduleAutoSave()
    }, CONFIG.SNAPSHOT_DELAY)

    const scheduleAutoSave = Utils.debounce(async () => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote || !StateStore.read().editorDirty) return
        const snap = captureSnapshot()
        if (state.autoSaveSnapshot && snapshotsEqual(state.autoSaveSnapshot, snap)) return
        await save({ silent: true, autoSave: true })
        state.autoSaveSnapshot = captureSnapshot()
    }, 1200)

    const scheduleSnapshotFrame = () => {
        if (state.isRenderingState) return
        if (state.snapshotFrame) return
        state.snapshotFrame = requestAnimationFrame(() => {
            state.snapshotFrame = null
            queueSnapshot()
        })
    }

    updateSnapshotFrame(scheduleSnapshotFrame)

    return {
        captureSnapshot,
        persistDrawing,
        persistSnapshot,
        queueSnapshot,
        scheduleAutoSave,
        scheduleSnapshotFrame
    }
}
