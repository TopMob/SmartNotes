import { createEditorState, CONFIG } from "./core-state.js"
import { createInputHandlers } from "./core-input.js"
import { createMediaHandlers } from "./core-media.js"
import { createLinkHandlers } from "./core-links.js"
import { createMathHandlers } from "./core-math.js"
import { createHistoryHandlers } from "./core-history.js"
import { createAutosaveHandlers } from "./core-autosave.js"
import { normalizePageDrawings, buildPageDrawingsRevision } from "./core-drawing.js"
import { createEditorCommands } from "./editor-commands.js"

export const EditorAPI = (() => {
    const state = createEditorState()
    const elements = state.elements

    const getPages = () => elements.content ? Array.from(elements.content.querySelectorAll(".note-page")) : []
    const getActivePage = () => getPages()[state.pageIndex] || null

    const updateNotePageDrawings = (note, drawings, updateTimestamp) => {
        const normalized = Array.isArray(drawings) ? drawings.map(value => typeof value === "string" ? value : "") : []
        const current = Array.isArray(note.pageDrawings) ? note.pageDrawings : []
        if (current.length === normalized.length) {
            let drawingsChanged = false
            for (let index = 0; index < current.length; index++) {
                if (current[index] !== normalized[index]) {
                    drawingsChanged = true
                    break
                }
            }
            if (!drawingsChanged) return note
        }
        const nextNote = {
            ...note,
            pageDrawings: normalized,
            pageDrawingsRevision: buildPageDrawingsRevision(normalized)
        }
        if (updateTimestamp) nextNote.updatedAt = Utils.serverTimestamp()
        return nextNote
    }

    const resolveActivePageDrawing = (note) => {
        const drawings = normalizePageDrawings(note, getPages().length)
        return drawings[state.pageIndex] || ""
    }

    const loadToolSettings = () => {
        const defaults = getToolList().reduce((acc, t) => ({ ...acc, [t.id]: true }), {})
        let stored
        stored = SafeStorage.local.getJson("editor-tools", null)
        const next = { ...defaults, ...(stored || {}) }
        StateStore.updateConfig({ editorTools: next })
    }

    let queueSnapshot = () => {}
    let scheduleSnapshotFrame = () => {}
    let insertMedia = () => {}
    let fileToDataUrl = async () => ""
    let confirmEquationAtCaret = () => false
    let openFromList = () => {}
    let applyTextAlignment = () => false
    let captureSnapshot = () => ({
        title: "",
        content: "",
        tags: [],
        pageDrawings: [],
        pageDrawingsRevision: ""
    })

    const inputHandlers = createInputHandlers({
        elements,
        state,
        queueSnapshot: (...args) => queueSnapshot(...args),
        fileToDataUrl: (...args) => fileToDataUrl(...args),
        insertMedia: (...args) => insertMedia(...args),
        confirmEquationAtCaret: (...args) => confirmEquationAtCaret(...args)
    })

    const handlePaste = (event) => inputHandlers.handlePaste(event)

    const mediaHandlers = createMediaHandlers({
        elements,
        state,
        getPages,
        queueSnapshot: (...args) => queueSnapshot(...args),
        insertHtmlAtSelection: inputHandlers.insertHtmlAtSelection,
        alignText: (side) => applyTextAlignment(side)
    })

    fileToDataUrl = mediaHandlers.fileToDataUrl
    insertMedia = mediaHandlers.insertMedia

    const mathHandlers = createMathHandlers({
        elements,
        state,
        getActiveRangeInContent: inputHandlers.getActiveRangeInContent,
        getBlockFromRange: inputHandlers.getBlockFromRange,
        getCaretOffsetInBlock: inputHandlers.getCaretOffsetInBlock,
        createRangeFromOffsets: inputHandlers.createRangeFromOffsets,
        getPages,
        queueSnapshot: (...args) => queueSnapshot(...args)
    })

    confirmEquationAtCaret = mathHandlers.confirmEquationAtCaret

    const editorCommands = createEditorCommands({
        getRoot: () => elements.content,
        getActiveRangeInContent: inputHandlers.getActiveRangeInContent,
        storeSelection: inputHandlers.storeSelection,
        queueSnapshot: (...args) => queueSnapshot(...args),
        fallback: {
            enableFallback: StateStore.read().config?.editorExecCommandFallback !== false
        }
    })

    applyTextAlignment = editorCommands.alignText

    const linkHandlers = createLinkHandlers({
        getActiveRangeInContent: inputHandlers.getActiveRangeInContent,
        getEditorCommands: () => editorCommands,
        openFromList: (...args) => openFromList(...args)
    })

    const AI_ANALYSIS_VERSION = 1

    const hasAiRelevantChanges = (previousNote, nextNote) => {
        const previousTitle = String(previousNote?.title || "").trim()
        const nextTitle = String(nextNote?.title || "").trim()
        if (previousTitle !== nextTitle) return true
        const previousContent = String(previousNote?.content || "")
        const nextContent = String(nextNote?.content || "")
        if (previousContent !== nextContent) return true
        const previousTags = Array.isArray(previousNote?.tags) ? previousNote.tags.map(tag => String(tag || "").trim().toLowerCase()) : []
        const nextTags = Array.isArray(nextNote?.tags) ? nextNote.tags.map(tag => String(tag || "").trim().toLowerCase()) : []
        if (previousTags.length !== nextTags.length) return true
        for (let index = 0; index < previousTags.length; index++) {
            if (previousTags[index] !== nextTags[index]) return true
        }
        return false
    }

    const noteHasEditableContent = (note) => {
        const titleText = String(note?.title || "").trim()
        const plainTextContent = Utils.stripHtml(String(note?.content || "")).trim()
        const hasMedia = /<(img|audio|video|table|hr)\b/i.test(String(note?.content || ""))
        const tagsCount = Array.isArray(note?.tags) ? note.tags.length : 0
        const drawingCount = Array.isArray(note?.pageDrawings)
            ? note.pageDrawings.filter(item => String(item || "").trim().length > 0).length
            : 0
        return !!titleText || !!plainTextContent || hasMedia || tagsCount > 0 || drawingCount > 0
    }

    const save = async (options = {}) => {
        const user = StateStore.read().user
        if (!db || !user) return

        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        if (!canEditNote(currentNote)) {
            UI.showToast(UI.getText("share_readonly", "Read-only access"))
            return
        }
        const snapshot = captureSnapshot()
        const note = {
            ...currentNote,
            title: snapshot.title,
            content: snapshot.content,
            tags: Array.isArray(snapshot.tags) ? [...snapshot.tags] : [],
            pageDrawings: Array.isArray(snapshot.pageDrawings) ? [...snapshot.pageDrawings] : [],
            pageDrawingsRevision: snapshot.pageDrawingsRevision || buildPageDrawingsRevision(snapshot.pageDrawings)
        }

        const isAutoSave = !!options.autoSave
        if (isAutoSave && state.manualSaveInProgress) return
        if (!isAutoSave) {
            if (!state.titleTouched && !String(note.title || "").trim()) {
                note.title = NoteText.buildAutoTitle({ content: note.content || "" })
                if (elements.title) elements.title.value = note.title
            }

            const autoTags = inputHandlers.collectSuggestedTags(note.title, note.content)
            const currentTags = new Set(note.tags.map(t => t.toLowerCase()))
            autoTags.forEach(t => {
                if (!currentTags.has(t.toLowerCase())) note.tags.push(t)
            })

            if (!note.folderId) {
                const suggested = SmartSearch.suggestFolderId(note, StateStore.read().folders)
                if (suggested) note.folderId = suggested
            }
        }

        if (!noteHasEditableContent(note)) {
            if (!isAutoSave) {
                UI.showToast(UI.getText("note_empty_forbidden", "Добавьте содержимое заметки"))
            }
            return
        }

        if (hasAiRelevantChanges(currentNote, note)) {
            note.aiProcessed = false
            note.aiVersion = AI_ANALYSIS_VERSION
        }

        StateStore.update("currentNote", note)
        const access = typeof CollaborationService === "undefined"
            ? null
            : CollaborationService.getAccess(note)
        const payload = window.NoteHelpers.buildNotePayload({ note, user, access })

        const ref = typeof CollaborationService === "undefined"
            ? DataPath.getUserNotesCollection(user).doc(payload.id)
            : CollaborationService.getNoteReference(note, user)

        if (!ref) return

        if (!isAutoSave) state.manualSaveInProgress = true
        SaveStateService?.markSaving?.()
        try {
            await ref.set({ ...payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
            StateStore.update("editorDirty", false)
            state.autoSaveSnapshot = captureSnapshot()
            SaveStateService?.markSaved?.()
            if (!options.silent) {
                UI.showToast(UI.getText("saved", "Saved"))
                close()
            }
        } catch (error) {
            const shouldShowErrorToast = !isAutoSave && !options.silent
            SaveStateService?.handleRemoteSaveError?.(error, { showToast: shouldShowErrorToast })
            if (error?.code === "unavailable" || !navigator.onLine) {
                const pendingSaveResult = await SafeStorage.local.setJsonAsync("pending-note-save", { payload: { ...payload, updatedAt: Date.now() }, savedAt: Date.now() }, { useIndexedDb: true, priority: "high", ttlMs: 7 * 24 * 60 * 60 * 1000, allowIndexedDbFallback: true })
                SaveStateService?.handleStorageWriteResult?.(pendingSaveResult, { showToast: shouldShowErrorToast })
            }
        } finally {
            if (!isAutoSave) state.manualSaveInProgress = false
        }
    }

    const autosaveHandlers = createAutosaveHandlers({
        elements,
        state,
        getPages,
        updateNotePageDrawings,
        syncAutoTitle: inputHandlers.syncAutoTitle,
        save: (...args) => save(...args),
        updateSnapshotFrame: (fn) => { scheduleSnapshotFrame = fn }
    })

    captureSnapshot = autosaveHandlers.captureSnapshot
    queueSnapshot = autosaveHandlers.queueSnapshot

    const applySnapshot = (snap) => {
        if (!snap) return
        const note = StateStore.read().currentNote
        StateStore.update("currentNote", {
            ...note,
            title: snap.title,
            content: snap.content,
            tags: snap.tags,
            pageDrawings: snap.pageDrawings,
            pageDrawingsRevision: snap.pageDrawingsRevision || buildPageDrawingsRevision(snap.pageDrawings)
        })
        renderState()
    }

    const historyHandlers = createHistoryHandlers({
        state,
        applySnapshot
    })

    const init = () => {
        elements.wrapper = document.getElementById("note-editor")
        elements.title = document.getElementById("note-title")
        elements.contentWrapper = document.querySelector(".note-content-wrapper")
        elements.content = document.getElementById("note-content-editable")
        elements.toolbar = document.getElementById("editor-toolbar")
        elements.pageIndicator = document.getElementById("editor-page-indicator")
        elements.pagePrev = document.querySelector('[data-action="editor-prev-page"]')
        elements.pageNext = document.querySelector('[data-action="editor-next-page"]')
        elements.pageAdd = document.querySelector('[data-action="editor-add-page"]')
        elements.tagsInput = document.getElementById("note-tags-input")
        elements.tagsContainer = document.getElementById("note-tags-container")
        elements.ctxMenu = document.getElementById("media-context-menu")
        elements.alignMenu = document.getElementById("editor-align-menu")
        elements.scrollArea = document.querySelector(".editor-scroll-area")
        elements.drawingControls = document.getElementById("drawing-controls")
        elements.drawingColor = document.getElementById("drawing-color")
        elements.drawingSize = document.getElementById("drawing-size")

        loadToolSettings()
        buildToolbar()
        if (typeof EditorDrawing !== "undefined") {
            EditorDrawing.configure({
                elements,
                getPages,
                getActivePage,
                buildToolbar,
                updateEditableState,
                onDrawingChange: autosaveHandlers.persistDrawing
            })
            EditorDrawing.setupControls()
        }
        bind()
    }

    const bind = () => {
        if (state.abortController) state.abortController.abort()
        state.abortController = new AbortController()
        const { signal } = state.abortController

        if (elements.title) {
            elements.title.addEventListener("input", () => {
                state.titleTouched = !!elements.title.value.trim()
                inputHandlers.syncAutoTitle()
                queueSnapshot()
            }, { signal })
        }

        if (elements.content) {
            state.observer = new MutationObserver(scheduleSnapshotFrame)
            state.observer.observe(elements.content, { childList: true, subtree: true, characterData: true, attributes: true })

            elements.content.addEventListener("paste", handlePaste, { signal })
            elements.content.addEventListener("keydown", inputHandlers.handleTagLineEnter, { signal })
            elements.content.addEventListener("keydown", inputHandlers.handleEquationConfirmKeyDown, { signal })
            elements.content.addEventListener("keyup", inputHandlers.storeSelection, { signal })
            elements.content.addEventListener("mouseup", inputHandlers.storeSelection, { signal })
            elements.content.addEventListener("touchend", inputHandlers.storeSelection, { signal })

            elements.content.addEventListener("click", (event) => {
                const link = event.target.closest("a")
                if (link && elements.content.contains(link)) {
                    const noteId = link.dataset.noteId
                    if (noteId) {
                        event.preventDefault()
                        linkHandlers.openNoteById(noteId)
                        return
                    }
                    const href = link.getAttribute("href")
                    if (href) {
                        event.preventDefault()
                        window.open(href, "_blank", "noopener")
                        return
                    }
                }
                const wrapper = event.target.closest(".media-wrapper")
                if (wrapper) {
                    if (state.drawingState?.active) {
                        event.preventDefault()
                        event.stopPropagation()
                        return
                    }
                    mediaHandlers.selectMedia(wrapper)
                    event.stopPropagation()
                    return
                }
                mediaHandlers.deselectMedia()
            }, { signal })

            elements.content.addEventListener("pointerdown", mediaHandlers.handleResizeStart, { signal })
            elements.content.addEventListener("pointerdown", mediaHandlers.handleMediaDragStart, { signal })
            elements.content.addEventListener("dragstart", mediaHandlers.handleNativeDragStart, { signal })
        }

        document.addEventListener("selectionchange", inputHandlers.storeSelection, { signal })
        document.addEventListener("keydown", async (event) => {
            if (event.key !== "Escape") return
            if (!elements.wrapper?.classList.contains("active")) return
            event.preventDefault()
            await save({ silent: true })
            close()
        }, { signal })
        document.addEventListener("click", (event) => {
            if (!elements.alignMenu || !elements.alignMenu.classList.contains("active")) return
            if (event.target.closest("#editor-align-menu")) return
            if (state.alignMenuTarget && event.target.closest(".tool-btn") === state.alignMenuTarget) return
            mediaHandlers.closeAlignMenu()
        }, { signal })

        if (elements.scrollArea) {
            elements.scrollArea.addEventListener("scroll", mediaHandlers.deselectMedia, { signal, passive: true })
        }

        if (elements.tagsInput) {
            elements.tagsInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault()
                    inputHandlers.addTag(elements.tagsInput.value)
                    elements.tagsInput.value = ""
                }
            }, { signal })
        }

        if (elements.tagsContainer) {
            elements.tagsContainer.addEventListener("click", (event) => {
                const remove = event.target.closest("[data-action='remove-tag']")
                if (remove) inputHandlers.removeTag(decodeURIComponent(remove.dataset.tag || ""))
                const add = event.target.closest("[data-action='add-tag']")
                if (add) inputHandlers.addTag(decodeURIComponent(add.dataset.tag || ""))
            }, { signal })
        }

        const imgUpload = document.getElementById("img-upload")
        if (imgUpload) {
            imgUpload.onchange = async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                try {
                    const imageUrl = await fileToDataUrl(file)
                    mediaHandlers.insertMedia(imageUrl, "image")
                    imgUpload.value = ""
                } catch (error) {
                    const errorCode = error?.code || error?.message || "unknown"
                    UI.showToast(`Image save failed (${errorCode})`)
                }
            }
        }

    }

    const canEditNote = (note) => {
        if (typeof CollaborationService === "undefined") return true
        return CollaborationService.canEdit(note)
    }

    const canManageNote = (note) => {
        if (typeof CollaborationService === "undefined") return true
        return CollaborationService.canManage(note)
    }

    const syncAccessState = (note) => {
        const editable = canEditNote(note)
        if (elements.title) elements.title.readOnly = !editable
        if (elements.toolbar) {
            elements.toolbar.querySelectorAll("button").forEach(btn => {
                btn.disabled = !editable
                btn.setAttribute("aria-disabled", editable ? "false" : "true")
            })
        }
    }

    const updateEditableState = () => {
        const editable = !state.drawingState?.active && canEditNote(StateStore.read().currentNote)
        getPages().forEach(page => {
            page.contentEditable = editable ? "true" : "false"
        })
        if (elements.content) {
            elements.content.classList.toggle("drawing-active", !!state.drawingState?.active)
        }
        mediaHandlers.makeMediaDraggable()
    }

    const buildToolbar = () => {
        const root = elements.toolbar
        if (!root) return
        const enabled = getEnabledTools()
        const tools = getToolList().filter(t => enabled[t.id] !== false)

        root.innerHTML = tools.map((t, idx) => `
            <span class="tool-wrapper">
                <button type="button" class="tool-btn${t.id === "sketch" && state.drawingState.active ? " active" : ""}" data-tool-idx="${idx}" data-tool-id="${t.id}" aria-label="${t.i}">
                    <i class="material-icons-round" aria-hidden="true">${t.i}</i>
                </button>
            </span>
        `).join("")

        root.querySelectorAll(".tool-btn").forEach(btn => {
            btn.addEventListener("pointerdown", (event) => {
                event.preventDefault()
                inputHandlers.storeSelection()
            })
            btn.addEventListener("mousedown", (event) => {
                event.preventDefault()
                inputHandlers.storeSelection()
            })
            btn.addEventListener("click", (event) => {
                event.preventDefault()
                inputHandlers.restoreSelection()
                const idx = parseInt(btn.dataset.toolIdx, 10)
                const tool = tools[idx]
                if (tool) {
                    tool.cmd(btn)
                }
            })
        })
    }

    const createPageElement = (html = "") => {
        const page = document.createElement("div")
        page.className = "note-page"
        page.contentEditable = "true"
        page.setAttribute("role", "textbox")
        page.setAttribute("aria-multiline", "true")
        const label = elements.content?.getAttribute("aria-label")
        if (label) page.setAttribute("aria-label", label)
        page.innerHTML = html
        return page
    }

    const updatePageIndicator = () => {
        if (!elements.pageIndicator) return
        const pages = getPages()
        const total = pages.length || 1
        elements.pageIndicator.textContent = `${state.pageIndex + 1}/${total}`
    }

    const setActivePage = (index) => {
        const pages = getPages()
        if (!pages.length) return
        if (!state.isRenderingState) storeActivePageDrawing({ updateTimestamp: true, queueSnapshot: false })
        state.pageIndex = Utils.clamp(index, 0, pages.length - 1)
        pages.forEach((page, idx) => {
            page.classList.toggle("is-active", idx === state.pageIndex)
            page.setAttribute("aria-hidden", idx === state.pageIndex ? "false" : "true")
        })
        updatePageIndicator()
        focusActivePage()
        syncDrawingForActivePage()
    }

    const ensurePages = () => {
        if (!elements.content) return
        const pages = getPages()
        if (!pages.length) {
            const html = elements.content.innerHTML
            elements.content.innerHTML = ""
            elements.content.appendChild(createPageElement(html))
        } else {
            pages.forEach(page => {
                page.setAttribute("role", "textbox")
                page.setAttribute("aria-multiline", "true")
            })
        }
        const updatedPages = getPages()
        if (!updatedPages.length) return
        if (state.pageIndex >= updatedPages.length) state.pageIndex = updatedPages.length - 1
        if (state.pageIndex < 0) state.pageIndex = 0
        setActivePage(state.pageIndex)
        updateEditableState()
    }

    const focusActivePage = () => {
        const page = getPages()[state.pageIndex]
        if (!page) return
        page.focus()
    }

