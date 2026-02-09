const Editor = (() => {
    const init = () => {
        els = {
            wrapper: document.getElementById("note-editor"),
            title: document.getElementById("note-title"),
            contentWrapper: document.querySelector(".note-content-wrapper"),
            content: document.getElementById("note-content-editable"),
            toolbar: document.getElementById("editor-toolbar"),
            pageIndicator: document.getElementById("editor-page-indicator"),
            pagePrev: document.querySelector('[data-action="editor-prev-page"]'),
            pageNext: document.querySelector('[data-action="editor-next-page"]'),
            pageAdd: document.querySelector('[data-action="editor-add-page"]'),
            tagsInput: document.getElementById("note-tags-input"),
            tagsContainer: document.getElementById("note-tags-container"),
            ctxMenu: document.getElementById("media-context-menu"),
            alignMenu: document.getElementById("editor-align-menu"),
            scrollArea: document.querySelector(".editor-scroll-area"),
            drawingControls: document.getElementById("drawing-controls"),
            drawingColor: document.getElementById("drawing-color"),
            drawingSize: document.getElementById("drawing-size")
        }
        loadToolSettings()
        buildToolbar()
        if (typeof EditorDrawing !== "undefined") {
            EditorDrawing.configure({
                elements: els,
                getPages,
                getActivePage,
                buildToolbar,
                updateEditableState,
                onDrawingChange: persistDrawing
            })
            EditorDrawing.setupControls()
        }
        bind()
    }

    const bind = () => {
        if (abortController) abortController.abort()
        abortController = new AbortController()
        const { signal } = abortController

        if (els.title) {
            els.title.addEventListener("input", () => {
                titleTouched = true
                queueSnapshot()
            }, { signal })
        }

        if (els.content) {
            observer = new MutationObserver(scheduleSnapshotFrame)
            observer.observe(els.content, { childList: true, subtree: true, characterData: true, attributes: true })

            els.content.addEventListener("paste", handlePaste, { signal })
            els.content.addEventListener("keydown", handleTagLineEnter, { signal })
            els.content.addEventListener("keydown", handleEquationConfirmKeyDown, { signal })
            els.content.addEventListener("keyup", storeSelection, { signal })
            els.content.addEventListener("mouseup", storeSelection, { signal })
            els.content.addEventListener("touchend", storeSelection, { signal })
            
            els.content.addEventListener("click", (e) => {
                const link = e.target.closest("a")
                if (link && els.content.contains(link)) {
                    const noteId = link.dataset.noteId
                    if (noteId) {
                        e.preventDefault()
                        openNoteById(noteId)
                        return
                    }
                    const href = link.getAttribute("href")
                    if (href) {
                        e.preventDefault()
                        window.open(href, "_blank", "noopener")
                        return
                    }
                }
                const wrapper = e.target.closest(".media-wrapper")
                if (wrapper) {
                    selectMedia(wrapper)
                    e.stopPropagation()
                    return
                }
                deselectMedia()
            }, { signal })

            els.content.addEventListener("pointerdown", handleResizeStart, { signal })
            els.content.addEventListener("pointerdown", handleMediaDragStart, { signal })
        }

        document.addEventListener("selectionchange", storeSelection, { signal })
        document.addEventListener("click", (e) => {
            if (!els.alignMenu || !els.alignMenu.classList.contains("active")) return
            if (e.target.closest("#editor-align-menu")) return
            if (alignMenuTarget && e.target.closest(".tool-btn") === alignMenuTarget) return
            closeAlignMenu()
        }, { signal })

        if (els.scrollArea) {
            els.scrollArea.addEventListener("scroll", deselectMedia, { signal, passive: true })
        }

        if (els.tagsInput) {
            els.tagsInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault()
                    addTag(els.tagsInput.value)
                    els.tagsInput.value = ""
                }
            }, { signal })
        }

        if (els.tagsContainer) {
            els.tagsContainer.addEventListener("click", (e) => {
                const remove = e.target.closest("[data-action='remove-tag']")
                if (remove) removeTag(decodeURIComponent(remove.dataset.tag || ""))
                const add = e.target.closest("[data-action='add-tag']")
                if (add) addTag(decodeURIComponent(add.dataset.tag || ""))
            }, { signal })
        }

        if (typeof EditorAudio !== "undefined") {
            EditorAudio.bind({ container: els.content, signal })
        }

        const imgUpload = document.getElementById("img-upload")
        if (imgUpload) {
            imgUpload.onchange = async (e) => {
                const f = e.target.files?.[0]
                if (f) {
                    const url = await fileToDataUrl(f)
                    insertMedia(url, "image")
                    imgUpload.value = ""
                }
            }
        }

        const lockApply = document.getElementById("lock-apply")
        if (lockApply) {
            const newBtn = lockApply.cloneNode(true)
            lockApply.parentNode.replaceChild(newBtn, lockApply)
            newBtn.addEventListener("click", handleLockApply)
        }
    }

    const scheduleSnapshotFrame = () => {
        if (isRenderingState) return
        if (snapshotFrame) return
        snapshotFrame = requestAnimationFrame(() => {
            snapshotFrame = null
            queueSnapshot()
        })
    }

    const getActivePage = () => getPages()[pageIndex] || null

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
        if (els.title) els.title.readOnly = !editable
        if (els.toolbar) {
            els.toolbar.querySelectorAll("button").forEach(btn => {
                btn.disabled = !editable
                btn.setAttribute("aria-disabled", editable ? "false" : "true")
            })
        }
    }


    const updateEditableState = () => {
        const editable = !drawingState?.active && canEditNote(StateStore.read().currentNote)
        getPages().forEach(page => {
            page.contentEditable = editable ? "true" : "false"
        })
        if (els.content) {
            els.content.classList.toggle("drawing-active", !!drawingState?.active)
        }
    }

    const handleLockApply = async () => {
        const pass = document.getElementById("lock-password")?.value || ""
        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        if (!pass.trim()) return UI.showToast(UI.getText("lock_password_empty", "Password is empty"))
        
        const nextNote = { ...currentNote }
        await LockService.setLock(nextNote, pass.trim())
        StateStore.update("currentNote", nextNote)
        syncLockButton(nextNote)
        UI.closeModal("lock-modal")
        await save({ silent: true })
        UI.showToast(UI.getText("lock_hidden", "Note hidden"))
    }

    const loadToolSettings = () => {
        const defaults = getToolList().reduce((acc, t) => ({ ...acc, [t.id]: true }), {})
        let stored
        try { stored = JSON.parse(localStorage.getItem("editor-tools")) } catch {}
        const next = { ...defaults, ...(stored || {}) }
        StateStore.updateConfig({ editorTools: next })
    }

    const buildToolbar = () => {
        const root = els.toolbar
        if (!root) return
        const enabled = getEnabledTools()
        const tools = getToolList().filter(t => enabled[t.id] !== false)
        
        root.innerHTML = tools.map((t, idx) => `
            <span class="tool-wrapper">
                <button type="button" class="tool-btn${t.id === "sketch" && drawingState.active ? " active" : ""}" data-tool-idx="${idx}" data-tool-id="${t.id}" aria-label="${t.i}">
                    <i class="material-icons-round" aria-hidden="true">${t.i}</i>
                </button>
            </span>
        `).join("")

        root.querySelectorAll(".tool-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault()
                const idx = parseInt(btn.dataset.toolIdx, 10)
                const t = tools[idx]
                if (t) {
                    t.cmd(btn)
                    els.content?.focus()
                }
            })
        })
    }

    const getPages = () => els.content ? Array.from(els.content.querySelectorAll(".note-page")) : []

    const normalizePageDrawings = (note, totalPages) => {
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

    const resolveActivePageDrawing = (note) => {
        const drawings = normalizePageDrawings(note, getPages().length)
        return drawings[pageIndex] || ""
    }

    const updateNotePageDrawings = (note, drawings, updateTimestamp) => {
        const normalized = Array.isArray(drawings) ? drawings.map(value => typeof value === "string" ? value : "") : []
        const current = Array.isArray(note.pageDrawings) ? note.pageDrawings : []
        if (JSON.stringify(current) === JSON.stringify(normalized)) return note
        const nextNote = { ...note, pageDrawings: normalized }
        if (updateTimestamp) nextNote.updatedAt = Utils.serverTimestamp()
        return nextNote
    }

    const storeActivePageDrawing = (options = {}) => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote || typeof EditorDrawing === "undefined") return
        const drawings = normalizePageDrawings(currentNote, getPages().length)
        const snapshot = EditorDrawing.getDrawingSnapshot?.() ?? ""
        if (drawings[pageIndex] === snapshot) return
        drawings[pageIndex] = snapshot
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
        const page = getPages()[pageIndex] || null
        EditorDrawing.setActivePage?.(page)
        const drawing = resolveActivePageDrawing(note)
        EditorDrawing.setDrawingData(drawing, { recordHistory: true, replaceHistory: true })
    }

    const createPageElement = (html = "") => {
        const page = document.createElement("div")
        page.className = "note-page"
        page.contentEditable = "true"
        page.setAttribute("role", "textbox")
        page.setAttribute("aria-multiline", "true")
        const label = els.content?.getAttribute("aria-label")
        if (label) page.setAttribute("aria-label", label)
        page.innerHTML = html
        return page
    }

    const updatePageIndicator = () => {
        if (!els.pageIndicator) return
        const pages = getPages()
        const total = pages.length || 1
        els.pageIndicator.textContent = `${pageIndex + 1}/${total}`
    }

    const setActivePage = (index) => {
        const pages = getPages()
        if (!pages.length) return
        if (!isRenderingState) storeActivePageDrawing({ updateTimestamp: true, queueSnapshot: false })
        pageIndex = Utils.clamp(index, 0, pages.length - 1)
        pages.forEach((page, idx) => {
            page.classList.toggle("is-active", idx === pageIndex)
            page.setAttribute("aria-hidden", idx === pageIndex ? "false" : "true")
        })
        updatePageIndicator()
        focusActivePage()
        syncDrawingForActivePage()
    }

    const ensurePages = () => {
        if (!els.content) return
        const pages = getPages()
        if (!pages.length) {
            const html = els.content.innerHTML
            els.content.innerHTML = ""
            els.content.appendChild(createPageElement(html))
        } else {
            pages.forEach(page => {
                page.setAttribute("role", "textbox")
                page.setAttribute("aria-multiline", "true")
            })
        }
        const updatedPages = getPages()
        if (!updatedPages.length) return
        if (pageIndex >= updatedPages.length) pageIndex = updatedPages.length - 1
        if (pageIndex < 0) pageIndex = 0
        setActivePage(pageIndex)
        updateEditableState()
    }

    const focusActivePage = () => {
        const page = getPages()[pageIndex]
        if (!page) return
        page.focus()
    }

    const addPage = () => {
        if (!els.content) return
        const pages = getPages()
        const previousCount = pages.length || 1
        const page = createPageElement("")
        const current = pages[pageIndex]
        if (current) current.after(page)
        else els.content.appendChild(page)
        ensurePages()
        const currentNote = StateStore.read().currentNote
        if (currentNote) {
            const drawings = normalizePageDrawings(currentNote, previousCount)
            drawings.splice(pageIndex + 1, 0, "")
            const nextNote = updateNotePageDrawings(currentNote, drawings, true)
            if (nextNote !== currentNote) {
                StateStore.update("currentNote", nextNote)
                StateStore.update("editorDirty", true)
            }
        }
        setActivePage(pageIndex + 1)
        queueSnapshot()
    }

    const nextPage = () => {
        const pages = getPages()
        if (pageIndex < pages.length - 1) setActivePage(pageIndex + 1)
    }

    const prevPage = () => {
        if (pageIndex > 0) setActivePage(pageIndex - 1)
    }

    const getToolList = () => [
        { id: "bold", i: "format_bold", label: "tool_bold", cmd: () => document.execCommand("bold") },
        { id: "italic", i: "format_italic", label: "tool_italic", cmd: () => document.execCommand("italic") },
        { id: "underline", i: "format_underlined", label: "tool_underline", cmd: () => document.execCommand("underline") },
        { id: "strike", i: "strikethrough_s", label: "tool_strike", cmd: () => toggleStrikeThrough() },
        { id: "bullets", i: "format_list_bulleted", label: "tool_bullets", cmd: () => document.execCommand("insertUnorderedList") },
        { id: "numbered", i: "format_list_numbered", label: "tool_numbered", cmd: () => document.execCommand("insertOrderedList") },
        { id: "hr", i: "horizontal_rule", label: "tool_hr", cmd: () => insertHorizontalRule() },
        { id: "link", i: "link", label: "tool_link", cmd: () => {
            storeSelection()
            UI.showPrompt(UI.getText("link_title", "Add link"), UI.getText("link_placeholder", "Paste URL"), (value) => {
                applyLink(value)
            })
        }},
        { id: "note_link", i: "bookmarks", label: "tool_note_link", cmd: () => {
            storeSelection()
            UI.showPrompt(UI.getText("note_link_title", "Link to note"), UI.getText("note_link_placeholder", "Note id"), (value) => {
                applyNoteLink(value)
            })
        }},
        { id: "image", i: "image", label: "tool_image", cmd: () => {
            storeSelection()
            document.getElementById("img-upload")?.click()
        }},
        { id: "sketch", i: "gesture", label: "tool_sketch", cmd: () => {
            storeSelection()
            if (typeof EditorDrawing !== "undefined") EditorDrawing.toggleDrawingMode()
        }},
        { id: "align", i: "format_align_center", label: "tool_align", cmd: (btn) => toggleAlignMenu(btn) },
        { id: "clear", i: "format_clear", label: "tool_clear", cmd: () => document.execCommand("removeFormat") }
    ]

    const getEnabledTools = () => StateStore.read().config.editorTools || {}

    const setToolEnabled = (id, enabled) => {
        const current = getEnabledTools()
        current[id] = !!enabled
        StateStore.updateConfig({ editorTools: { ...current } })
        localStorage.setItem("editor-tools", JSON.stringify(current))
        buildToolbar()
    }


    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result || ""))
        r.onerror = () => reject(new Error("Blob read failed"))
        r.readAsDataURL(blob)
    })

    const setRecordingState = (active) => {
        StateStore.update("recording", !!active)
        const indicator = document.getElementById("voice-indicator")
        if (indicator) indicator.classList.toggle("active", !!active)
        const voiceBtn = document.querySelector('[data-action="editor-voice"]')
        voiceBtn?.classList.toggle("is-recording", !!active)
    }

    const stopRecording = () => {
        const recorder = StateStore.read().mediaRecorder
        if (recorder && recorder.state !== "inactive") recorder.stop()
        else setRecordingState(false)
        if (recordingStream) {
            recordingStream.getTracks().forEach(track => track.stop())
            recordingStream = null
        }
    }

    const startRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
            UI.showToast(UI.getText("mic_unsupported", "Microphone not supported"))
            return
        }
        storeSelection()
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            recordingStream = stream
            const recorder = new MediaRecorder(stream)
            const chunks = []
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size) chunks.push(e.data)
            }
            recorder.onstop = async () => {
                setRecordingState(false)
                const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
                const dataUrl = await blobToDataUrl(blob)
                insertAudio(dataUrl)
                StateStore.update("mediaRecorder", null)
            }
            StateStore.update("mediaRecorder", recorder)
            recorder.start()
            setRecordingState(true)
        } catch {
            UI.showToast(UI.getText("mic_denied", "Microphone access denied"))
            setRecordingState(false)
        }
    }

    const toggleRecording = () => {
        const recording = StateStore.read().recording
        if (recording) stopRecording()
        else startRecording()
    }


    const open = (note = null) => {
        const current = StateStore.read()
        const folderId = current.view === "folder" ? current.activeFolderId : null
        
        const base = note ? NoteIO.normalizeNote(note) : NoteIO.normalizeNote({
            id: Utils.generateId(),
            folderId,
            createdAt: Utils.serverTimestamp(),
            order: Date.now()
        })

        const prepared = JSON.parse(JSON.stringify(base))
        StateStore.update("currentNote", prepared)
        StateStore.update("isEditing", true)
        StateStore.update("isTyping", false)
        pageIndex = 0
        titleTouched = !!prepared.title
        
        history = []
        future = []
        renderState()
        
        history.push(captureSnapshot())
        autoSaveSnapshot = captureSnapshot()
        
        els.wrapper.classList.add("active")
        setTimeout(() => focusActivePage(), 50)
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches
        if (!isDesktop) UI.toggleSidebar(false)
    }

    const openFromList = async (note) => {
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
        els.wrapper.classList.remove("active")
        StateStore.update("currentNote", null)
        StateStore.update("isEditing", false)
        StateStore.update("isTyping", false)
        deselectMedia()
        stopRecording()
        pageIndex = 0
        titleTouched = false
        autoSaveSnapshot = null
        if (snapshotFrame) cancelAnimationFrame(snapshotFrame)
        snapshotFrame = null
        drawingState.active = false
        drawingState.isDrawing = false
        if (els.drawingControls) {
            els.drawingControls.classList.add("hidden")
        }
        if (typeof EditorDrawing !== "undefined") {
            EditorDrawing.setDrawingData("", { recordHistory: true, replaceHistory: true })
            EditorDrawing.cleanup()
        }
        if (observer) observer.disconnect()
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
        const n = StateStore.read().currentNote
        if (!n) return
        isRenderingState = true
        try {
            els.title.value = n.title || ""
            els.content.innerHTML = Utils.sanitizeHtml(n.content || "")
            ensurePages()
            syncAutoTitle()
            renderTags()
            makeMediaDraggable()
            syncMediaSizes()
            if (typeof EditorAudio !== "undefined") EditorAudio.sync(els.content)
            syncLockButton(n)
            syncDrawingForActivePage()
            syncAccessState(n)
            if (observer && els.content) {
                observer.disconnect()
                observer.observe(els.content, { childList: true, subtree: true, characterData: true, attributes: true })
            }
        } finally {
            isRenderingState = false
        }
    }

    const syncLockButton = (note) => {
        const btn = document.getElementById("editor-lock-toggle")
        if (!btn || !note) return
        const isLocked = !!note.lock?.hash
        const label = isLocked ? UI.getText("unlock_note", "Unlock") : UI.getText("lock_note", "Lock")
        const icon = btn.querySelector("i")
        btn.setAttribute("aria-label", label)
        if (icon) icon.textContent = isLocked ? "lock_open" : "lock"
    }

    const toggleLock = async () => {
        const note = StateStore.read().currentNote
        if (!note) return
        if (!canManageNote(note)) {
            UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
            return
        }
        if (note.lock?.hash) {
            const verified = await new Promise(resolve => {
                UI.showPrompt(UI.getText("lock_title", "Lock"), UI.getText("lock_password", "Password"), async (val) => {
                    resolve(await LockService.verify(note, val))
                })
            })
            if (!verified) {
                UI.showToast(UI.getText("lock_invalid_password", "Invalid password"))
                return
            }
            const nextNote = { ...note, lock: null }
            StateStore.update("currentNote", nextNote)
            syncLockButton(nextNote)
            await save({ silent: true })
            UI.showToast(UI.getText("unlock_success", "Note unlocked"))
            return
        }
        UI.openModal("lock-modal")
    }

    const toggleToolbar = () => els.toolbar?.classList.toggle("is-hidden")

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
        const n = {
            ...currentNote,
            title: snapshot.title,
            content: snapshot.content,
            tags: Array.isArray(snapshot.tags) ? [...snapshot.tags] : [],
            pageDrawings: Array.isArray(snapshot.pageDrawings) ? [...snapshot.pageDrawings] : []
        }

        const isAutoSave = !!options.autoSave
        if (!isAutoSave) {
            if (!titleTouched && !String(n.title || "").trim()) {
                n.title = buildAutoTitle(n.content || "")
                if (els.title) els.title.value = n.title
            }

            const autoTags = collectSuggestedTags(n.title, n.content)
            const currentTags = new Set(n.tags.map(t => t.toLowerCase()))
            autoTags.forEach(t => {
                if (!currentTags.has(t.toLowerCase())) n.tags.push(t)
            })

            if (!n.folderId) {
                const suggested = SmartSearch.suggestFolderId(n, StateStore.read().folders)
                if (suggested) n.folderId = suggested
            }
        }

        StateStore.update("currentNote", n)
        const access = typeof CollaborationService === "undefined" ? null : CollaborationService.getAccess(n)
        const targetId = access?.noteId || n.id
        const payload = NoteIO.normalizeNote({ ...n, id: targetId })
        delete payload.access
        const ref = typeof CollaborationService === "undefined"
            ? db.collection("users").doc(user.uid).collection("notes").doc(payload.id)
            : CollaborationService.getNoteReference(n, user)
        if (!ref) return
        
        try {
            await ref.set({ ...payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
            StateStore.update("editorDirty", false)
            autoSaveSnapshot = captureSnapshot()
            if (!options.silent) {
                UI.showToast(UI.getText("saved", "Saved"))
                close()
            }
        } catch (e) {
            UI.showToast("Save failed")
        }
    }

    const deleteCurrent = () => {
        const n = StateStore.read().currentNote
        if (!n) return
        if (!canManageNote(n)) {
            UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
            return
        }
        UI.confirm("delete", async () => {
            if (!db || !StateStore.read().user) return
            const ref = typeof CollaborationService === "undefined"
                ? db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(n.id)
                : CollaborationService.getNoteReference(n, StateStore.read().user)
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
        toggleLock,
        getToolList,
        getEnabledTools,
        setToolEnabled,
        resetMediaTransform,
        alignMediaOrText,
        deleteSelectedMedia,
        confirmEquation,
        toggleRecording,
        addPage,
        nextPage,
        prevPage
    }
})()
