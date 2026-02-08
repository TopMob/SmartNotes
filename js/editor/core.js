const Editor = (() => {
    let els = {}
    let history = []
    let future = []
    let selectedMedia = null
    let resizeState = null
    let dragState = null
    let observer = null
    let abortController = null
    let recordingStream = null
    let savedRange = null
    let alignMenuTarget = null
    let pageIndex = 0
    let titleTouched = false
    let autoSaveSnapshot = null
    let isRenderingState = false
    const drawingState = window.EditorDrawing?.state

    const CONFIG = {
        MAX_HISTORY: 100,
        SNAPSHOT_DELAY: 300,
        MIN_IMG_WIDTH: 100,
        MAX_IMG_WIDTH: 860
    }

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
        if (window.EditorDrawing) {
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
            observer = new MutationObserver(queueSnapshot)
            observer.observe(els.content, { childList: true, subtree: true, characterData: true, attributes: true })

            els.content.addEventListener("paste", handlePaste, { signal })
            els.content.addEventListener("keydown", handleTagLineEnter, { signal })
            els.content.addEventListener("keydown", handleEquationConfirmKeyDown, { signal })
            els.content.addEventListener("keyup", storeSelection, { signal })
            els.content.addEventListener("mouseup", storeSelection, { signal })
            els.content.addEventListener("touchend", storeSelection, { signal })
            els.content.addEventListener("input", handleContentInput, { signal })
            
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

        if (window.EditorAudio) {
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

    const handlePaste = async (e) => {
        const items = Array.from(e.clipboardData?.items || [])
        const imageItem = items.find(item => item.type && item.type.startsWith("image/"))
        if (imageItem) {
            e.preventDefault()
            const file = imageItem.getAsFile()
            if (!file) return
            const url = await fileToDataUrl(file)
            insertMedia(url, "image")
            return
        }

        e.preventDefault()
        const text = e.clipboardData.getData("text/plain")
        const html = e.clipboardData.getData("text/html")
        
        let safeContent = text
        if (html) {
            const div = document.createElement("div")
            div.innerHTML = html
            div.querySelectorAll("*").forEach(el => {
                el.removeAttribute("style")
                el.removeAttribute("class")
                if (el.tagName === "IMG") el.remove()
            })
            safeContent = div.innerHTML
        }
        
        document.execCommand("insertHTML", false, safeContent || text)
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

    const handleContentInput = (event) => {
        if (event.isComposing) return
        scheduleEasterEggCheck()
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

    const handleEquationConfirmKeyDown = (e) => {
        if (e.key !== "Enter") return
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
        if (confirmEquationAtCaret()) e.preventDefault()
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
        if (!currentNote || !window.EditorDrawing) return
        const drawings = normalizePageDrawings(currentNote, getPages().length)
        const snapshot = window.EditorDrawing.getDrawingSnapshot?.() ?? ""
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
        if (!note || !window.EditorDrawing) return
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
            if (window.EditorDrawing) EditorDrawing.toggleDrawingMode()
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


    const fileToDataUrl = (file) => new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result || ""))
        r.onerror = () => reject(new Error("File read failed"))
        r.readAsDataURL(file)
    })

    const handleResizeStart = (e) => {
        const handle = e.target.closest(".media-resize-handle")
        if (!handle) return
        
        const wrapper = e.target.closest(".media-wrapper")
        const img = wrapper?.querySelector("img")
        if (!wrapper || !img) return

        e.preventDefault()
        e.stopPropagation()

        const rect = img.getBoundingClientRect()
        const page = getPages()[pageIndex] || els.content
        const parentWidth = page.getBoundingClientRect().width - 40
        
        resizeState = {
            startX: e.clientX || e.touches?.[0].clientX,
            startWidth: rect.width,
            ratio: rect.width / Math.max(1, rect.height),
            maxWidth: Math.min(CONFIG.MAX_IMG_WIDTH, parentWidth),
            wrapper,
            img
        }

        handle.setPointerCapture?.(e.pointerId)
        document.addEventListener("pointermove", handleResizeMove, { passive: false })
        document.addEventListener("pointerup", handleResizeEnd, { once: true })
        document.addEventListener("pointercancel", handleResizeEnd, { once: true })
    }

    const handleResizeMove = (e) => {
        if (!resizeState) return
        e.preventDefault()
        
        const clientX = e.clientX
        const dx = clientX - resizeState.startX
        let w = resizeState.startWidth + dx
        
        w = Utils.clamp(Utils.snap(w, 8), CONFIG.MIN_IMG_WIDTH, resizeState.maxWidth)
        const h = w / resizeState.ratio

        resizeState.img.style.width = `${w}px`
        resizeState.img.style.height = `${h}px`
        resizeState.wrapper.dataset.width = w
        resizeState.wrapper.dataset.height = h
    }

    const handleResizeEnd = () => {
        resizeState = null
        document.removeEventListener("pointermove", handleResizeMove)
        queueSnapshot()
    }

    const handleMediaDragStart = (e) => {
        if (e.button && e.button !== 0) return
        if (e.target.closest(".media-resize-handle")) return
        const wrapper = e.target.closest(".media-wrapper")
        if (!wrapper || !els.content.contains(wrapper)) return
        dragState = {
            wrapper,
            trailingBreak: wrapper.nextSibling && wrapper.nextSibling.nodeName === "BR" ? wrapper.nextSibling : null,
            startX: e.clientX,
            startY: e.clientY,
            moved: false
        }
        wrapper.setPointerCapture?.(e.pointerId)
        document.addEventListener("pointermove", handleMediaDragMove, { passive: false })
        document.addEventListener("pointerup", handleMediaDragEnd, { once: true })
        document.addEventListener("pointercancel", handleMediaDragEnd, { once: true })
    }

    const handleMediaDragMove = (e) => {
        if (!dragState) return
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY
        if (!dragState.moved && Math.hypot(dx, dy) < 6) return
        dragState.moved = true
        dragState.wrapper.classList.add("dragging")
        dragState.wrapper.style.transform = `translate(${dx}px, ${dy}px)`
        dragState.wrapper.style.pointerEvents = "none"
        e.preventDefault()
    }

    const handleMediaDragEnd = (e) => {
        if (!dragState) return
        const { wrapper, trailingBreak, moved } = dragState
        wrapper.classList.remove("dragging")
        wrapper.style.transform = ""
        wrapper.style.pointerEvents = ""
        if (moved) {
            const range = getDropRange(e.clientX, e.clientY)
            if (range && els.content.contains(range.commonAncestorContainer)) {
                const fragment = document.createDocumentFragment()
                fragment.appendChild(wrapper)
                if (trailingBreak) fragment.appendChild(trailingBreak)
                range.insertNode(fragment)
            } else {
                els.content.appendChild(wrapper)
                if (trailingBreak) els.content.appendChild(trailingBreak)
            }
            queueSnapshot()
        }
        dragState = null
        document.removeEventListener("pointermove", handleMediaDragMove)
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
        deselectMedia()
        stopRecording()
        pageIndex = 0
        titleTouched = false
        autoSaveSnapshot = null
        drawingState.active = false
        drawingState.isDrawing = false
        if (els.drawingControls) {
            els.drawingControls.classList.add("hidden")
        }
        if (window.EditorDrawing) {
            EditorDrawing.setDrawingData("", { recordHistory: true, replaceHistory: true })
            EditorDrawing.cleanup()
        }
        if (observer) observer.disconnect()
    }

    const refreshFromRemote = (note) => {
        const current = StateStore.read().currentNote
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
            if (window.EditorAudio) EditorAudio.sync(els.content)
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

    const focusEditable = (el) => {
        const sel = window.getSelection()
        if (!sel) return
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        els.content?.focus()
    }

    const storeSelection = () => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        if (!els.content || !els.content.contains(range.commonAncestorContainer)) return
        savedRange = range.cloneRange()
    }

    const getTextNodes = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
        const nodes = []
        let current = walker.nextNode()
        while (current) {
            nodes.push(current)
            current = walker.nextNode()
        }
        return nodes
    }

    const getActiveRangeInContent = () => {
        const sel = window.getSelection()
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0)
            if (els.content && els.content.contains(range.commonAncestorContainer)) return range
        }
        if (savedRange && els.content && els.content.contains(savedRange.commonAncestorContainer)) return savedRange
        return null
    }

    const getCaretOffsetInBlock = (block, range) => {
        const targetRange = range || getActiveRangeInContent()
        if (!targetRange || !targetRange.collapsed) return null
        const nodes = getTextNodes(block)
        let offset = 0
        for (const node of nodes) {
            if (node === targetRange.startContainer) {
                return offset + targetRange.startOffset
            }
            offset += node.textContent?.length || 0
        }
        return null
    }

    const createRangeFromOffsets = (root, start, end) => {
        const range = document.createRange()
        const nodes = getTextNodes(root)
        let offset = 0
        let startNode = null
        let startOffset = 0
        let endNode = null
        let endOffset = 0
        for (const node of nodes) {
            const len = node.textContent?.length || 0
            if (!startNode && start <= offset + len) {
                startNode = node
                startOffset = Math.max(0, start - offset)
            }
            if (!endNode && end <= offset + len) {
                endNode = node
                endOffset = Math.max(0, end - offset)
            }
            offset += len
        }
        if (!startNode || !endNode) return null
        range.setStart(startNode, startOffset)
        range.setEnd(endNode, endOffset)
        return range
    }

    const getBlockFromRange = (range) => {
        let node = range.startContainer
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || node === els.content) return null
        if (node.classList?.contains("note-page")) return null
        const block = node.closest("div, p")
        if (block?.classList?.contains("note-page")) return null
        return block
    }

    const confirmEquationAtCaret = () => {
        const range = getActiveRangeInContent()
        if (!range || !range.collapsed) return false
        const target = getBlockFromRange(range) || getPages()[pageIndex] || els.content
        if (!target) return false
        const caretOffset = getCaretOffsetInBlock(target, range)
        if (caretOffset === null) return false
        const fullText = target.textContent || ""
        const expressionData = window.Calculator?.findExpressionAroundCaret?.(fullText, caretOffset)
        if (!expressionData) return false
        const result = window.Calculator?.evaluateExpression?.(expressionData.expression)
        if (!Number.isFinite(result)) return false
        const replaceRange = createRangeFromOffsets(target, expressionData.start, expressionData.end)
        if (!replaceRange) return false
        replaceRange.deleteContents()
        const formatted = window.Calculator?.formatResult?.(result) ?? String(result)
        replaceRange.insertNode(document.createTextNode(formatted))
        replaceRange.collapse(false)
        const sel = window.getSelection()
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(replaceRange)
        }
        queueSnapshot()
        return true
    }

    const restoreSelection = () => {
        if (!els.content) return null
        const sel = window.getSelection()
        let range = null
        if (savedRange && els.content.contains(savedRange.commonAncestorContainer)) {
            range = savedRange
        } else if (sel && sel.rangeCount && els.content.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            range = sel.getRangeAt(0)
        } else {
            range = document.createRange()
            range.selectNodeContents(els.content)
            range.collapse(false)
        }
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(range)
        }
        return range
    }

    const insertHtmlAtSelection = (html) => {
        if (!els.content) return
        const range = restoreSelection()
        const container = document.createElement("div")
        container.innerHTML = html
        const fragment = document.createDocumentFragment()
        while (container.firstChild) fragment.appendChild(container.firstChild)
        if (range) {
            range.deleteContents()
            range.insertNode(fragment)
            range.collapse(false)
            const sel = window.getSelection()
            if (sel) {
                sel.removeAllRanges()
                sel.addRange(range)
            }
        } else {
            els.content.appendChild(fragment)
        }
        storeSelection()
    }

    const insertNodeAtSelection = (node) => {
        if (!els.content) return
        const range = restoreSelection()
        if (range) {
            range.deleteContents()
            range.insertNode(node)
            range.setStartAfter(node)
            range.collapse(true)
            const sel = window.getSelection()
            if (sel) {
                sel.removeAllRanges()
                sel.addRange(range)
            }
        } else {
            els.content.appendChild(node)
        }
        storeSelection()
    }

    const normalizeStrikeTags = () => {
        if (!els.content) return
        els.content.querySelectorAll("strike").forEach(strike => {
            const replacement = document.createElement("s")
            while (strike.firstChild) replacement.appendChild(strike.firstChild)
            strike.replaceWith(replacement)
        })
    }

    const toggleStrikeThrough = () => {
        document.execCommand("strikeThrough")
        normalizeStrikeTags()
    }

    const insertHorizontalRule = () => {
        const hr = document.createElement("hr")
        insertNodeAtSelection(hr)
    }

    const wrapSelectionWithNode = (node) => {
        const range = getActiveRangeInContent()
        if (!range || range.collapsed) return null
        const content = range.extractContents()
        node.appendChild(content)
        range.insertNode(node)
        const nextRange = document.createRange()
        nextRange.selectNodeContents(node)
        nextRange.collapse(false)
        const sel = window.getSelection()
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(nextRange)
        }
        storeSelection()
        return node
    }

    const normalizeUrl = (value) => {
        const url = String(value || "").trim()
        if (!url) return ""
        if (/^https?:\/\//i.test(url)) return url
        if (/^mailto:/i.test(url)) return url
        if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) return `https://${url}`
        return url
    }

    const applyLink = (value) => {
        const url = normalizeUrl(value)
        if (!url) return
        const range = getActiveRangeInContent()
        if (!range || range.collapsed) {
            UI.showToast(UI.getText("link_selection_required", "Select text to link"))
            return
        }
        const link = document.createElement("a")
        link.href = url
        wrapSelectionWithNode(link)
    }

    const applyNoteLink = (value) => {
        const noteId = String(value || "").trim()
        if (!noteId) return
        const range = getActiveRangeInContent()
        if (!range || range.collapsed) {
            UI.showToast(UI.getText("note_link_selection_required", "Select text to link"))
            return
        }
        const note = StateStore.read().notes.find(item => item.id === noteId)
        if (!note) {
            UI.showToast(UI.getText("note_link_not_found", "Note not found"))
            return
        }
        const link = document.createElement("a")
        link.dataset.noteId = noteId
        wrapSelectionWithNode(link)
    }

    const openNoteById = (noteId) => {
        const note = StateStore.read().notes.find(item => item.id === noteId)
        if (!note) {
            UI.showToast(UI.getText("note_link_not_found", "Note not found"))
            return
        }
        openFromList(note)
    }

    const getDropRange = (x, y) => {
        if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y)
        if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y)
            if (!pos) return null
            const range = document.createRange()
            range.setStart(pos.offsetNode, pos.offset)
            range.collapse(true)
            return range
        }
        return null
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

    const getTextFromHtml = (html) => {
        const text = Utils.stripHtml(html || "")
        return text.replace(/\s+/g, " ").trim()
    }

    const getMediaCountsFromHtml = (html) => {
        const wrapper = document.createElement("div")
        wrapper.innerHTML = html || ""
        return {
            images: wrapper.querySelectorAll("img").length,
            audio: wrapper.querySelectorAll("audio").length
        }
    }

    const getCountLabel = (count, singleKey, pluralKey) => {
        if (count === 1) return UI.getText(singleKey, singleKey)
        return UI.getText(pluralKey, UI.getText(singleKey, singleKey))
    }

    const formatMediaSummary = (counts) => {
        const parts = []
        if (counts.images) {
            parts.push(`${counts.images} ${getCountLabel(counts.images, "media_photo", "media_photos")}`)
        }
        if (counts.audio) {
            parts.push(`${counts.audio} ${getCountLabel(counts.audio, "media_audio", "media_audios")}`)
        }
        return parts.join(" · ")
    }

    const buildAutoTitle = (html) => {
        const text = getTextFromHtml(html)
        if (text) {
            const line = text.split(/\r?\n/).find(l => l.trim()) || text
            const normalized = line.trim()
            return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized
        }
        return formatMediaSummary(getMediaCountsFromHtml(html)) || UI.getText("untitled_note", "Untitled")
    }

    const extractHashtags = (value) => {
        const res = new Set()
        const text = String(value || "")
        for (const match of text.matchAll(/#([\p{L}\p{N}_-]{2,})/gu)) {
            const tag = match[1]?.trim()
            if (tag) res.add(tag)
        }
        return [...res]
    }

    const collectSuggestedTags = (title, content) => {
        const text = `${title || ""} ${Utils.stripHtml(content || "")}`
        const fromSmart = SmartSearch.suggestTags(title || "", content || "")
        const fromHash = extractHashtags(text)
        return [...new Set([...fromSmart, ...fromHash])]
    }

    const syncAutoTitle = () => {
        if (!els.title || titleTouched) return
        const html = els.content?.innerHTML || ""
        const next = buildAutoTitle(html)
        if (!next) return
        if (els.title.value !== next) els.title.value = next
    }

    const addTag = (tag) => {
        const t = String(tag || "").trim().replace(/^#+/, "")
        if (!t) return
        const n = StateStore.read().currentNote
        const tags = n.tags ? [...n.tags] : []
        if (tags.some(x => x.toLowerCase() === t.toLowerCase())) return
        
        tags.push(t)
        StateStore.update("currentNote", { ...n, tags })
        renderTags()
        queueSnapshot()
    }

    const removeTag = (tag) => {
        const n = StateStore.read().currentNote
        if (!n) return
        const tags = (n.tags || []).filter(x => x.toLowerCase() !== tag.toLowerCase())
        StateStore.update("currentNote", { ...n, tags })
        renderTags()
        queueSnapshot()
    }

    const renderTags = () => {
        const n = StateStore.read().currentNote
        if (!n || !els.tagsContainer) return
        const tags = n.tags || []
        
        els.tagsContainer.innerHTML = tags.map(t => `
            <span class="tag-chip" data-action="remove-tag" data-tag="${encodeURIComponent(t)}">
                <i class="material-icons-round" aria-hidden="true">tag</i>
                <span>${Utils.escapeHtml(t)}</span>
            </span>
        `).join("")

        const sugs = collectSuggestedTags(n.title, n.content)
            .filter(x => !tags.some(t => t.toLowerCase() === x.toLowerCase()))
            .slice(0, 5)

        if (sugs.length) {
            const wrap = document.createElement("div")
            wrap.style.cssText = "display:flex; flex-wrap:wrap; gap:8px;"
            sugs.forEach(t => {
                const b = document.createElement("span")
                b.className = "tag-suggest"
                b.textContent = `#${t}`
                b.dataset.action = "add-tag"
                b.dataset.tag = encodeURIComponent(t)
                wrap.appendChild(b)
            })
            els.tagsContainer.appendChild(wrap)
        }
    }

    const captureSnapshot = () => {
        const currentNote = StateStore.read().currentNote
        const drawings = normalizePageDrawings(currentNote, getPages().length)
        const activeDrawing = window.EditorDrawing?.getDrawingSnapshot?.()
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

    const queueSnapshot = Utils.debounce(() => {
        syncAutoTitle()
        StateStore.update("editorDirty", true)
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
                pageDrawings: current.pageDrawings,
                updatedAt: Utils.serverTimestamp()
            })
        }
        scheduleAutoSave()
    }, CONFIG.SNAPSHOT_DELAY)

    const scheduleAutoSave = Utils.debounce(async () => {
        const currentNote = StateStore.read().currentNote
        if (!currentNote || !StateStore.read().editorDirty) return
        const snap = captureSnapshot()
        if (autoSaveSnapshot && snapshotsEqual(autoSaveSnapshot, snap)) return
        await save({ silent: true })
        autoSaveSnapshot = captureSnapshot()
    }, 1200)

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

    const insertMedia = (src, type) => {
        if (type !== "image") return
        const id = Utils.generateId()
        const html = `
            <div class="media-wrapper" id="${id}" contenteditable="false" draggable="true">
                <img src="${Utils.escapeHtml(src)}" alt="">
                <span class="media-resize-handle" aria-hidden="true"></span>
            </div><br>
        `
        insertHtmlAtSelection(html)
        makeMediaDraggable()
        syncMediaSizes()
    }

    const insertAudio = (src) => {
        if (!window.EditorAudio) return
        const html = EditorAudio.createAudioBlockHtml(src)
        insertHtmlAtSelection(html)
        EditorAudio.sync(els.content)
    }

    const makeMediaDraggable = () => {
        els.content.querySelectorAll(".media-wrapper").forEach(w => {
            w.setAttribute("draggable", "true")
            w.contentEditable = "false"
        })
    }

    const syncMediaSizes = () => {
        if (!els.content) return
        const page = getPages()[pageIndex] || els.content
        const parentWidth = page.getBoundingClientRect().width - 40
        const maxWidth = Math.min(CONFIG.MAX_IMG_WIDTH, parentWidth)
        els.content.querySelectorAll(".media-wrapper").forEach(wrapper => {
            const img = wrapper.querySelector("img")
            if (!img) return
            const apply = () => {
                const width = parseFloat(wrapper.dataset.width || "")
                const height = parseFloat(wrapper.dataset.height || "")
                if (width && height) {
                    img.style.width = `${width}px`
                    img.style.height = `${height}px`
                    return
                }
                const naturalWidth = img.naturalWidth || img.width
                const naturalHeight = img.naturalHeight || img.height
                if (!naturalWidth || !naturalHeight) return
                const ratio = naturalWidth / Math.max(1, naturalHeight)
                const targetWidth = Utils.clamp(naturalWidth, CONFIG.MIN_IMG_WIDTH, maxWidth)
                const targetHeight = targetWidth / ratio
                img.style.width = `${targetWidth}px`
                img.style.height = `${targetHeight}px`
                wrapper.dataset.width = targetWidth
                wrapper.dataset.height = targetHeight
            }
            if (img.complete) apply()
            else img.addEventListener("load", apply, { once: true })
        })
    }

    const selectMedia = (el) => {
        deselectMedia()
        selectedMedia = el
        selectedMedia.classList.add("selected")
        
        const menu = els.ctxMenu
        if (!menu) return
        
        menu.classList.remove("hidden")
        const rect = el.getBoundingClientRect()
        const top = rect.top - 60
        const left = rect.left + (rect.width / 2) - (menu.offsetWidth / 2)
        
        menu.style.top = `${Math.max(10, top)}px`
        menu.style.left = `${Math.max(10, Math.min(window.innerWidth - menu.offsetWidth - 10, left))}px`
    }

    const deselectMedia = () => {
        if (selectedMedia) selectedMedia.classList.remove("selected")
        selectedMedia = null
        els.ctxMenu?.classList.add("hidden")
    }

    const resetMediaTransform = () => {
        if (!selectedMedia) return
        const img = selectedMedia.querySelector("img")
        if (img) {
            img.style.width = ""
            img.style.height = ""
            delete selectedMedia.dataset.width
            delete selectedMedia.dataset.height
        }
    }

    const alignMediaOrText = (side) => {
        if (selectedMedia) {
            selectedMedia.classList.remove("align-left", "align-right")
            if (side !== "center") selectedMedia.classList.add(`align-${side}`)
        } else {
            const cmd = side === "center" ? "justifyCenter" : (side === "right" ? "justifyRight" : "justifyLeft")
            document.execCommand(cmd)
        }
        closeAlignMenu()
    }

    const toggleAlignMenu = (btn) => {
        const menu = els.alignMenu
        if (!menu || !btn) return
        if (menu.classList.contains("active") && alignMenuTarget === btn) {
            closeAlignMenu()
            return
        }
        alignMenuTarget = btn
        const rect = btn.getBoundingClientRect()
        menu.classList.remove("hidden")
        menu.classList.add("active")
        const left = Math.min(window.innerWidth - menu.offsetWidth - 10, rect.left)
        menu.style.left = `${Math.max(10, left)}px`
        menu.style.top = `${rect.bottom + 8}px`
    }

    const closeAlignMenu = () => {
        const menu = els.alignMenu
        if (!menu) return
        menu.classList.remove("active")
        menu.classList.add("hidden")
        alignMenuTarget = null
    }

    const getActiveBlock = () => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        let node = sel.anchorNode
        if (!node) return null
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || node === els.content) return null
        if (node.classList?.contains("note-page")) return null
        const block = node.closest("div, p")
        if (block?.classList?.contains("note-page")) return null
        return block
    }

    const handleTagLineEnter = (e) => {
        if (e.key !== "Enter") return
        const block = getActiveBlock()
        if (!block || !els.content.contains(block)) return
        const text = block.textContent.trim()
        if (/^#\S+$/.test(text)) {
            e.preventDefault()
            block.classList.add("tag-line")
        } else {
            block.classList.remove("tag-line")
        }
    }

    const deleteSelectedMedia = () => {
        selectedMedia?.remove()
        deselectMedia()
    }

    const confirmEquation = () => {
        confirmEquationAtCaret()
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