const addPage = () => {
    if (!elements.content) return

    const pages = getPages()
    if (pages.length >= 99) {
        UI?.showToast?.("Maximum 99 pages per note")
        return
    }

    const previousCount = pages.length || 1
    const page = createPageElement("")
    const current = pages[state.pageIndex]
    if (current) current.after(page)
    else elements.content.appendChild(page)
    ensurePages()

    const currentNote = StateStore.read().currentNote
    if (currentNote) {
        const drawings = normalizePageDrawings(currentNote, previousCount)
        drawings.splice(state.pageIndex + 1, 0, "")
        const nextNote = updateNotePageDrawings(currentNote, drawings, true)
        if (nextNote !== currentNote) {
            StateStore.update("currentNote", nextNote)
            StateStore.update("editorDirty", true)
        }
    }

    setActivePage(state.pageIndex + 1)
    queueSnapshot()
}


    const nextPage = () => {
        const pages = getPages()
        if (state.pageIndex < pages.length - 1) setActivePage(state.pageIndex + 1)
    }

    const prevPage = () => {
        if (state.pageIndex > 0) setActivePage(state.pageIndex - 1)
    }

    const getToolList = () => [
        { id: "bold", i: "format_bold", label: "tool_bold", cmd: () => editorCommands.toggleBold() },
        { id: "italic", i: "format_italic", label: "tool_italic", cmd: () => editorCommands.toggleItalic() },
        { id: "underline", i: "format_underlined", label: "tool_underline", cmd: () => editorCommands.toggleUnderline() },
        { id: "strike", i: "strikethrough_s", label: "tool_strike", cmd: () => editorCommands.toggleStrike() },
        { id: "bullets", i: "format_list_bulleted", label: "tool_bullets", cmd: () => editorCommands.toggleBulletedList() },
        { id: "numbered", i: "format_list_numbered", label: "tool_numbered", cmd: () => editorCommands.toggleNumberedList() },
        { id: "hr", i: "horizontal_rule", label: "tool_hr", cmd: () => inputHandlers.insertHorizontalRule() },
        { id: "link", i: "link", label: "tool_link", cmd: () => {
            inputHandlers.storeSelection()
            UI.showPrompt(UI.getText("link_title", "Add link"), UI.getText("link_placeholder", "Paste URL"), (value) => {
                linkHandlers.applyLink(value)
            })
        }},
        { id: "image", i: "image", label: "tool_image", cmd: () => {
            inputHandlers.storeSelection()
            document.getElementById("img-upload")?.click()
        }},
        { id: "sketch", i: "gesture", label: "tool_sketch", cmd: () => {
            inputHandlers.storeSelection()
            if (typeof EditorDrawing !== "undefined") EditorDrawing.toggleDrawingMode()
        }},
        { id: "align", i: "format_align_center", label: "tool_align", cmd: (btn) => mediaHandlers.toggleAlignMenu(btn) },
        { id: "clear", i: "format_clear", label: "tool_clear", cmd: () => editorCommands.clearFormatting() }
    ]

    const getEnabledTools = () => StateStore.read().config.editorTools || {}

    const setToolEnabled = (id, enabled) => {
        const current = getEnabledTools()
        current[id] = !!enabled
        StateStore.updateConfig({ editorTools: { ...current } })
        SafeStorage.local.setJson("editor-tools", current)
        buildToolbar()
    }

    const storeActivePageDrawing = (options = {}) => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote || typeof EditorDrawing === "undefined") return
        const drawings = normalizePageDrawings(currentNote, getPages().length)
        const snapshot = EditorDrawing.getDrawingSnapshot?.() ?? ""
        if (drawings[state.pageIndex] === snapshot) return
        drawings[state.pageIndex] = snapshot
        const nextNote = updateNotePageDrawings(currentNote, drawings, options.updateTimestamp)
        if (nextNote !== currentNote) {
            StateStore.update("currentNote", nextNote)
            StateStore.update("editorDirty", true)
            if (options.queueSnapshot) queueSnapshot()
        }
    }

    const syncDrawingForActivePage = () => {
        const note = StateStore.read().currentNote
        if (!note || typeof EditorDrawing === "undefined") return
        const page = getPages()[state.pageIndex] || null
        EditorDrawing.setActivePage?.(page)
        const drawing = resolveActivePageDrawing(note)
        EditorDrawing.setDrawingData(drawing, { recordHistory: true, replaceHistory: true })
    }

    const open = (note = null) => {
  const current = StateStore.read()
  const folderId = current.view === "folder" ? current.activeFolderId : null
  const user = current.user

  const base = note
    ? NoteIO.normalizeNote(note)
    : NoteIO.normalizeNote({
        id: Utils.generateId(),
        folderId,
        createdAt: Utils.serverTimestamp(),
        order: Date.now(),
        ownerUid: user?.uid || null
      })
        const prepared = JSON.parse(JSON.stringify(base))
        StateStore.update("currentNote", prepared)
        StateStore.update("isEditing", true)
        StateStore.update("isTyping", false)
        state.pageIndex = 0
        state.titleTouched = !!prepared.title

        state.history = []
        state.future = []
        renderState()

        state.history.push(captureSnapshot())
        state.autoSaveSnapshot = captureSnapshot()

        elements.wrapper.classList.add("active")
        setTimeout(() => focusActivePage(), 50)
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches
        if (!isDesktop) UI.toggleSidebar(false)
    }

    openFromList = async (note) => {
        if (typeof CollaborationService !== "undefined" && CollaborationService.isSharedNote(note)) {
            const access = CollaborationService.getAccess(note)
            if (!access?.ownerUid || !access?.noteId) {
                UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
                return
            }
        }
        if (note.lock && note.lock.hash) {
            const verified = await new Promise(resolve => {
                UI.showPrompt(UI.getText("lock_title", "Lock"), UI.getText("lock_password", "Password"), async (val) => {
                    resolve(await LockService.verify(note, val))
                })
            })
            if (!verified) {
                UI.showToast(UI.getText("lock_invalid_password", "Invalid password"))
                return
            }
        }
        open(note)
    }

    const close = () => {
        elements.wrapper.classList.remove("active")
        StateStore.update("currentNote", null)
        StateStore.update("isEditing", false)
        StateStore.update("isTyping", false)
        mediaHandlers.deselectMedia()
        state.pageIndex = 0
        state.titleTouched = false
        state.autoSaveSnapshot = null
        if (state.snapshotFrame) cancelAnimationFrame(state.snapshotFrame)
        state.snapshotFrame = null
        state.drawingState.active = false
        state.drawingState.isDrawing = false
        if (elements.drawingControls) {
            elements.drawingControls.classList.add("hidden")
        }
        if (typeof EditorDrawing !== "undefined") {
            EditorDrawing.setDrawingData("", { recordHistory: true, replaceHistory: true })
            EditorDrawing.cleanup()
        }
        if (state.observer) state.observer.disconnect()
        filterAndRender(document.getElementById("search-input")?.value || "")
    }

    const refreshFromRemote = (note) => {
        const current = StateStore.read().currentNote
        if (StateStore.read().isEditing) return
        if (!current || !note || current.id !== note.id) return
        StateStore.update("currentNote", note)
        renderState()
    }

    const renderState = () => {
        const note = StateStore.read().currentNote
        if (!note) return
        state.isRenderingState = true
        try {
            elements.title.value = note.title || ""
            elements.content.innerHTML = Utils.sanitizeHtml(note.content || "")
            ensurePages()
            inputHandlers.syncAutoTitle()
            inputHandlers.renderTags()
            mediaHandlers.makeMediaDraggable()
            mediaHandlers.syncMediaSizes()
            syncDrawingForActivePage()
            syncAccessState(note)
            if (state.observer && elements.content) {
                state.observer.disconnect()
                state.observer.observe(elements.content, { childList: true, subtree: true, characterData: true, attributes: true })
            }
        } finally {
            state.isRenderingState = false
        }
    }

    const toggleToolbar = () => elements.toolbar?.classList.toggle("is-hidden")

    const undo = () => {
        if (state.drawingState?.active && typeof EditorDrawing !== "undefined") {
            EditorDrawing.undo?.()
            return
        }
        historyHandlers.undo()
    }

    const redo = () => {
        if (state.drawingState?.active && typeof EditorDrawing !== "undefined") {
            EditorDrawing.redo?.()
            return
        }
        historyHandlers.redo()
    }

    const deleteCurrent = () => {
        const note = StateStore.read().currentNote
        if (!note) return
        if (!canManageNote(note)) {
            UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
            return
        }
        UI.confirm("delete", async () => {
            if (!db || !StateStore.read().user) return
            const ref = typeof CollaborationService === "undefined"
                ? DataPath.getUserNotesCollection(StateStore.read().user).doc(note.id)
                : CollaborationService.getNoteReference(note, StateStore.read().user)
            if (!ref) return
            await ref.delete()
            UI.showToast(UI.getText("note_deleted", "Deleted"))
            close()
        })
    }

    return {
        init,
        open,
        openFromList,
        refreshFromRemote,
        close,
        save,
        undo,
        redo,
        deleteCurrent,
        toggleToolbar,
        getToolList,
        getEnabledTools,
        setToolEnabled,
        resetMediaTransform: mediaHandlers.resetMediaTransform,
        alignMediaOrText: mediaHandlers.alignMediaOrText,
        deleteSelectedMedia: mediaHandlers.deleteSelectedMedia,
        confirmEquation: mathHandlers.confirmEquation,
        addPage,
        nextPage,
        prevPage,
        applyLink: linkHandlers.applyLink,
        handlePaste,
        saveSnapshot: autosaveHandlers.queueSnapshot
    }
})()
