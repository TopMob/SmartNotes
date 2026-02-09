export const normalizePageDrawings = (note, totalPages) => {
    const raw = Array.isArray(note?.pageDrawings) ? note.pageDrawings : []
    const drawings = raw.map(value => typeof value === "string" ? value : "")
    if (!drawings.length && typeof note?.drawing === "string" && note.drawing) {
        drawings.push(note.drawing)
    }
    const count = Math.max(totalPages || 0, 1)
    while (drawings.length < count) drawings.push("")
    if (drawings.length > count) drawings.length = count
    return drawings
}
