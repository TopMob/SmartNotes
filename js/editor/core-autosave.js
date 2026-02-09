const captureSnapshot = () => {
    const currentNote = StateStore.read().currentNote
    const drawings = normalizePageDrawings(currentNote, getPages().length)
    const activeDrawing = typeof EditorDrawing === "undefined" ? null : EditorDrawing.getDrawingSnapshot?.()
    if (typeof activeDrawing === "string") drawings[pageIndex] = activeDrawing
    return {
        title: els.title.value || "",
        content: els.content.innerHTML || "",
        tags: [...(currentNote?.tags || [])],
        pageDrawings: drawings
    }
}

const persistDrawing = (drawingData) => {
    const currentNote = StateStore.read().currentNote
    if (!currentNote) return
    const nextDrawing = typeof drawingData === "string" ? drawingData : ""
    const drawings = normalizePageDrawings(currentNote, getPages().length)
    if (drawings[pageIndex] === nextDrawing) return
    drawings[pageIndex] = nextDrawing
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

const queueSnapshot = Utils.debounce(() => {
    syncAutoTitle()
    StateStore.update("editorDirty", true)
    StateStore.update("isTyping", true)
    resetTypingState()
    const prev = history[history.length - 1]
    const current = captureSnapshot()

    if (prev && snapshotsEqual(prev, current)) return

    history.push(current)
    if (history.length > CONFIG.MAX_HISTORY) history.shift()
    future = []

    const n = StateStore.read().currentNote
    if (n) {
        StateStore.update("currentNote", {
            ...n,
            title: current.title,
            content: current.content,
            pageDrawings: current.pageDrawings
        })
    }
    scheduleAutoSave()
}, CONFIG.SNAPSHOT_DELAY)

const scheduleAutoSave = Utils.debounce(async () => {
    const currentNote = StateStore.read().currentNote
    if (!currentNote || !StateStore.read().editorDirty) return
    const snap = captureSnapshot()
    if (autoSaveSnapshot && snapshotsEqual(autoSaveSnapshot, snap)) return
    await save({ silent: true, autoSave: true })
    autoSaveSnapshot = captureSnapshot()
}, 1200)
