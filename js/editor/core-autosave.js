import { CONFIG } from "./core-state.js"
import { normalizePageDrawings, buildPageDrawingsRevision } from "./core-drawing.js"

export const createAutosaveHandlers = (context) => {
    const {
        state,
        getPages,
        updateNotePageDrawings,
        syncAutoTitle,
        updateSnapshotFrame
    } = context

    const captureSnapshot = () => {
        const currentNote = StateStore.read().currentNote
        const titleElement = document.getElementById("note-title")
        const contentElement = document.getElementById("note-content-editable")
        if (!titleElement || !contentElement) {
            console.warn("Editor DOM not ready")
            let fallbackPageDrawings = []
            try {
                fallbackPageDrawings = normalizePageDrawings(currentNote, getPages().length)
            } catch (error) {
                fallbackPageDrawings = []
            }
            return {
                title: String(currentNote?.title || ""),
                content: String(currentNote?.content || ""),
                tags: [...(currentNote?.tags || [])],
                pageTitles: Array.isArray(currentNote?.pageTitles) ? currentNote.pageTitles.map(value => String(value || "")) : [],
                pageDrawings: fallbackPageDrawings,
                pageDrawingsRevision: currentNote?.pageDrawingsRevision || ""
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
            content: contentElement.innerHTML || "",
            tags: [...(currentNote?.tags || [])],
            pageTitles: Array.isArray(currentNote?.pageTitles) ? currentNote.pageTitles.map(value => String(value || "")) : [],
            pageDrawings: drawings,
            pageDrawingsRevision
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
        const contentText = String(snapshot?.content || "").replace(/<br\s*\/?>(\s*)/gi, "").trim()
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

    const queueSnapshot = Utils.debounce(() => {
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
