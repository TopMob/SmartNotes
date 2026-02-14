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

const hashDrawingText = (drawingText) => {
    const value = typeof drawingText === "string" ? drawingText : ""
    let hash = 2166136261
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

export const buildPageDrawingsRevision = (pageDrawings) => {
    const drawings = Array.isArray(pageDrawings) ? pageDrawings : []
    let hash = 2166136261
    hash ^= drawings.length
    hash = Math.imul(hash, 16777619)
    for (let index = 0; index < drawings.length; index++) {
        const drawingHash = hashDrawingText(drawings[index])
        hash ^= drawingHash
        hash = Math.imul(hash, 16777619)
    }
    return `pdr:${drawings.length}:${hash >>> 0}`
}
