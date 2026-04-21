const SmartNotesEditor = (() => {
    const state = {
        active: false,
        currentId: "",
        history: [],
        historyIndex: -1
    }

    const els = {
        overlay: null,
        title: null,
        content: null,
        tags: null,
        indicator: null
    }

    const resolveEls = () => {
        els.overlay = document.getElementById("note-editor")
        els.title = document.getElementById("note-title")
        els.content = document.getElementById("note-content-editable")
        els.tags = document.getElementById("note-tags-input")
        els.indicator = document.getElementById("editor-page-indicator")
        if (els.content) els.content.contentEditable = "true"
    }

    const getCurrentNote = () => {
        const noteId = state.currentId
        if (!noteId) return null
        return (window.StateStore?.read?.().notes || []).find(note => String(note.id) === noteId) || null
    }

    const setHistory = (content) => {
        if (state.history[state.historyIndex] === content) return
        state.history = state.history.slice(0, state.historyIndex + 1)
        state.history.push(content)
        state.historyIndex = state.history.length - 1
    }

    const applyNoteToEditor = (note) => {
        const safeNote = note || {}
        state.currentId = String(safeNote.id || "")
        if (els.title) els.title.value = String(safeNote.title || "")
        if (els.content) els.content.innerHTML = String(safeNote.content || "")
        if (els.tags) els.tags.value = Array.isArray(safeNote.tags) ? safeNote.tags.map(tag => `#${String(tag).replace(/^#/, "")}`).join(" ") : ""
        if (els.indicator) els.indicator.textContent = "1/1"
        setHistory(String(safeNote.content || ""))
    }

    const extractTags = () => {
        const raw = String(els.tags?.value || "")
        return [...new Set(raw.split(/[\s,]+/).map(value => value.replace(/^#/, "").trim()).filter(Boolean))]
    }

    const buildEditableNote = () => {
        const current = getCurrentNote() || {}
        return {
            ...current,
            id: current.id || window.Utils.generateId("note"),
            title: String(els.title?.value || "").trim() || "Без названия",
            content: String(els.content?.innerHTML || ""),
            tags: extractTags(),
            updatedAt: new Date().toISOString(),
            createdAt: current.createdAt || new Date().toISOString()
        }
    }

    const persist = async (note) => {
        const user = window.StateStore?.read?.().user
        const collection = window.DataPath?.getUserNotesCollection?.(user)
        if (!collection || !note?.id) return false
        const payload = window.NoteHelpers?.buildNotePayload
            ? window.NoteHelpers.buildNotePayload({ note, user, access: note.access || null })
            : note
        await collection.doc(note.id).set(payload, { merge: true })
        const notes = window.StateStore?.read?.().notes || []
        const nextNotes = notes.some(item => item.id === note.id)
            ? notes.map(item => item.id === note.id ? { ...item, ...note } : item)
            : [note, ...notes]
        window.StateActions?.setNotes?.(nextNotes)
        window.StateActions?.setCurrentNote?.(note)
        return true
    }

    const open = () => {
        if (!els.overlay) resolveEls()
        els.overlay?.classList.add("active")
        state.active = true
    }

    const close = () => {
        els.overlay?.classList.remove("active")
        state.active = false
        state.currentId = ""
    }

    const openFromList = async (note) => {
        open()
        applyNoteToEditor(note)
        window.StateActions?.setCurrentNote?.(note || null)
    }

    const save = async () => {
        if (!state.active) return false
        const note = buildEditableNote()
        const saved = await persist(note)
        if (saved) {
            window.UI?.showToast?.(window.UI?.getText?.("saved", "Сохранено") || "Сохранено")
            setHistory(note.content)
        }
        return saved
    }

    const undo = () => {
        if (state.historyIndex <= 0) return
        state.historyIndex -= 1
        if (els.content) els.content.innerHTML = state.history[state.historyIndex]
    }

    const redo = () => {
        if (state.historyIndex >= state.history.length - 1) return
        state.historyIndex += 1
        if (els.content) els.content.innerHTML = state.history[state.historyIndex]
    }

    const deleteCurrent = async () => {
        const note = getCurrentNote()
        if (!note?.id) return false
        await window.deleteNoteById?.(note.id)
        close()
        return true
    }

    const toggleToolbar = () => {
        const toolbar = document.getElementById("editor-toolbar")
        toolbar?.classList.toggle("hidden")
    }

    const passthrough = () => {}

    const getToolList = () => []
    const getEnabledTools = () => []
    const setToolEnabled = () => true

    const init = () => {
        resolveEls()
        if (els.content) {
            els.content.addEventListener("input", () => {
                window.StateActions?.setEditorDirty?.(true)
                setHistory(String(els.content.innerHTML || ""))
            })
        }
    }

    return {
        init,
        open,
        openFromList,
        close,
        save,
        undo,
        redo,
        deleteCurrent,
        prevPage: passthrough,
        nextPage: passthrough,
        addPage: passthrough,
        confirmEquation: passthrough,
        toggleToolbar,
        resetMediaTransform: passthrough,
        alignMediaOrText: passthrough,
        deleteSelectedMedia: passthrough,
        getToolList,
        getEnabledTools,
        setToolEnabled
    }
})()

window.SmartNotesEditor = SmartNotesEditor
