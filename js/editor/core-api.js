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

    const getEditorDomElements = () => ({
        wrapper: document.getElementById("note-editor"),
        title: document.getElementById("note-title"),
        contentWrapper: document.querySelector(".note-content-wrapper"),
        content: document.getElementById("note-content-editable"),
        toolbar: document.getElementById("editor-toolbar"),
        pageIndicator: document.getElementById("editor-page-indicator"),
        pagePrev: document.querySelector('[data-action="editor-prev-page"]'),
        pageNext: document.querySelector('[data-action="editor-next-page"]'),
        pageAdd: document.querySelector('[data-action="editor-add-page"]'),
        pagesList: document.getElementById("editor-pages-list"),
        tagsInput: document.getElementById("note-tags-input"),
        tagsContainer: document.getElementById("note-tags-container"),
        ctxMenu: document.getElementById("media-context-menu"),
        alignMenu: document.getElementById("editor-align-menu"),
        scrollArea: document.querySelector(".editor-scroll-area"),
        drawingControls: document.getElementById("drawing-controls"),
        drawingColor: document.getElementById("drawing-color"),
        drawingSize: document.getElementById("drawing-size")
    })

    const refreshEditorDomElements = () => {
        const resolvedElements = getEditorDomElements()
        Object.assign(elements, resolvedElements)
        return resolvedElements
    }

    const getPages = () => {
        const contentElement = document.getElementById("note-content-editable")
        return contentElement ? Array.from(contentElement.querySelectorAll(".note-page")) : []
    }
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

    const normalizePageTitles = (note, pageCount) => {
        const totalPages = Math.max(1, Number(pageCount) || 1)
        const sourceTitles = Array.isArray(note?.pageTitles) ? note.pageTitles : []
        const normalizedTitles = []
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
            const sourceValue = sourceTitles[pageIndex]
            normalizedTitles.push(typeof sourceValue === "string" ? sourceValue.slice(0, 15) : "")
        }
        return normalizedTitles
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
        pageTitles: [],
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
        getRoot: () => document.getElementById("note-content-editable"),
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


    const areStringArraysEqual = (firstList, secondList) => {
        if (firstList.length !== secondList.length) return false
        for (let index = 0; index < firstList.length; index += 1) {
            if (firstList[index] !== secondList[index]) return false
        }
        return true
    }

    const isNotePresentInState = (noteId) => {
        const normalizedNoteId = String(noteId || "")
        if (!normalizedNoteId) return false
        const notes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
        return notes.some(noteItem => String(noteItem?.id || "") === normalizedNoteId)
    }

    const upsertSavedNoteIntoState = (savedNote) => {
        const noteIdentifier = String(savedNote?.id || "")
        if (!noteIdentifier) return
        const stateNotes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
        let updated = false
        const nextNotes = stateNotes.map((stateNote) => {
            if (String(stateNote?.id || "") !== noteIdentifier) return stateNote
            updated = true
            return NoteIO.normalizeNote({
                ...stateNote,
                ...savedNote
            })
        })
        if (!updated) {
            nextNotes.unshift(NoteIO.normalizeNote(savedNote))
        }
        StateStore.update("notes", nextNotes)
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


    const normalizeEditorHtml = (htmlValue) => {
        const htmlText = String(htmlValue || "")
            .replace(/\s+/g, " ")
            .replace(/>\s+</g, "><")
            .replace(/&nbsp;/gi, " ")
            .trim()
        return htmlText
    }

    const serializeEditorStateSnapshot = (note) => JSON.stringify({
        title: String(note?.title || ""),
        content: normalizeEditorHtml(note?.content),
        tags: Array.isArray(note?.tags) ? note.tags.map(tag => String(tag || "")) : [],
        pageTitles: Array.isArray(note?.pageTitles) ? note.pageTitles.map(value => String(value || "")) : [],
        pageDrawings: Array.isArray(note?.pageDrawings) ? note.pageDrawings.map(value => String(value || "")) : [],
        pageDrawingsRevision: String(note?.pageDrawingsRevision || ""),
        folderId: String(note?.folderId || "")
    })

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
            pageTitles: Array.isArray(snapshot.pageTitles) ? [...snapshot.pageTitles] : [],
            pageDrawings: Array.isArray(snapshot.pageDrawings) ? [...snapshot.pageDrawings] : [],
            pageDrawingsRevision: snapshot.pageDrawingsRevision || buildPageDrawingsRevision(snapshot.pageDrawings)
        }

        const isAutoSave = !!options.autoSave
        const isExitSave = !!options.persistOnExit
        if (state.isSaving) return
        if (isAutoSave && state.manualSaveInProgress) return
        const editorHasUnsavedChanges = !!StateStore.read().editorDirty
        if (!isAutoSave && !isExitSave && editorHasUnsavedChanges) {
            if (!state.titleTouched && !String(note.title || "").trim()) {
                const plainTextContent = Utils.stripHtml(String(note.content || "")).trim()
                const hasMediaContent = /<(img|audio|video|table|hr)\b/i.test(String(note.content || ""))
                if (plainTextContent || hasMediaContent) {
                    note.title = NoteText.buildAutoTitle({ content: note.content || "" })
                    const titleElement = document.getElementById("note-title")
                    if (titleElement) titleElement.value = note.title
                }
            }

            if (!note.folderId) {
                const suggested = SmartSearch.suggestFolderId(note, StateStore.read().folders)
                if (suggested) note.folderId = suggested
            }
        }

        if (!noteHasEditableContent(note)) {
            if (!isAutoSave && !isExitSave && !options.silent) {
                UI.showToast(UI.getText("note_empty_forbidden", "Добавьте содержимое заметки"))
            }
            return
        }

        const noteAlreadyPersisted = isNotePresentInState(note.id)
        const currentEditorState = serializeEditorStateSnapshot(note)
        if (noteAlreadyPersisted && state.initialEditorState && currentEditorState === state.initialEditorState) {
            SaveStateService?.markSaved?.()
            StateStore.update("editorDirty", false)
            if (!options.silent && !isExitSave) {
                UI.showToast(UI.getText("saved", "Saved"))
                await close({ persistChanges: false, silent: true })
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
        state.isSaving = true
        SaveStateService?.markSaving?.()
        try {
            await ref.set({ ...payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
            upsertSavedNoteIntoState(note)
            StateStore.update("editorDirty", false)
            state.autoSaveSnapshot = captureSnapshot()
            state.initialEditorState = serializeEditorStateSnapshot(note)
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
            state.isSaving = false
            if (!isAutoSave) state.manualSaveInProgress = false
        }
    }

    const autosaveHandlers = createAutosaveHandlers({
        elements,
        state,
        getPages,
        updateNotePageDrawings,
        syncAutoTitle: inputHandlers.syncAutoTitle,
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
            pageTitles: snap.pageTitles,
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
        refreshEditorDomElements()

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
        const boundElements = refreshEditorDomElements()
        if (state.abortController) state.abortController.abort()
        if (state.observer) {
            state.observer.disconnect()
            state.observer = null
        }
        state.abortController = new AbortController()
        const { signal } = state.abortController

        if (boundElements.title) {
            boundElements.title.addEventListener("input", (event) => {
                const titleElement = event.currentTarget
                state.titleTouched = !!titleElement.value.trim()
                inputHandlers.syncAutoTitle()
                queueSnapshot()
            }, { signal })
        }

        const pagesListElement = boundElements.pagesList
        if (pagesListElement) {
            pagesListElement.addEventListener("click", (event) => {
                const actionElement = event.target.closest("[data-action]")
                if (!actionElement) return
                const pageIndex = Number(actionElement.dataset.pageIndex)
                const action = actionElement.dataset.action
                if (action === "editor-select-page") {
                    selectPage(pageIndex)
                    UI.closeModal("editor-pages-modal")
                    return
                }
                if (action === "editor-pages-delete") {
                    deleteActivePage(pageIndex)
                }
            }, { signal })
            pagesListElement.addEventListener("input", (event) => {
                const inputElement = event.target.closest(".editor-page-title-input")
                if (!inputElement) return
                const pageIndex = Number(inputElement.dataset.pageIndex)
                const normalizedValue = String(inputElement.value || "").slice(0, 15)
                if (inputElement.value !== normalizedValue) inputElement.value = normalizedValue
                const counterElement = pagesListElement.querySelector(`.editor-page-title-counter[data-page-index="${pageIndex}"]`)
                if (counterElement) counterElement.textContent = String(15 - normalizedValue.length)
                setPageTitle(pageIndex, normalizedValue)
            }, { signal })
        }

        if (boundElements.content) {
            state.observer = new MutationObserver(scheduleSnapshotFrame)
            state.observer.observe(boundElements.content, { childList: true, subtree: true, characterData: true, attributes: true })

            boundElements.content.addEventListener("paste", handlePaste, { signal })
            boundElements.content.addEventListener("keydown", inputHandlers.handleTagLineEnter, { signal })
            boundElements.content.addEventListener("keydown", inputHandlers.handleEquationConfirmKeyDown, { signal })
            boundElements.content.addEventListener("keyup", inputHandlers.storeSelection, { signal })
            boundElements.content.addEventListener("mouseup", inputHandlers.storeSelection, { signal })
            boundElements.content.addEventListener("touchend", inputHandlers.storeSelection, { signal })

            boundElements.content.addEventListener("click", (event) => {
                const link = event.target.closest("a")
                if (link && boundElements.content.contains(link)) {
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
                mediaHandlers.cleanupPointerInteractions()
            }, { signal })

            boundElements.content.addEventListener("pointerdown", mediaHandlers.handleResizeStart, { signal })
            boundElements.content.addEventListener("pointerdown", mediaHandlers.handleMediaDragStart, { signal })
            boundElements.content.addEventListener("dragstart", mediaHandlers.handleNativeDragStart, { signal })
        }

        document.addEventListener("selectionchange", inputHandlers.storeSelection, { signal })
        document.addEventListener("keydown", async (event) => {
            if (event.key !== "Escape") return
            if (!document.getElementById("note-editor")?.classList.contains("active")) return
            event.preventDefault()
            await close({ persistChanges: true, silent: true })
        }, { signal })
        document.addEventListener("click", (event) => {
            const alignMenuElement = document.getElementById("editor-align-menu")
            if (!alignMenuElement || !alignMenuElement.classList.contains("active")) return
            if (event.target.closest("#editor-align-menu")) return
            if (state.alignMenuTarget && event.target.closest(".tool-btn") === state.alignMenuTarget) return
            mediaHandlers.closeAlignMenu()
        }, { signal })

        if (boundElements.scrollArea) {
            boundElements.scrollArea.addEventListener("scroll", mediaHandlers.deselectMedia, { signal, passive: true })
        }

        if (boundElements.tagsInput) {
            boundElements.tagsInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault()
                    inputHandlers.addTag(boundElements.tagsInput.value)
                    boundElements.tagsInput.value = ""
                }
            }, { signal })
        }

        if (boundElements.tagsContainer) {
            boundElements.tagsContainer.addEventListener("click", (event) => {
                const remove = event.target.closest("[data-action='remove-tag']")
                if (remove) inputHandlers.removeTag(decodeURIComponent(remove.dataset.tag || ""))
                const add = event.target.closest("[data-action='add-tag']")
                if (add) inputHandlers.addTag(decodeURIComponent(add.dataset.tag || ""))
            }, { signal })
        }

        const imageUploadInputElement = document.getElementById("img-upload")
        if (imageUploadInputElement) {
            imageUploadInputElement.addEventListener("change", async event => {
                const targetElement = event.target
                if (!(targetElement instanceof HTMLInputElement)) return
                const file = targetElement.files?.[0]
                if (!file) return
                try {
                    const imageUrl = await fileToDataUrl(file)
                    mediaHandlers.insertMedia(imageUrl, "image")
                    targetElement.value = ""
                } catch (error) {
                    const errorCode = error?.code || error?.message || "unknown"
                    UI.showToast(`${UI.getText("save_failed", "Не удалось сохранить")} (${errorCode})`)
                }
            }, { signal })
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
        const titleElement = document.getElementById("note-title")
        const toolbarElement = document.getElementById("editor-toolbar")
        if (titleElement) titleElement.readOnly = !editable
        if (toolbarElement) {
            toolbarElement.querySelectorAll("button").forEach(btn => {
                btn.disabled = !editable
                btn.setAttribute("aria-disabled", editable ? "false" : "true")
            })
        }
    }

    const updateEditableState = () => {
        const editable = !state.drawingState?.active && canEditNote(StateStore.read().currentNote)
        const contentElement = document.getElementById("note-content-editable")
        getPages().forEach(page => {
            page.contentEditable = editable ? "true" : "false"
        })
        if (contentElement) {
            contentElement.classList.toggle("drawing-active", !!state.drawingState?.active)
        }
        mediaHandlers.makeMediaDraggable()
    }

    const buildToolbar = () => {
        const root = document.getElementById("editor-toolbar")
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
                const toolIndex = parseInt(btn.dataset.toolIdx, 10)
                const tool = tools[toolIndex]
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
        const label = document.getElementById("note-content-editable")?.getAttribute("aria-label")
        if (label) page.setAttribute("aria-label", label)
        page.innerHTML = html
        return page
    }

    const renderPagesManagerList = () => {
        const pagesListElement = document.getElementById("editor-pages-list")
        if (!pagesListElement) return
        const pages = getPages()
        const total = pages.length || 1
        const pageTitles = normalizePageTitles(StateStore.read().currentNote, total)
        const items = []
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
            const pageIndex = pageNumber - 1
            const activeClass = pageIndex === state.pageIndex ? " is-active" : ""
            const disableDelete = total <= 1 ? " disabled" : ""
            const safeTitle = Utils.escapeHtml(pageTitles[pageIndex] || "")
            const remainingCharacters = 15 - String(pageTitles[pageIndex] || "").length
            items.push(`<div class="editor-page-item">
                <button type="button" class="editor-page-item-label${activeClass}" data-action="editor-select-page" data-page-index="${pageIndex}">${pageNumber}</button>
                <div class="editor-page-title-field">
                    <input type="text" class="editor-page-title-input" data-page-index="${pageIndex}" maxlength="15" value="${safeTitle}" placeholder="${UI.getText("page_title_placeholder", "Название страницы")}">
                    <span class="editor-page-title-counter" data-page-index="${pageIndex}">${remainingCharacters}</span>
                </div>
                <button type="button" class="btn-icon" data-action="editor-pages-delete" data-page-index="${pageIndex}"${disableDelete} aria-label="${UI.getText("page_delete", "Delete page")}">
                    <i class="material-icons-round" aria-hidden="true">delete</i>
                </button>
            </div>`)
        }
        pagesListElement.innerHTML = items.join("")
    }

    const updatePageIndicator = () => {
        const pageIndicatorElement = document.getElementById("editor-page-indicator")
        const pages = getPages()
        const total = pages.length || 1
        if (pageIndicatorElement) pageIndicatorElement.textContent = `${state.pageIndex + 1}/${total}`
        renderPagesManagerList()
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
        const contentElement = document.getElementById("note-content-editable")
        if (!contentElement) return
        const pages = getPages()
        if (!pages.length) {
            const html = contentElement.innerHTML
            contentElement.innerHTML = ""
            contentElement.appendChild(createPageElement(html))
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
        page.focus({ preventScroll: true })
    }

    const addPage = () => {
        const contentElement = document.getElementById("note-content-editable")
        if (!contentElement) return
        const pages = getPages()
        if (pages.length >= 99) {
            UI?.showToast?.("Maximum 99 pages per note")
            return
        }
        const previousCount = pages.length || 1
        const page = createPageElement("")
        const currentPage = pages[state.pageIndex]
        if (currentPage) currentPage.after(page)
        else contentElement.appendChild(page)
        ensurePages()
        const currentNote = StateStore.read().currentNote
        if (currentNote) {
            const drawings = normalizePageDrawings(currentNote, previousCount)
            drawings.splice(state.pageIndex + 1, 0, "")
            const pageTitles = normalizePageTitles(currentNote, previousCount)
            pageTitles.splice(state.pageIndex + 1, 0, "")
            const nextNote = updateNotePageDrawings(currentNote, drawings, false)
            if (nextNote !== currentNote) {
                StateStore.update("currentNote", { ...nextNote, pageTitles })
                StateStore.update("editorDirty", true)
            }
        }
        setActivePage(state.pageIndex + 1)
        queueSnapshot()
    }

    const deleteActivePage = (targetIndex = state.pageIndex) => {
        const pages = getPages()
        if (pages.length <= 1) {
            UI.showToast(UI.getText("page_delete_forbidden", "Нельзя удалить единственную страницу"))
            return
        }
        UI.confirm("delete_page", () => {
            const refreshedPages = getPages()
            if (refreshedPages.length <= 1) return
            const removeIndex = Utils.clamp(Number(targetIndex), 0, refreshedPages.length - 1)
            const targetPage = refreshedPages[removeIndex]
            if (!targetPage) return
            targetPage.remove()
            const currentNote = StateStore.read().currentNote
            if (currentNote) {
                const drawings = normalizePageDrawings(currentNote, refreshedPages.length)
                drawings.splice(removeIndex, 1)
                const pageTitles = normalizePageTitles(currentNote, refreshedPages.length)
                pageTitles.splice(removeIndex, 1)
                const nextNote = updateNotePageDrawings(currentNote, drawings, false)
                if (nextNote !== currentNote) StateStore.update("currentNote", { ...nextNote, pageTitles })
            }
            if (state.pageIndex >= getPages().length) state.pageIndex = getPages().length - 1
            ensurePages()
            StateStore.update("editorDirty", true)
            queueSnapshot()
        })
    }

    const setPageTitle = (pageIndex, titleValue) => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        const pages = getPages()
        if (!pages.length) return
        const normalizedPageIndex = Utils.clamp(Number(pageIndex), 0, pages.length - 1)
        const normalizedTitleValue = String(titleValue || "").slice(0, 15)
        const pageTitles = normalizePageTitles(currentNote, pages.length)
        if (pageTitles[normalizedPageIndex] === normalizedTitleValue) return
        pageTitles[normalizedPageIndex] = normalizedTitleValue
        StateStore.update("currentNote", { ...currentNote, pageTitles })
        StateStore.update("editorDirty", true)
        queueSnapshot()
    }

    const selectPage = (index) => {
        const nextIndex = Number(index)
        if (!Number.isFinite(nextIndex)) return
        setActivePage(nextIndex)
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
            const imageUploadInputElement = document.getElementById("img-upload")
            if (!imageUploadInputElement) return
            imageUploadInputElement.value = ""
            imageUploadInputElement.click()
        }},
        { id: "sketch", i: "gesture", label: "tool_sketch", cmd: () => {
            inputHandlers.storeSelection()
            if (typeof EditorDrawing !== "undefined") EditorDrawing.toggleDrawingMode()
        }},
        { id: "align", i: "format_align_center", label: "tool_align", cmd: (btn) => { inputHandlers.storeSelection(); mediaHandlers.toggleAlignMenu(btn) } },
        { id: "clear", i: "format_clear", label: "tool_clear", cmd: () => editorCommands.clearFormatting() }
    ]

    const getEnabledTools = () => StateStore.read().config.editorTools || {}

    const setToolEnabled = (id, enabled) => {
        const currentEnabledTools = getEnabledTools()
        const nextEnabledTools = { ...currentEnabledTools, [id]: !!enabled }
        StateStore.updateConfig({ editorTools: nextEnabledTools })
        SafeStorage.local.setJson("editor-tools", nextEnabledTools)
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
        const resolvedElements = refreshEditorDomElements()
        if (!resolvedElements.wrapper || !resolvedElements.title || !resolvedElements.content) {
            console.warn("Editor DOM not ready")
            return
        }

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
        StateStore.update("editorDirty", false)
        state.pageIndex = 0
        state.titleTouched = !!prepared.title

        state.history = []
        state.future = []
        resolvedElements.wrapper.classList.add("active")
        buildToolbar()
        renderState()
        focusActivePage()

        const openedNoteSnapshot = captureSnapshot()
        state.history.push(openedNoteSnapshot)
        state.autoSaveSnapshot = openedNoteSnapshot
        state.initialEditorState = serializeEditorStateSnapshot({
            ...prepared,
            title: openedNoteSnapshot.title,
            content: openedNoteSnapshot.content,
            tags: Array.isArray(openedNoteSnapshot.tags) ? [...openedNoteSnapshot.tags] : [],
            pageDrawings: Array.isArray(openedNoteSnapshot.pageDrawings) ? [...openedNoteSnapshot.pageDrawings] : [],
            pageDrawingsRevision: openedNoteSnapshot.pageDrawingsRevision || buildPageDrawingsRevision(openedNoteSnapshot.pageDrawings)
        })

        const isDesktop = window.matchMedia("(min-width: 1024px)").matches
        if (!isDesktop) UI.toggleSidebar(false)
    }

    openFromList = async (note) => {
        if (document.getElementById("note-editor")?.classList.contains("active")) {
            await close({ persistChanges: true, silent: true })
        }
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

    const hasSnapshotChanged = () => {
        const baselineSnapshot = state.autoSaveSnapshot
        if (!baselineSnapshot) return !!StateStore.read().editorDirty
        const currentSnapshot = captureSnapshot()
        const currentSnapshotState = JSON.stringify(currentSnapshot)
        const baselineSnapshotState = JSON.stringify(baselineSnapshot)
        return currentSnapshotState !== baselineSnapshotState
    }

    const close = async (options = {}) => {
        const shouldPersistChanges = options.persistChanges !== false
        const shouldStaySilent = options.silent !== false
        const hasUnsavedChanges = StateStore.read().editorDirty && hasSnapshotChanged()
        if (shouldPersistChanges && hasUnsavedChanges) {
            await save({ silent: shouldStaySilent, persistOnExit: true })
        }
        const wrapperElement = document.getElementById("note-editor")
        if (wrapperElement) wrapperElement.classList.remove("active")
        StateStore.update("currentNote", null)
        StateStore.update("isEditing", false)
        StateStore.update("isTyping", false)
        StateStore.update("editorDirty", false)
        mediaHandlers.deselectMedia()
        mediaHandlers.cleanupPointerInteractions()
        state.pageIndex = 0
        state.titleTouched = false
        state.autoSaveSnapshot = null
        state.initialEditorState = null
        if (state.snapshotFrame) cancelAnimationFrame(state.snapshotFrame)
        state.snapshotFrame = null
        state.drawingState.active = false
        state.drawingState.isDrawing = false
        const drawingControlsElement = document.getElementById("drawing-controls")
        if (drawingControlsElement) {
            drawingControlsElement.classList.add("hidden")
        }
        if (typeof EditorDrawing !== "undefined") {
            EditorDrawing.setDrawingData("", { recordHistory: true, replaceHistory: true })
            EditorDrawing.cleanup()
        }
        if (state.observer) state.observer.disconnect()
        updateSearchQuery(document.getElementById("search-input")?.value || "")
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
        const resolvedElements = refreshEditorDomElements()
        const titleElement = resolvedElements.title
        const contentElement = resolvedElements.content
        if (!titleElement || !contentElement) {
            console.warn("Editor DOM not ready")
            return
        }
        state.isRenderingState = true
        try {
            titleElement.value = note.title || ""
            contentElement.innerHTML = Utils.sanitizeHtml(note.content || "")
            ensurePages()
            inputHandlers.syncAutoTitle()
            inputHandlers.renderTags()
            mediaHandlers.makeMediaDraggable()
            mediaHandlers.syncMediaSizes()
            syncDrawingForActivePage()
            syncAccessState(note)
            if (state.observer) {
                state.observer.disconnect()
                state.observer.observe(contentElement, { childList: true, subtree: true, characterData: true, attributes: true })
            }
        } finally {
            state.isRenderingState = false
        }
    }

    const toggleToolbar = () => document.getElementById("editor-toolbar")?.classList.toggle("is-hidden")

    const pushCurrentSnapshotToHistory = () => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        const currentSnapshot = captureSnapshot()
        const latestSnapshot = state.history[state.history.length - 1]
        const currentSnapshotState = serializeEditorStateSnapshot({
            ...currentNote,
            title: currentSnapshot.title,
            content: currentSnapshot.content,
            tags: Array.isArray(currentSnapshot.tags) ? [...currentSnapshot.tags] : [],
            pageTitles: Array.isArray(currentSnapshot.pageTitles) ? [...currentSnapshot.pageTitles] : [],
            pageDrawings: Array.isArray(currentSnapshot.pageDrawings) ? [...currentSnapshot.pageDrawings] : [],
            pageDrawingsRevision: currentSnapshot.pageDrawingsRevision || buildPageDrawingsRevision(currentSnapshot.pageDrawings)
        })
        const latestSnapshotState = latestSnapshot
            ? serializeEditorStateSnapshot({
                ...currentNote,
                title: latestSnapshot.title,
                content: latestSnapshot.content,
                tags: Array.isArray(latestSnapshot.tags) ? [...latestSnapshot.tags] : [],
                pageTitles: Array.isArray(latestSnapshot.pageTitles) ? [...latestSnapshot.pageTitles] : [],
                pageDrawings: Array.isArray(latestSnapshot.pageDrawings) ? [...latestSnapshot.pageDrawings] : [],
                pageDrawingsRevision: latestSnapshot.pageDrawingsRevision || buildPageDrawingsRevision(latestSnapshot.pageDrawings)
            })
            : ""
        if (currentSnapshotState === latestSnapshotState) return
        state.history.push(currentSnapshot)
        if (state.history.length > CONFIG.MAX_HISTORY) state.history.shift()
        state.future = []
    }

    const undo = () => {
        if (state.drawingState?.active && typeof EditorDrawing !== "undefined") {
            EditorDrawing.undo?.()
            return
        }
        pushCurrentSnapshotToHistory()
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
            await close({ persistChanges: false, silent: true })
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
        deleteActivePage,
        selectPage,
        nextPage,
        prevPage,
        applyLink: linkHandlers.applyLink,
        handlePaste,
        saveSnapshot: autosaveHandlers.queueSnapshot
    }
})()
