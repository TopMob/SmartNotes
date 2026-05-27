import { CONFIG } from "./core-state.js"

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

export const createAutosaveHandlers = (context) => {
    const {
        state,
        getPages,
        updateNotePageDrawings,
        syncAutoTitle,
        updateSnapshotFrame,
        getSelectionBookmark
    } = context

    const normalizeEditorContentForStorage = (contentValue) => {
        const html = String(contentValue || "").trim()
        if (!html) return ""
        const plainText = Utils.stripHtml(html).replace(/\u00a0/g, " ").trim()
        const hasMedia = /<(img|audio|video|table|hr|iframe|canvas|svg)\b/i.test(html)
        if (!plainText && !hasMedia) return ""
        return html
    }

    const captureSnapshot = () => {
        const currentNote = StateStore.read().currentNote
        const titleElement = document.getElementById("note-title")
        const contentElement = document.getElementById("note-content-editable")
        if (!titleElement || !contentElement) {
            console.warn("Editor DOM not ready")
            let fallbackPageDrawings = []
            try {
                fallbackPageDrawings = normalizePageDrawings(currentNote, getPages().length)
            } catch {
                fallbackPageDrawings = []
            }
            return {
                title: String(currentNote?.title || ""),
                content: String(currentNote?.content || ""),
                tags: [...(currentNote?.tags || [])],
                pageTitles: Array.isArray(currentNote?.pageTitles) ? currentNote.pageTitles.map(value => String(value || "")) : [],
                pageDrawings: fallbackPageDrawings,
                pageDrawingsRevision: currentNote?.pageDrawingsRevision || "",
                selectionBookmark: getSelectionBookmark(),
                activePageIndex: state.pageIndex
            }
        }
        let drawings = []
        try {
            drawings = normalizePageDrawings(currentNote, getPages().length)
        } catch (error) {
            console.warn("drawing normalize failed", error)
        }
        const activeDrawing = typeof EditorDrawing === "undefined" ? null : EditorDrawing.getDrawingSnapshot?.()
        let pageDrawingsRevision = currentNote?.pageDrawingsRevision || ""
        if (typeof activeDrawing === "string") {
            const previousDrawing = drawings[state.pageIndex] || ""
            drawings[state.pageIndex] = activeDrawing
            if (previousDrawing !== activeDrawing) pageDrawingsRevision = ""
        }
        if (!pageDrawingsRevision) pageDrawingsRevision = buildPageDrawingsRevision(drawings)
        return {
            title: titleElement.value || "",
            content: normalizeEditorContentForStorage(contentElement.innerHTML || ""),
            tags: [...(currentNote?.tags || [])],
            pageTitles: Array.isArray(currentNote?.pageTitles) ? currentNote.pageTitles.map(value => String(value || "")) : [],
            pageDrawings: drawings,
            pageDrawingsRevision,
            selectionBookmark: getSelectionBookmark(),
            activePageIndex: state.pageIndex
        }
    }

    const persistDrawing = (drawingData) => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        const nextDrawing = typeof drawingData === "string" ? drawingData : ""
        let drawings = []
        try {
            drawings = normalizePageDrawings(currentNote, getPages().length)
        } catch (error) {
            console.warn("drawing normalize failed", error)
            return
        }
        if (drawings[state.pageIndex] === nextDrawing) return
        drawings[state.pageIndex] = nextDrawing
        const nextNote = updateNotePageDrawings(currentNote, drawings, true)
        StateStore.update("currentNote", nextNote)
        StateStore.update("editorDirty", true)
        queueSnapshot()
    }

    const isSnapshotEmpty = (snapshot) => {
        const titleText = String(snapshot?.title || "").trim()
        const contentText = normalizeEditorContentForStorage(snapshot?.content || "")
        const tagsCount = Array.isArray(snapshot?.tags) ? snapshot.tags.length : 0
        const drawingsCount = Array.isArray(snapshot?.pageDrawings)
            ? snapshot.pageDrawings.filter(item => String(item || "").trim().length > 0).length
            : 0
        return !titleText && !contentText && tagsCount === 0 && drawingsCount === 0
    }

    const areStringArraysEqual = (firstArray, secondArray) => {
        const left = Array.isArray(firstArray) ? firstArray : []
        const right = Array.isArray(secondArray) ? secondArray : []
        if (left.length !== right.length) return false
        for (let index = 0; index < left.length; index++) {
            if (left[index] !== right[index]) return false
        }
        return true
    }

    const snapshotsEqual = (firstSnapshot, secondSnapshot) => {
        if (firstSnapshot.title !== secondSnapshot.title) return false
        if (firstSnapshot.content !== secondSnapshot.content) return false
        if (!areStringArraysEqual(firstSnapshot.tags, secondSnapshot.tags)) return false
        if (!areStringArraysEqual(firstSnapshot.pageTitles, secondSnapshot.pageTitles)) return false
        const firstRevision = firstSnapshot.pageDrawingsRevision || ""
        const secondRevision = secondSnapshot.pageDrawingsRevision || ""
        if (firstRevision && secondRevision) return firstRevision === secondRevision
        return areStringArraysEqual(firstSnapshot.pageDrawings, secondSnapshot.pageDrawings)
    }

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
            pageTitles: Array.isArray(snapshot.pageTitles) ? [...snapshot.pageTitles] : [],
            pageDrawings: snapshot.pageDrawings,
            pageDrawingsRevision: snapshot.pageDrawingsRevision || buildPageDrawingsRevision(snapshot.pageDrawings)
        })
    }

    const queueSnapshotFrame = Utils.debounce((token) => {
        if (state.isApplyingSnapshot) return
        if (token !== state.snapshotToken) return
        syncAutoTitle()
        const previousSnapshot = state.history[state.history.length - 1]
        const currentSnapshot = captureSnapshot()

        if (isSnapshotEmpty(currentSnapshot)) return
        if (previousSnapshot && snapshotsEqual(previousSnapshot, currentSnapshot)) return

        StateStore.update("editorDirty", true)
        StateStore.update("isTyping", true)
        resetTypingState()

        state.history.push(currentSnapshot)
        if (state.history.length > CONFIG.MAX_HISTORY) state.history.shift()
        state.future = []

        persistSnapshot(currentSnapshot)
        scheduleAutoSave()
    }, CONFIG.SNAPSHOT_DELAY)

    const queueSnapshot = () => {
        queueSnapshotFrame(state.snapshotToken)
    }

    const scheduleAutoSave = Utils.debounce(() => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote || !StateStore.read().editorDirty) return
        const currentSnapshot = captureSnapshot()
        if (isSnapshotEmpty(currentSnapshot)) return
        if (state.autoSaveSnapshot && snapshotsEqual(state.autoSaveSnapshot, currentSnapshot)) return
        state.autoSaveSnapshot = currentSnapshot
        persistSnapshot(currentSnapshot)
    }, 1600)

    const scheduleSnapshotFrame = () => {
        if (state.isRenderingState || state.isApplyingSnapshot) return
        if (state.snapshotFrame) return
        state.snapshotFrame = requestAnimationFrame(() => {
            state.snapshotFrame = null
            queueSnapshot()
        })
    }

    updateSnapshotFrame(scheduleSnapshotFrame)

    const cancel = () => {
        resetTypingState.cancel?.()
        queueSnapshotFrame.cancel?.()
        scheduleAutoSave.cancel?.()
    }

    return {
        captureSnapshot,
        persistDrawing,
        persistSnapshot,
        queueSnapshot,
        scheduleAutoSave,
        scheduleSnapshotFrame,
        cancel
    }
}
