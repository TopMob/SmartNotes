const Editor = (() => {
    let els = {}
    let history = []
    let future = []
    let selectedMedia = null
    let resizeState = null
    let observer = null
    let abortController = null
    let recordingStream = null

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
            content: document.getElementById("note-content-editable"),
            toolbar: document.getElementById("editor-toolbar"),
            tagsInput: document.getElementById("note-tags-input"),
            tagsContainer: document.getElementById("note-tags-container"),
            ctxMenu: document.getElementById("media-context-menu"),
            scrollArea: document.querySelector(".editor-scroll-area")
        }
        loadToolSettings()
        buildToolbar()
        bind()
    }

    const bind = () => {
        if (abortController) abortController.abort()
        abortController = new AbortController()
        const { signal } = abortController

        if (els.title) {
            els.title.addEventListener("input", queueSnapshot, { signal })
        }

        if (els.content) {
            observer = new MutationObserver(queueSnapshot)
            observer.observe(els.content, { childList: true, subtree: true, characterData: true, attributes: true })

            els.content.addEventListener("paste", handlePaste, { signal })
            els.content.addEventListener("keydown", handleTagLineEnter, { signal })
            
            els.content.addEventListener("click", (e) => {
                const wrapper = e.target.closest(".media-wrapper")
                if (wrapper) {
                    selectMedia(wrapper)
                    e.stopPropagation()
                    return
                }
                deselectMedia()
            }, { signal })

            els.content.addEventListener("change", (e) => {
                if (e.target.matches(".task-checkbox")) toggleTask(e.target)
            }, { signal })

            els.content.addEventListener("pointerdown", handleResizeStart, { signal })
        }

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
            // Remove old listener if exists (simple way without abortController for external element)
            const newBtn = lockApply.cloneNode(true)
            lockApply.parentNode.replaceChild(newBtn, lockApply)
            newBtn.addEventListener("click", handleLockApply)
        }
    }

    const handlePaste = (e) => {
        e.preventDefault()
        const text = e.clipboardData.getData("text/plain")
        const html = e.clipboardData.getData("text/html")
        
        let safeContent = text
        if (html) {
            // Basic sanitization for paste: strip styles, keeping structure
            const div = document.createElement("div")
            div.innerHTML = html
            div.querySelectorAll("*").forEach(el => {
                el.removeAttribute("style")
                el.removeAttribute("class")
                if (el.tagName === "IMG") el.remove() // Prevent external images
            })
            safeContent = div.innerHTML
        }
        
        document.execCommand("insertHTML", false, safeContent || text)
    }

    const handleLockApply = async () => {
        const pass = document.getElementById("lock-password")?.value || ""
        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        if (!pass.trim()) return UI.showToast(UI.getText("lock_password_empty", "Password is empty"))
        
        const nextNote = { ...currentNote }
        await LockService.setLock(nextNote, pass.trim())
        StateStore.update("currentNote", nextNote)
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
                <button type="button" class="tool-btn" data-tool-idx="${idx}" aria-label="${t.i}">
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
                    t.cmd()
                    els.content?.focus()
                }
            })
        })
    }

    const getToolList = () => [
        { id: "bold", i: "format_bold", label: "tool_bold", cmd: () => document.execCommand("bold") },
        { id: "italic", i: "format_italic", label: "tool_italic", cmd: () => document.execCommand("italic") },
        { id: "underline", i: "format_underlined", label: "tool_underline", cmd: () => document.execCommand("underline") },
        { id: "bullets", i: "format_list_bulleted", label: "tool_bullets", cmd: () => document.execCommand("insertUnorderedList") },
        { id: "numbered", i: "format_list_numbered", label: "tool_numbered", cmd: () => document.execCommand("insertOrderedList") },
        { id: "task", i: "checklist", label: "tool_task", cmd: () => insertChecklistLine() },
        { id: "image", i: "image", label: "tool_image", cmd: () => document.getElementById("img-upload")?.click() },
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

    const insertChecklistLine = () => {
        const html = '<div class="task-item"><input class="task-checkbox" type="checkbox"><span class="task-text"></span></div>'
        document.execCommand("insertHTML", false, html)
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

    const toggleTask = (el) => {
        const item = el.closest(".task-item")
        if (item) item.classList.toggle("completed", !!el.checked)
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
        const parentWidth = els.content.getBoundingClientRect().width - 40
        
        resizeState = {
            startX: e.clientX || e.touches?.[0].clientX,
            startWidth: rect.width,
            ratio: rect.width / Math.max(1, rect.height),
            maxWidth: Math.min(CONFIG.MAX_IMG_WIDTH, parentWidth),
            wrapper,
            img
        }

        const moveEvent = e.type === "touchstart" ? "touchmove" : "pointermove"
        const upEvent = e.type === "touchstart" ? "touchend" : "pointerup"

        document.addEventListener(moveEvent, handleResizeMove, { passive: false })
        document.addEventListener(upEvent, handleResizeEnd, { once: true })
    }

    const handleResizeMove = (e) => {
        if (!resizeState) return
        e.preventDefault() // Prevent scroll on touch
        
        const clientX = e.clientX || e.touches?.[0].clientX
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
        document.removeEventListener("touchmove", handleResizeMove)
        document.removeEventListener("pointermove", handleResizeMove)
        queueSnapshot() // Force snapshot after resize
    }

    const open = (note = null) => {
        const current = StateStore.read()
        const folderId = current.view === "folder" ? current.activeFolderId : null
        
        // Generate new note logic
        const n = note ? NoteIO.normalizeNote(note) : NoteIO.normalizeNote({
            id: Utils.generateId(),
            folderId,
            createdAt: Utils.serverTimestamp(),
            order: Date.now()
        })

        StateStore.update("currentNote", JSON.parse(JSON.stringify(n)))
        
        // Reset State
        history = []
        future = []
        renderState()
        
        // Initial Snapshot
        history.push(captureSnapshot())
        
        els.wrapper.classList.add("active")
        setTimeout(() => els.content?.focus(), 50)
        UI.toggleSidebar(false)
    }

    const openFromList = async (note) => {
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
        // Stop observing when closed
        if (observer) observer.disconnect()
    }

    const renderState = () => {
        const n = StateStore.read().currentNote
        if (!n) return
        els.title.value = n.title || ""
        els.content.innerHTML = Utils.sanitizeHtml(n.content || "")
        renderTags()
        makeMediaDraggable()
        syncTaskStates()
        if (observer && els.content) {
            observer.disconnect()
            observer.observe(els.content, { childList: true, subtree: true, characterData: true, attributes: true })
        }
    }

    const syncTaskStates = () => {
        els.content.querySelectorAll(".task-checkbox").forEach(cb => {
            const item = cb.closest(".task-item")
            if (item) item.classList.toggle("completed", !!cb.checked)
        })
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

        // Suggestions
        const sugs = SmartSearch.suggestTags(n.title, n.content)
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

    const captureSnapshot = () => ({
        title: els.title.value || "",
        content: els.content.innerHTML || "",
        tags: [...(StateStore.read().currentNote?.tags || [])]
    })

    const snapshotsEqual = (a, b) => 
        a.title === b.title && 
        a.content === b.content && 
        JSON.stringify(a.tags) === JSON.stringify(b.tags)

    const queueSnapshot = Utils.debounce(() => {
        StateStore.update("editorDirty", true)
        const prev = history[history.length - 1]
        const current = captureSnapshot()
        
        if (prev && snapshotsEqual(prev, current)) return

        history.push(current)
        if (history.length > CONFIG.MAX_HISTORY) history.shift()
        future = []
        
        // Update store live
        const n = StateStore.read().currentNote
        if (n) {
            StateStore.update("currentNote", { 
                ...n, 
                title: current.title, 
                content: current.content,
                updatedAt: Utils.serverTimestamp()
            })
        }
    }, CONFIG.SNAPSHOT_DELAY)

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
            tags: snap.tags 
        })
        renderState() // This recreates DOM, losing cursor
        // Cursor logic omitted for simplicity in non-VDOM editor
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
        document.execCommand("insertHTML", false, html)
        makeMediaDraggable()
    }

    const insertAudio = (src) => {
        const id = Utils.generateId()
        const html = `
            <div class="media-wrapper audio-wrapper" id="${id}" contenteditable="false" draggable="true">
                <audio controls src="${Utils.escapeHtml(src)}"></audio>
            </div><br>
        `
        document.execCommand("insertHTML", false, html)
        makeMediaDraggable()
    }

    const makeMediaDraggable = () => {
        els.content.querySelectorAll(".media-wrapper").forEach(w => {
            w.setAttribute("draggable", "true")
            w.contentEditable = "false"
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
    }

    const getActiveBlock = () => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        let node = sel.anchorNode
        if (!node) return null
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || node === els.content) return null
        return node.closest("div, p")
    }

    const handleTagLineEnter = (e) => {
        if (e.key !== "Enter") return
        const block = getActiveBlock()
        if (!block || block.parentElement !== els.content) return
        const text = block.textContent.trim()
        if (/^#[^\s#]+$/.test(text)) {
            block.classList.add("tag-line")
        } else {
            block.classList.remove("tag-line")
        }
    }

    const deleteSelectedMedia = () => {
        selectedMedia?.remove()
        deselectMedia()
    }

    const toggleToolbar = () => els.toolbar?.classList.toggle("is-hidden")

    const save = async (options = {}) => {
        const user = StateStore.read().user
        if (!db || !user) return

        const n = StateStore.read().currentNote
        if (!n) return

        // Auto-tagging
        const autoTags = SmartSearch.suggestTags(n.title, n.content)
        const currentTags = new Set(n.tags.map(t => t.toLowerCase()))
        autoTags.forEach(t => {
            if (!currentTags.has(t.toLowerCase())) n.tags.push(t)
        })

        // Folder logic
        if (!n.folderId) {
            const suggested = SmartSearch.suggestFolderId(n, StateStore.read().folders)
            if (suggested) n.folderId = suggested
        }

        const payload = NoteIO.normalizeNote(n)
        const ref = db.collection("users").doc(user.uid).collection("notes").doc(payload.id)
        
        try {
            await ref.set({ ...payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
            StateStore.update("editorDirty", false)
            if (!options.silent) UI.showToast(UI.getText("saved", "Saved"))
            close()
        } catch (e) {
            UI.showToast("Save failed")
        }
    }

    const deleteCurrent = () => {
        const n = StateStore.read().currentNote
        if (!n) return
        UI.confirm("delete", async () => {
            if (!db || !StateStore.read().user) return
            await db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(n.id).delete()
            UI.showToast(UI.getText("note_deleted", "Deleted"))
            close()
        })
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
        toggleToolbar,
        getToolList,
        getEnabledTools,
        setToolEnabled,
        resetMediaTransform,
        alignMediaOrText,
        deleteSelectedMedia,
        drawOnSelectedMedia: () => UI.showToast(UI.getText("draw_photo_hint", "Use photo editor")),
        toggleRecording
    }
})()
.tag-chip {
    /* Градиентный фон с акцентным цветом */
    background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.15), rgba(var(--primary-rgb), 0.05));
    border: 1px solid rgba(var(--primary-rgb), 0.3);
    color: var(--text);
    border-radius: 999px;
    padding: 6px 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    font-size: 13px;
    
    /* Эффект стекла и тени */
    backdrop-filter: blur(5px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Эффект при наведении */
.tag-chip:hover {
    transform: translateY(-2px);
    background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.25), rgba(var(--primary-rgb), 0.1));
    border-color: rgba(var(--primary-rgb), 0.6);
    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.25);
    color: #fff;
}

/* Иконка решетки внутри тега */
.tag-chip i {
    font-size: 15px;
    color: var(--primary); /* Красим иконку в основной цвет */
    opacity: 1;
}

/* --- 2. Поле ввода тегов --- */
/* Замените стили для #note-tags-input */
#note-tags-input {
    width: 100%;
    min-width: 0;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    color: var(--text);
    transition: all 0.25s ease;
}

/* Подсветка при клике в поле */
#note-tags-input:focus {
    background: rgba(15, 15, 17, 0.8);
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.1);
    transform: translateY(-1px);
}
