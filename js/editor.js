const Editor = {
    els: {},
    history: [],
    future: [],
    selectedMedia: null,
    resizeState: null,
    snapshotTimer: null,

    init() {
        this.els = {
            wrapper: document.getElementById("note-editor"),
            title: document.getElementById("note-title"),
            content: document.getElementById("note-content-editable"),
            toolbar: document.getElementById("editor-toolbar"),
            tagsInput: document.getElementById("note-tags-input"),
            tagsContainer: document.getElementById("note-tags-container"),
            scrollArea: document.querySelector(".editor-scroll-area"),
            ctxMenu: document.getElementById("media-context-menu")
        }
        this.loadToolSettings()
        this.buildToolbar()
        this.bind()
    },

    bind() {
        if (this.els.title) this.els.title.addEventListener("input", () => this.queueSnapshot())
        if (this.els.content) {
            this.els.content.addEventListener("input", () => this.queueSnapshot())
            this.els.content.addEventListener("click", (e) => {
                const wrapper = e.target.closest(".media-wrapper")
                if (wrapper) {
                    this.selectMedia(wrapper)
                    return
                }
                this.deselectMedia()
            })
            this.els.content.addEventListener("change", (e) => {
                if (e.target.matches(".task-checkbox")) {
                    this.toggleTask(e.target)
                }
            })
            this.els.content.addEventListener("pointerdown", (e) => {
                const handle = e.target.closest(".media-resize-handle")
                if (!handle) return
                const wrapper = e.target.closest(".media-wrapper")
                const img = wrapper ? wrapper.querySelector("img") : null
                if (!wrapper || !img) return
                const rect = img.getBoundingClientRect()
                const ratio = rect.width > 0 ? rect.width / Math.max(1, rect.height) : 1
                const maxWidth = Math.min(860, this.els.content.getBoundingClientRect().width - 20)
                this.resizeState = { startX: e.clientX, startWidth: rect.width, ratio, maxWidth, wrapper }
                document.addEventListener("pointermove", this.handleResize, { passive: true })
                document.addEventListener("pointerup", this.stopResize, { passive: true })
            })
        }
        if (this.els.scrollArea) {
            this.els.scrollArea.addEventListener("scroll", () => this.deselectMedia())
        }
        if (this.els.tagsInput) {
            this.els.tagsInput.addEventListener("keydown", (e) => {
                if (e.key !== "Enter") return
                e.preventDefault()
                const v = String(this.els.tagsInput.value || "").trim()
                if (!v) return
                const tag = v.startsWith("#") ? v.slice(1) : v
                this.addTag(tag)
                this.els.tagsInput.value = ""
            })
        }
        if (this.els.tagsContainer) {
            this.els.tagsContainer.addEventListener("click", (e) => {
                const remove = e.target.closest("[data-action='remove-tag']")
                if (remove) {
                    const raw = remove.dataset.tag || ""
                    this.removeTag(decodeURIComponent(raw))
                    return
                }
                const add = e.target.closest("[data-action='add-tag']")
                if (add) {
                    const raw = add.dataset.tag || ""
                    this.addTag(decodeURIComponent(raw))
                }
            })
        }

        const imgUpload = document.getElementById("img-upload")
        if (imgUpload) {
            imgUpload.addEventListener("change", async (e) => {
                const f = e.target.files && e.target.files[0] ? e.target.files[0] : null
                if (!f) return
                const url = await this.fileToDataUrl(f)
                this.insertMedia(url, "image")
                imgUpload.value = ""
            })
        }

        const lockApply = document.getElementById("lock-apply")
        if (lockApply) {
            lockApply.addEventListener("click", async () => {
                const pass = document.getElementById("lock-password")?.value || ""
                if (!state.currentNote) return
                if (!pass.trim()) return UI.showToast(UI.getText("lock_password_empty", "Password is empty"))
                await LockService.setLock(state.currentNote, pass.trim())
                UI.closeModal("lock-modal")
                UI.showToast(UI.getText("lock_hidden", "Note hidden"))
            })
        }
    },

    buildToolbar() {
        const root = this.els.toolbar
        if (!root) return
        const enabled = this.getEnabledTools()
        const tools = this.getToolList().filter(t => enabled[t.id] !== false)
        root.innerHTML = tools.map((t, idx) => `
            <span class="tool-wrapper">
                <button type="button" class="tool-btn" data-tool="${idx}" aria-label="${t.i}">
                    <i class="material-icons-round" aria-hidden="true">${t.i}</i>
                </button>
            </span>
        `).join("")
        Array.from(root.querySelectorAll(".tool-btn")).forEach(btn => {
            const idx = parseInt(btn.dataset.tool, 10)
            btn.addEventListener("click", () => {
                const t = tools[idx]
                if (!t) return
                t.cmd()
                this.queueSnapshot()
                this.els.content?.focus()
            })
        })
    },

    getToolList() {
        return [
            { id: "bold", i: "format_bold", label: "tool_bold", cmd: () => document.execCommand("bold") },
            { id: "italic", i: "format_italic", label: "tool_italic", cmd: () => document.execCommand("italic") },
            { id: "underline", i: "format_underlined", label: "tool_underline", cmd: () => document.execCommand("underline") },
            { id: "bullets", i: "format_list_bulleted", label: "tool_bullets", cmd: () => document.execCommand("insertUnorderedList") },
            { id: "numbered", i: "format_list_numbered", label: "tool_numbered", cmd: () => document.execCommand("insertOrderedList") },
            { id: "task", i: "checklist", label: "tool_task", cmd: () => this.insertChecklistLine() },
            { id: "image", i: "image", label: "tool_image", cmd: () => document.getElementById("img-upload")?.click() },
            { id: "clear", i: "format_clear", label: "tool_clear", cmd: () => document.execCommand("removeFormat") }
        ]
    },

    getEnabledTools() {
        return state.config.editorTools || {}
    },

    loadToolSettings() {
        const defaults = {}
        this.getToolList().forEach(tool => {
            defaults[tool.id] = true
        })
        let stored = null
        try {
            stored = JSON.parse(localStorage.getItem("editor-tools"))
        } catch {
            stored = null
        }
        const next = { ...defaults, ...(stored || {}) }
        state.config.editorTools = next
        localStorage.setItem("editor-tools", JSON.stringify(next))
    },

    setToolEnabled(id, enabled) {
        const current = this.getEnabledTools()
        current[id] = !!enabled
        state.config.editorTools = { ...current }
        localStorage.setItem("editor-tools", JSON.stringify(state.config.editorTools))
        this.buildToolbar()
    },

    insertChecklistLine() {
        const html = '<div class="task-item"><input class="task-checkbox" type="checkbox"><span class="task-text"></span></div>'
        document.execCommand("insertHTML", false, html)
        const items = this.els.content.querySelectorAll(".task-item")
        const last = items[items.length - 1]
        if (last) {
            const span = last.querySelector(".task-text")
            if (span) {
                const range = document.createRange()
                range.selectNodeContents(span)
                range.collapse(true)
                const sel = window.getSelection()
                sel.removeAllRanges()
                sel.addRange(range)
            }
        }
        this.queueSnapshot()
    },

    toggleTask(el) {
        const item = el.closest(".task-item")
        if (item) item.classList.toggle("completed", !!el.checked)
        this.queueSnapshot()
    },

    async fileToDataUrl(file) {
        return await new Promise((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => resolve(String(r.result || ""))
            r.onerror = () => reject(new Error("file_read_failed"))
            r.readAsDataURL(file)
        })
    },

    handleResize: (e) => {
        if (!Editor.resizeState) return
        const s = Editor.resizeState
        const dx = e.clientX - s.startX
        let w = s.startWidth + dx
        w = Utils.snap(w, 8)
        w = Utils.clamp(w, 120, s.maxWidth)
        const h = w / Math.max(0.2, s.ratio)
        const img = s.wrapper.querySelector("img")
        if (!img) return
        img.style.width = `${w}px`
        img.style.height = `${h}px`
        s.wrapper.dataset.width = `${w}`
        s.wrapper.dataset.height = `${h}`
    },

    stopResize: () => {
        if (!Editor.resizeState) return
        Editor.queueSnapshot()
        Editor.resizeState = null
        document.removeEventListener("pointermove", Editor.handleResize)
        document.removeEventListener("pointerup", Editor.stopResize)
    },

    open(note = null) {
        const n = note ? NoteIO.normalizeNote(note) : NoteIO.normalizeNote({
            id: Utils.generateId(),
            folderId: state.view === "folder" ? state.activeFolderId : null,
            createdAt: Utils.serverTimestamp(),
            order: Date.now()
        })
        state.currentNote = JSON.parse(JSON.stringify(n))
        this.history = []
        this.future = []
        this.renderState()
        this.history = [this.captureSnapshot()]
        this.els.wrapper.classList.add("active")
        setTimeout(() => this.els.content?.focus(), 90)
        UI.toggleSidebar(false)
    },

    async maybeUnlock(note) {
        if (!note.lock || !note.lock.hash) return true
        return await new Promise((resolve) => {
            UI.showPrompt(UI.getText("lock_title", "Lock"), UI.getText("lock_password", "Password"), async (val) => {
                const ok = await LockService.verify(note, val)
                if (!ok) UI.showToast(UI.getText("lock_invalid_password", "Invalid password"))
                resolve(ok)
            })
        })
    },

    async openFromList(note) {
        const ok = await this.maybeUnlock(note)
        if (!ok) return
        this.open(note)
    },

    close() {
        this.els.wrapper.classList.remove("active")
        state.currentNote = null
        this.deselectMedia()
    },

    renderState() {
        const n = state.currentNote
        if (!n) return
        this.els.title.value = n.title || ""
        this.els.content.innerHTML = Utils.sanitizeHtml(n.content || "")
        this.renderTags()
        this.makeMediaDraggable()
        this.syncTaskStates()
    },

    syncTaskStates() {
        if (!this.els.content) return
        this.els.content.querySelectorAll(".task-checkbox").forEach(cb => {
            const item = cb.closest(".task-item")
            if (item) item.classList.toggle("completed", !!cb.checked)
        })
    },

    addTag(tag) {
        const t = String(tag || "").trim()
        if (!t) return
        const n = state.currentNote
        if (!n) return
        const clean = t.replace(/^#+/, "").trim()
        if (!clean) return
        n.tags = Array.isArray(n.tags) ? n.tags : []
        if (n.tags.map(x => String(x).toLowerCase()).includes(clean.toLowerCase())) return
        n.tags.push(clean)
        this.renderTags()
        this.queueSnapshot()
    },

    removeTag(tag) {
        const n = state.currentNote
        if (!n || !Array.isArray(n.tags)) return
        n.tags = n.tags.filter(x => String(x).toLowerCase() !== String(tag).toLowerCase())
        this.renderTags()
        this.queueSnapshot()
    },

    renderTags() {
        const n = state.currentNote
        if (!n || !this.els.tagsContainer) return
        const tags = Array.isArray(n.tags) ? n.tags : []
        const html = tags.map(t => `
            <span class="tag-chip" data-action="remove-tag" data-tag="${encodeURIComponent(String(t))}">
                <i class="material-icons-round" aria-hidden="true">tag</i>
                <span>${Utils.escapeHtml(String(t))}</span>
            </span>
        `).join("")
        this.els.tagsContainer.innerHTML = html

        const sug = SmartSearch.suggestTags(n.title, n.content).filter(x => !tags.map(t => String(t).toLowerCase()).includes(x.toLowerCase()))
        if (sug.length) {
            const wrap = document.createElement("div")
            wrap.style.display = "flex"
            wrap.style.flexWrap = "wrap"
            wrap.style.gap = "8px"
            sug.slice(0, 6).forEach(t => {
                const b = document.createElement("span")
                b.className = "tag-suggest"
                b.textContent = `#${t}`
                b.dataset.action = "add-tag"
                b.dataset.tag = encodeURIComponent(t)
                wrap.appendChild(b)
            })
            this.els.tagsContainer.appendChild(wrap)
        }
    },

    queueSnapshot() {
        state.editorDirty = true
        clearTimeout(this.snapshotTimer)
        this.snapshotTimer = setTimeout(() => this.snapshot(), 260)
    },

    captureSnapshot() {
        return {
            title: String(this.els.title.value || ""),
            content: String(this.els.content.innerHTML || ""),
            tags: Array.isArray(state.currentNote?.tags) ? [...state.currentNote.tags] : []
        }
    },

    snapshotsEqual(a, b) {
        if (!a || !b) return false
        return a.title === b.title && a.content === b.content && JSON.stringify(a.tags || []) === JSON.stringify(b.tags || [])
    },

    snapshot() {
        const n = state.currentNote
        if (!n) return
        n.title = String(this.els.title.value || "")
        n.content = String(this.els.content.innerHTML || "")
        n.updatedAt = Utils.serverTimestamp()
        const next = this.captureSnapshot()
        const last = this.history[this.history.length - 1]
        if (last && this.snapshotsEqual(last, next)) return
        this.history.push(JSON.parse(JSON.stringify(next)))
        if (this.history.length > 80) this.history.shift()
        this.future = []
    },

    applySnapshot(snapshot) {
        const n = state.currentNote
        if (!n || !snapshot) return
        n.title = snapshot.title
        n.content = snapshot.content
        n.tags = snapshot.tags
        this.renderState()
    },

    undo() {
        const n = state.currentNote
        if (!n) return
        if (this.history.length <= 1) return
        const current = this.history.pop()
        this.future.push(current)
        const prev = this.history[this.history.length - 1]
        this.applySnapshot(prev)
    },

    redo() {
        const n = state.currentNote
        if (!n) return
        const next = this.future.pop()
        if (!next) return
        this.history.push(next)
        this.applySnapshot(next)
    },

    insertMedia(src, type) {
        const id = Utils.generateId()
        let html = ""
        if (type === "image") {
            html = `<div class="media-wrapper" id="${id}" contenteditable="false" draggable="true" data-scale="1"><img src="${Utils.escapeHtml(src)}" alt=""><span class="media-resize-handle" aria-hidden="true"></span></div><br>`
        }
        document.execCommand("insertHTML", false, html)
        this.queueSnapshot()
        this.makeMediaDraggable()
    },

    makeMediaDraggable() {
        const root = this.els.content
        if (!root) return
        root.querySelectorAll(".media-wrapper").forEach(w => {
            w.setAttribute("draggable", "true")
            w.setAttribute("contenteditable", "false")
        })
    },

    selectMedia(el) {
        if (this.selectedMedia) this.selectedMedia.classList.remove("selected")
        this.selectedMedia = el
        this.selectedMedia.classList.add("selected")
        const rect = el.getBoundingClientRect()
        const menu = this.els.ctxMenu
        if (!menu) return
        menu.classList.remove("hidden")
        const top = rect.top - 56
        const left = rect.left + rect.width / 2 - menu.offsetWidth / 2
        const safeTop = Math.max(10, top)
        const safeLeft = Math.max(10, Math.min(window.innerWidth - menu.offsetWidth - 10, left))
        menu.style.top = `${safeTop}px`
        menu.style.left = `${safeLeft}px`
    },

    deselectMedia() {
        if (this.selectedMedia) this.selectedMedia.classList.remove("selected")
        this.selectedMedia = null
        const menu = this.els.ctxMenu
        if (menu) menu.classList.add("hidden")
    },

    deleteSelectedMedia() {
        if (!this.selectedMedia) return
        this.selectedMedia.remove()
        this.deselectMedia()
        this.queueSnapshot()
    },

    resetMediaTransform() {
        if (!this.selectedMedia) return
        const img = this.selectedMedia.querySelector("img")
        if (!img) return
        img.style.width = ""
        img.style.height = ""
        this.selectedMedia.dataset.width = ""
        this.selectedMedia.dataset.height = ""
        this.queueSnapshot()
    },

    alignMediaOrText(side) {
        if (!this.selectedMedia) return
        const w = this.selectedMedia
        w.classList.remove("align-left", "align-right")
        if (side === "left") w.classList.add("align-left")
        if (side === "right") w.classList.add("align-right")
        this.queueSnapshot()
    },

    drawOnSelectedMedia() {
        UI.showToast(UI.getText("draw_photo_hint", "Use the photo editor"))
    },

    toggleToolbar() {
        const tb = this.els.toolbar
        if (!tb) return
        tb.classList.toggle("is-hidden")
    },

    async save() {
        if (!db || !state.user) return
        const n = state.currentNote
        if (!n) return
        n.title = String(this.els.title.value || "")
        n.content = Utils.sanitizeHtml(String(this.els.content.innerHTML || ""))
        if (!Array.isArray(n.tags)) n.tags = []
        const auto = SmartSearch.suggestTags(n.title, n.content)
        auto.forEach(t => {
            if (!n.tags.map(x => String(x).toLowerCase()).includes(t.toLowerCase())) n.tags.push(t)
        })
        if (!n.folderId) {
            const id = SmartSearch.suggestFolderId(n, state.folders)
            if (id) n.folderId = id
        }
        const ref = db.collection("users").doc(state.user.uid).collection("notes").doc(n.id)
        const payload = NoteIO.normalizeNote(n)
        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp()
        await ref.set(payload, { merge: true })
        state.editorDirty = false
        UI.showToast(UI.getText("saved", "Saved"))
        this.close()
    },

    async deleteCurrent() {
        const n = state.currentNote
        if (!n) return
        UI.confirm("delete", async () => {
            if (!db || !state.user) return
            await db.collection("users").doc(state.user.uid).collection("notes").doc(n.id).delete()
            UI.showToast(UI.getText("note_deleted", "Deleted"))
            this.close()
        })
    }
}
