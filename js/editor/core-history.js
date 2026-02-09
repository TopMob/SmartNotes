const undo = () => {
    if (history.length <= 1) return
    const current = history.pop()
    future.push(current)
    const prev = history[history.length - 1]
    applySnapshot(prev)
}

const redo = () => {
    const next = future.pop()
    if (!next) return
    history.push(next)
    applySnapshot(next)
}

const applySnapshot = (snap) => {
    if (!snap) return
    const n = StateStore.read().currentNote
    StateStore.update("currentNote", {
        ...n,
        title: snap.title,
        content: snap.content,
        tags: snap.tags,
        pageDrawings: snap.pageDrawings
    })
    renderState()
}
