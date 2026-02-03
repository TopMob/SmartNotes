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
            textSizePopup: document.getElementById("text-size-popup"),
            fontRange: document.getElementById("font-size-range"),
            ctxMenu: document.getElementById("media-context-menu") || document.getElementById("media-context-menu")
        }
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

        const toolbarToggle = document.getElementById("toolbar-toggle")
        if (toolbarToggle) {
            toolbarToggle.addEventListener("click", () => {
                const tb = this.els.toolbar
                if (!tb) return
                tb.classList.toggle("is-hidden")
            })
        }

        const lockApply = document.getElementById("lock-apply")
        if (lockApply) {
            lockApply.addEventListener("click", async () => {
                const pass = document.getElementById("lock-password")?.value || ""
                if (!state.currentNote) return
                if (!pass.trim()) return UI.showToast("Пароль пустой")
                await LockService.setLock(state.currentNote, pass.trim())
                UI.closeModal("lock-modal")
                UI.showToast("Заметка скрыта")
            })
        }

        const surveySubmit = document.getElementById("survey-submit")
        if (surveySubmit) {
            surveySubmit.addEventListener("click", async () => {
                const q1 = String(document.getElementById("survey-q1")?.value || "").trim()
                const q2 = String(document.getElementById("survey-q2")?.value || "").trim()
                const q3 = String(document.getElementById("survey-q3")?.value || "").trim()
                localStorage.setItem("survey:v1", JSON.stringify({ q1, q2, q3, ts: Date.now() }))
                UI.closeModal("survey-modal")
                UI.showToast("Спасибо")
            })
        }
    },

    buildToolbar() {
        const root = this.els.toolbar
        if (!root) return
        const tools = [
            { i: "format_bold", cmd: () => document.execCommand("bold") },
            { i: "format_italic", cmd: () => document.execCommand("italic") },
            { i: "format_underlined", cmd: () => document.execCommand("underline") },
            { i: "format_list_bulleted", cmd: () => document.execCommand("insertUnorderedList") },
            { i: "format_list_numbered", cmd: () => document.execCommand("insertOrderedList") },
            { i: "checklist", cmd: () => this.insertChecklistLine() },
            { i: "image", cmd: () => document.getElementById("img-upload")?.click() },
            { i: "title", cmd: () => this.toggleTextSizePopup() },
            { i: "format_clear", cmd: () => document.execCommand("removeFormat") }
        ]
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
        if (this.els.fontRange) {
            this.els.fontRange.addEventListener("input", () => {
                const v = parseInt(this.els.fontRange.value, 10)
                const px = 10 + v * 2
                document.execCommand("fontSize", false, "7")
                const fonts = this.els.content.querySelectorAll("font[size='7']")
                fonts.forEach(f => {
                    f.removeAttribute("size")
                    f.style.fontSize = `${px}px`
                })
                this.queueSnapshot()
            })
        }
    },

    toggleTextSizePopup() {
        const p = this.els.textSizePopup
        if (!p) return
        p.classList.toggle("hidden")
    },

    insertChecklistLine() {
        const html = `<div class="task-item"><input class="task-checkbox" type="checkbox" onchange="Editor.toggleTask(this)"><span>${Utils.escapeHtml((LANG[state.config.lang]||LANG.ru).task_item || "Задача")}</span></div>`
        document.execCommand("insertHTML", false, html)
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
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            order: Date.now()
        })
        state.currentNote = JSON.parse(JSON.stringify(n))
        this.history = []
        this.future = []
        this.renderState()
        this.els.wrapper.classList.add("active")
        setTimeout(() => this.els.content?.focus(), 90)
        UI.toggleSidebar(false)
    },

    async maybeUnlock(note) {
        if (!note.lock || !note.lock.hash) return true
        return await new Promise((resolve) => {
            UI.showPrompt("Пароль", "Введите пароль", async (val) => {
                const ok = await LockService.verify(note, val)
                if (!ok) UI.showToast("Неверный пароль")
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
        this.els.content.innerHTML = n.content || ""
        this.renderTags()
        this.makeMediaDraggable()
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
            <span class="tag-chip" onclick="Editor.removeTag('${Utils.escapeHtml(String(t))}')">
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
                b.onclick = () => this.addTag(t)
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

    snapshot() {
        const n = state.currentNote
        if (!n) return
        n.title = String(this.els.title.value || "")
        n.content = String(this.els.content.innerHTML || "")
        n.updatedAt = firebase.firestore.FieldValue.serverTimestamp()
        this.history.push(JSON.parse(JSON.stringify({ title: n.title, content: n.content, tags: n.tags })))
        if (this.history.length > 80) this.history.shift()
        this.future = []
    },

    undo() {
        const n = state.currentNote
        if (!n) return
        if (!this.history.length) return
        const last = this.history.pop()
        this.future.push(JSON.parse(JSON.stringify({ title: n.title, content: n.content, tags: n.tags })))
        n.title = last.title
        n.content = last.content
        n.tags = last.tags
        this.renderState()
    },

    redo() {
        const n = state.currentNote
        if (!n) return
        const next = this.future.pop()
        if (!next) return
        this.history.push(JSON.parse(JSON.stringify({ title: n.title, content: n.content, tags: n.tags })))
        n.title = next.title
        n.content = next.content
        n.tags = next.tags
        this.renderState()
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
        const top = rect.top + window.scrollY - 56
        const left = rect.left + window.scrollX + rect.width / 2 - menu.offsetWidth / 2
        menu.style.top = `${Math.max(10, top)}px`
        menu.style.left = `${Math.max(10, left)}px`
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
        w.style.float = side === "left" ? "left" : side === "right" ? "right" : ""
        w.style.margin = side === "left" ? "6px 14px 6px 0" : side === "right" ? "6px 0 6px 14px" : ""
        this.queueSnapshot()
    },

    drawOnSelectedMedia() {
        UI.showToast("Открой редактор фото из кнопки в модалке")
    },

    async save() {
        if (!db || !state.user) return
        const n = state.currentNote
        if (!n) return
        n.title = String(this.els.title.value || "")
        n.content = String(this.els.content.innerHTML || "")
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
            UI.showToast("Удалено")
            this.close()
        })
    }
}
