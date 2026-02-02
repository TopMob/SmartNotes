const NoteIO = {
    normalizeNote(raw) {
        const safe = raw && typeof raw === "object" ? raw : {}
        const tags = Array.isArray(safe.tags) ? safe.tags.filter(Boolean).map(x => String(x)) : []
        return {
            id: safe.id ? String(safe.id) : Utils.generateId(),
            title: safe.title ? String(safe.title) : "",
            content: safe.content ? String(safe.content) : "",
            tags,
            folderId: safe.folderId ? String(safe.folderId) : null,
            isArchived: !!safe.isArchived,
            isFavorite: !!safe.isFavorite,
            isPinned: !!safe.isPinned,
            lock: safe.lock && typeof safe.lock === "object" ? safe.lock : null,
            order: typeof safe.order === "number" ? safe.order : Date.now(),
            createdAt: safe.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: safe.updatedAt || firebase.firestore.FieldValue.serverTimestamp()
        }
    },
    exportNote(note) {
        const safe = this.normalizeNote(note)
        return JSON.stringify({ version: 2, note: safe }, null, 2)
    },
    parseImport(parsed) {
        const res = []
        if (!parsed) return res
        if (parsed.note) {
            res.push(this.normalizeNote(parsed.note))
            return res
        }
        if (Array.isArray(parsed.notes)) {
            parsed.notes.forEach(n => res.push(this.normalizeNote(n)))
            return res
        }
        if (Array.isArray(parsed)) {
            parsed.forEach(n => res.push(this.normalizeNote(n)))
            return res
        }
        return res
    },
    fileNameFor(note) {
        const t = (note && note.title ? note.title : "note").trim().slice(0, 48)
        const safe = t.replace(/[^\p{L}\p{N}\s._()]+/gu, "").replace(/\s+/g, " ").trim() || "note"
        return `${safe}.json`
    }
}

const SmartSearch = {
    stop: new Set(["и","в","во","на","а","но","или","ли","что","это","как","я","мы","ты","вы","он","она","они","the","a","an","to","of","in","on","and","or","is","are"]),
    synonyms: new Map([
        ["todo", ["задача","дела","список","tasks","checklist"]],
        ["важное", ["избранное","favorite","star"]],
        ["архив", ["archive","скрыто","старое"]],
        ["код", ["code","snippet","js","css","html"]],
        ["учеба", ["учёба","универ","школа","study"]],
        ["проект", ["project","dev","разработка"]],
        ["идея", ["idea","мысль","concept"]]
    ]),
    tokenize(text) {
        const t = (text || "").toLowerCase()
        const tokens = t
            .replace(/[\p{P}\p{S}]+/gu, " ")
            .split(/\s+/)
            .map(x => x.trim())
            .filter(Boolean)
            .filter(x => !this.stop.has(x))
        const expanded = []
        tokens.forEach(w => {
            expanded.push(w)
            for (const [k, list] of this.synonyms.entries()) {
                if (w === k || list.includes(w)) {
                    expanded.push(k)
                    list.forEach(s => expanded.push(s))
                }
            }
        })
        return Array.from(new Set(expanded))
    },
    damerau(a, b) {
        a = a || ""
        b = b || ""
        if (a === b) return 0
        const al = a.length
        const bl = b.length
        if (!al) return bl
        if (!bl) return al
        const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0))
        for (let i = 0; i <= al; i++) dp[i][0] = i
        for (let j = 0; j <= bl; j++) dp[0][j] = j
        for (let i = 1; i <= al; i++) {
            for (let j = 1; j <= bl; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                )
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                    dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
                }
            }
        }
        return dp[al][bl]
    },
    wordScore(queryWord, docWord) {
        if (!queryWord || !docWord) return 0
        if (queryWord === docWord) return 1
        const d = this.damerau(queryWord, docWord)
        const maxLen = Math.max(queryWord.length, docWord.length)
        const sim = 1 - d / Math.max(1, maxLen)
        return sim < 0 ? 0 : sim
    },
    score(query, title, content, tags) {
        const q = this.tokenize(query)
        if (!q.length) return 0
        const t = this.tokenize(title)
        const c = this.tokenize(Utils.stripHtml(content))
        const tg = Array.isArray(tags) ? tags.map(x => String(x).toLowerCase()) : []
        let s = 0
        q.forEach(qw => {
            let best = 0
            t.forEach(dw => best = Math.max(best, this.wordScore(qw, dw) * 2.4))
            tg.forEach(dw => best = Math.max(best, this.wordScore(qw, dw) * 2.2))
            c.forEach(dw => best = Math.max(best, this.wordScore(qw, dw) * 1.0))
            s += best
        })
        return s / q.length
    },
    suggestTags(title, content) {
        const tokens = this.tokenize(`${title} ${Utils.stripHtml(content)}`)
        const res = []
        const dict = [
            { tag: "учеба", keys: ["учеба","учёба","study","универ","школа","лекция","дз","домашка"] },
            { tag: "проект", keys: ["проект","project","dev","разработка","релиз","feature"] },
            { tag: "код", keys: ["код","code","js","css","html","bug","фикс","коммит"] },
            { tag: "идея", keys: ["идея","idea","мысль","concept","инсайт"] },
            { tag: "покупки", keys: ["купить","магазин","shopping","список"] },
            { tag: "задачи", keys: ["todo","задача","дела","tasks","checklist"] }
        ]
        dict.forEach(item => {
            const hit = item.keys.some(k => tokens.includes(k))
            if (hit) res.push(item.tag)
        })
        return Array.from(new Set(res)).slice(0, 6)
    },
    suggestFolderId(note, folders) {
        const name = `${note.title} ${Utils.stripHtml(note.content)}`.toLowerCase()
        const scored = (folders || []).map(f => {
            const s = this.score(f.name, note.title, note.content, note.tags)
            const simple = name.includes(String(f.name).toLowerCase()) ? 0.6 : 0
            return { id: f.id, score: s + simple }
        }).sort((a, b) => b.score - a.score)
        if (!scored.length) return null
        if (scored[0].score < 0.55) return null
        return scored[0].id
    }
}

const LockService = {
    async digest(text) {
        const enc = new TextEncoder().encode(String(text || ""))
        const buf = await crypto.subtle.digest("SHA-256", enc)
        const bytes = Array.from(new Uint8Array(buf))
        return bytes.map(b => b.toString(16).padStart(2, "0")).join("")
    },
    async setLock(note, password) {
        const hash = await this.digest(password)
        note.lock = { v: 1, hash, hidden: true }
        return note
    },
    async verify(note, password) {
        if (!note.lock || !note.lock.hash) return true
        const hash = await this.digest(password)
        return hash === note.lock.hash
    },
    clearLock(note) {
        note.lock = null
        return note
    }
}

const ShareService = {
    base() {
        const u = new URL(window.location.href)
        u.hash = ""
        u.search = ""
        return u.toString().replace(/\/$/, "")
    },
    token(bytes = 18) {
        const arr = new Uint8Array(bytes)
        crypto.getRandomValues(arr)
        return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, "").slice(0, 26)
    },
    makeShareLink(noteId) {
        const t = this.token()
        localStorage.setItem(`share:${t}`, JSON.stringify({ noteId, mode: "read", exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }))
        return `${this.base()}/#share/${t}`
    },
    makeCollabLink(noteId) {
        const t = this.token()
        localStorage.setItem(`share:${t}`, JSON.stringify({ noteId, mode: "collab", exp: Date.now() + 1000 * 60 * 30 }))
        return `${this.base()}/#collab/${t}`
    },
    consume(token) {
        const raw = localStorage.getItem(`share:${token}`)
        if (!raw) return null
        let parsed = null
        try { parsed = JSON.parse(raw) } catch { parsed = null }
        localStorage.removeItem(`share:${token}`)
        if (!parsed || !parsed.noteId || !parsed.exp) return null
        if (Date.now() > parsed.exp) return null
        return parsed
    }
}

const DriveService = {
    ready: false,
    async init() {
        this.ready = !!window.gapi
    },
    async uploadNote(note) {
        if (!this.ready) return UI.showToast(UI.getText("drive_unavailable", "Drive unavailable"))
        UI.showToast(UI.getText("drive_connected", "Drive connected"))
        return UI.showToast(UI.getText("drive_saved", "Uploaded"))
    }
}

const ReminderService = {
    init() {
        const root = document.getElementById("voice-indicator")
        if (root) root.classList.remove("active")
    }
}

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

const UI = {
    els: {},
    currentNoteActionId: null,
    draggedNoteId: null,
    dragTargetId: null,
    dragPosition: null,
    visibleNotes: [],

    init() {
        this.els = {
            sidebar: document.getElementById("sidebar"),
            grid: document.getElementById("notes-container"),
            empty: document.getElementById("empty-state"),
            userMenu: document.getElementById("user-dropdown"),
            confirmModal: document.getElementById("confirm-modal"),
            promptModal: document.getElementById("prompt-modal"),
            fab: document.querySelector(".btn-fab"),
            folderList: document.getElementById("folder-list-root")
        }
        this.bindEvents()
        this.applyAppearanceSettings()
        this.updatePrimaryActionLabel()
        this.routeShare()
    },

    getText(key, fallback = "") {
        const dict = LANG[state.config.lang] || LANG.ru
        return dict[key] || fallback || key
    },

    setLang(lang) {
        const next = lang === "en" ? "en" : "ru"
        state.config.lang = next
        localStorage.setItem("app-lang", next)
        this.applyLangToDom()
        this.updateViewTitle()
        this.updatePrimaryActionLabel()
        ThemeManager.renderPicker()
    },

    applyLangToDom() {
        const dict = LANG[state.config.lang] || LANG.ru
        document.querySelectorAll("[data-lang]").forEach(el => {
            const k = el.getAttribute("data-lang")
            if (k && dict[k]) el.textContent = dict[k]
        })
        document.querySelectorAll("[data-lang-placeholder]").forEach(el => {
            const k = el.getAttribute("data-lang-placeholder")
            if (k && dict[k]) el.setAttribute("placeholder", dict[k])
        })
        document.querySelectorAll("[data-lang-aria]").forEach(el => {
            const k = el.getAttribute("data-lang-aria")
            if (k && dict[k]) el.setAttribute("aria-label", dict[k])
        })
    },

    bindEvents() {
        document.addEventListener("click", (e) => {
            if (this.els.sidebar?.classList.contains("active") && !this.els.sidebar.contains(e.target) && !e.target.closest("#menu-toggle")) {
                this.toggleSidebar(false)
            }
            if (this.els.userMenu?.classList.contains("active") && !e.target.closest(".user-avatar-wrapper")) {
                this.toggleUserMenu(false)
            }
        })

        document.querySelectorAll(".star").forEach(star => {
            star.addEventListener("click", () => {
                const val = parseInt(star.dataset.val, 10)
                state.tempRating = val
                document.querySelectorAll(".star").forEach(s => {
                    const v = parseInt(s.dataset.val, 10)
                    s.textContent = v <= val ? "star" : "star_border"
                    s.classList.toggle("active", v <= val)
                })
            })
        })

        const promptInput = document.getElementById("prompt-input")
        if (promptInput) {
            promptInput.onkeydown = (e) => {
                if (e.key === "Enter") document.getElementById("prompt-ok")?.click()
            }
        }

        this.els.grid?.addEventListener("click", async (e) => {
            const card = e.target.closest(".note-card")
            const action = e.target.closest(".action-btn")
            if (action) return
            if (!card) return
            const id = card.dataset.noteId ? decodeURIComponent(card.dataset.noteId) : null
            const note = state.notes.find(n => n.id === id)
            if (note) await Editor.openFromList(note)
        })

        this.els.grid?.addEventListener("dragstart", (e) => {
            const card = e.target.closest(".note-card")
            if (!card) return
            this.draggedNoteId = decodeURIComponent(card.dataset.noteId)
            card.classList.add("dragging")
            e.dataTransfer.effectAllowed = "move"
            e.dataTransfer.setData("text/plain", this.draggedNoteId)
        })

        this.els.grid?.addEventListener("dragover", (e) => {
            if (!this.draggedNoteId) return
            e.preventDefault()
            const card = e.target.closest(".note-card")
            if (!card) return
            const targetId = decodeURIComponent(card.dataset.noteId)
            if (!targetId || targetId === this.draggedNoteId) return
            const rect = card.getBoundingClientRect()
            const before = e.clientY < rect.top + rect.height / 2
            this.dragTargetId = targetId
            this.dragPosition = before ? "before" : "after"
            this.setDropIndicator(card, this.dragPosition)
            this.autoScroll(e.clientY)
        })

        this.els.grid?.addEventListener("drop", (e) => {
            if (!this.draggedNoteId || !this.dragTargetId) return
            e.preventDefault()
            this.reorderNotes(this.draggedNoteId, this.dragTargetId, this.dragPosition)
            this.clearDragIndicators()
        })

        this.els.grid?.addEventListener("dragend", (e) => {
            const card = e.target.closest(".note-card")
            if (card) card.classList.remove("dragging")
            this.clearDragIndicators()
            this.draggedNoteId = null
        })

        const noteImport = document.getElementById("note-import")
        if (noteImport) noteImport.addEventListener("change", (e) => this.handleNoteImport(e))

        const shareModal = document.getElementById("share-modal")
        if (shareModal) shareModal.addEventListener("click", (e) => { if (e.target === shareModal) this.closeModal("share-modal") })

        const collabModal = document.getElementById("collab-modal")
        if (collabModal) collabModal.addEventListener("click", (e) => { if (e.target === collabModal) this.closeModal("collab-modal") })

        const lockModal = document.getElementById("lock-modal")
        if (lockModal) lockModal.addEventListener("click", (e) => { if (e.target === lockModal) this.closeModal("lock-modal") })
    },

    toggleSidebar(force) {
        if (!this.els.sidebar) return
        this.els.sidebar.classList.toggle("active", typeof force === "boolean" ? force : !this.els.sidebar.classList.contains("active"))
    },

    toggleUserMenu(force) {
        if (!this.els.userMenu) return
        this.els.userMenu.classList.toggle("active", typeof force === "boolean" ? force : !this.els.userMenu.classList.contains("active"))
    },

    triggerImport() {
        const input = document.getElementById("note-import")
        if (!input) return
        input.value = ""
        input.click()
    },

    async handleNoteImport(e) {
        if (!db || !state.user) return
        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null
        if (!file) return
        if (!String(file.type).includes("json") && !String(file.name).toLowerCase().endsWith(".json")) {
            this.showToast(this.getText("import_invalid", "Unsupported file"))
            return
        }
        const reader = new FileReader()
        reader.onload = async () => {
            try {
                const text = String(reader.result || "").replace(/^\uFEFF/, "")
                const parsed = JSON.parse(text)
                const notes = NoteIO.parseImport(parsed)
                if (!notes.length) {
                    this.showToast(this.getText("import_empty", "No notes found"))
                    return
                }
                const batch = db.batch()
                notes.forEach(note => {
                    let n = NoteIO.normalizeNote(note)
                    if (state.notes.some(x => x.id === n.id)) n.id = Utils.generateId()
                    if (n.folderId && !state.folders.find(f => f.id === n.folderId)) n.folderId = null
                    const ref = db.collection("users").doc(state.user.uid).collection("notes").doc(n.id)
                    batch.set(ref, n, { merge: true })
                })
                await batch.commit()
                this.showToast(this.getText("import_success", "Imported"))
            } catch {
                this.showToast(this.getText("import_failed", "Import failed"))
            }
        }
        reader.onerror = () => this.showToast(this.getText("import_failed", "Import failed"))
        reader.readAsText(file, "utf-8")
    },

    primaryAction() {
        if (state.view === "folders") {
            if (state.folders.length >= 10) return this.showToast(this.getText("folder_limit", "Folder limit reached"))
            this.showPrompt(this.getText("new_folder", "New folder"), this.getText("folder_placeholder", "Folder name"), async (name) => {
                if (!db || !state.user) return
                await db.collection("users").doc(state.user.uid).collection("folders").add({
                    name,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                })
            })
            return
        }
        Editor.open()
    },

    applyAppearanceSettings() {
        const saved = JSON.parse(localStorage.getItem("app-preferences")) || {}
        state.config.folderViewMode = saved.folderViewMode || state.config.folderViewMode
        state.config.reduceMotion = !!saved.reduceMotion
        ThemeManager.revertToLastSaved()
        this.renderFolders()
    },

    updateViewTitle() {
        const dict = LANG[state.config.lang] || LANG.ru
        const titles = {
            notes: dict.view_notes || "Notes",
            favorites: dict.view_favorites || "Favorites",
            archive: dict.view_archive || "Archive",
            folder: dict.view_folder || "Folder",
            folders: dict.view_folders || "Folders"
        }
        let title = titles[state.view] || "SmartNotes"
        if (state.view === "folder" && state.activeFolderId) {
            const folder = state.folders.find(f => f.id === state.activeFolderId)
            if (folder) title = folder.name
        }
        const el = document.getElementById("current-view-title")
        if (el) el.textContent = title
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return
        const label = state.view === "folders" ? this.getText("create_folder", "Create folder") : this.getText("create_note", "Create note")
        this.els.fab.setAttribute("aria-label", label)
    },

    openModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.add("active")
        this.toggleSidebar(false)
        if (id === "share-modal") {
            const link = document.getElementById("share-link")
            const n = state.currentNote
            if (link && n) link.value = ShareService.makeShareLink(n.id)
        }
        if (id === "collab-modal") {
            const link = document.getElementById("collab-link")
            const n = state.currentNote
            if (link && n) link.value = ShareService.makeCollabLink(n.id)
        }
    },

    closeModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.remove("active")
        if (id === "appearance-modal") ThemeManager.revertToLastSaved()
    },

    openSettings() {
        const modal = document.getElementById("settings-modal")
        if (modal) modal.classList.add("active")
    },

    showToast(msg, options = {}) {
        const div = document.createElement("div")
        div.className = "toast show"
        div.setAttribute("role", "status")
        const text = document.createElement("span")
        text.textContent = msg
        div.appendChild(text)
        if (options.actionLabel && options.onAction) {
            const btn = document.createElement("button")
            btn.type = "button"
            btn.className = "toast-action"
            btn.textContent = options.actionLabel
            btn.onclick = () => {
                options.onAction()
                div.remove()
            }
            div.appendChild(btn)
        }
        const root = document.getElementById("toast-container")
        if (!root) return
        root.appendChild(div)
        setTimeout(() => {
            div.classList.remove("show")
            setTimeout(() => div.remove(), 300)
        }, options.duration || 2500)
    },

    confirm(type, cb) {
        const titles = {
            delete: this.getText("confirm_delete", "Delete?"),
            exit: this.getText("confirm_exit", "Sign out?"),
            account: this.getText("confirm_account", "Switch account?"),
            delete_f: this.getText("confirm_delete_folder", "Delete folder?")
        }
        const titleEl = document.getElementById("confirm-title")
        if (titleEl) titleEl.textContent = titles[type] || this.getText("confirm_default", "Confirm")

        const okBtn = document.getElementById("confirm-ok")
        const newBtn = okBtn.cloneNode(true)
        okBtn.parentNode.replaceChild(newBtn, okBtn)

        newBtn.onclick = () => {
            cb()
            this.els.confirmModal.classList.remove("active")
        }

        this.els.confirmModal.classList.add("active")
        const cancel = document.getElementById("confirm-cancel")
        if (cancel) cancel.onclick = () => this.els.confirmModal.classList.remove("active")
    },

    showPrompt(title, placeholder, cb) {
        const modal = this.els.promptModal
        const input = document.getElementById("prompt-input")
        const ok = document.getElementById("prompt-ok")
        const cancel = document.getElementById("prompt-cancel")
        const titleEl = document.getElementById("prompt-title")

        if (titleEl) titleEl.textContent = title
        input.value = ""
        input.placeholder = placeholder

        const finish = (val) => {
            if (val) cb(val)
            modal.classList.remove("active")
            input.onkeydown = null
        }

        const okClone = ok.cloneNode(true)
        ok.parentNode.replaceChild(okClone, ok)

        okClone.onclick = () => finish(String(input.value || "").trim())
        cancel.onclick = () => modal.classList.remove("active")

        modal.classList.add("active")
        setTimeout(() => input.focus(), 80)
    },

    setDropIndicator(card, position) {
        this.clearDragIndicators()
        card.classList.add(position === "before" ? "drop-before" : "drop-after")
    },

    clearDragIndicators() {
        this.els.grid.querySelectorAll(".note-card").forEach(card => {
            card.classList.remove("drop-before", "drop-after")
        })
    },

    autoScroll(cursorY) {
        const container = document.getElementById("notes-content-area")
        if (!container) return
        const rect = container.getBoundingClientRect()
        const threshold = 80
        if (cursorY < rect.top + threshold) container.scrollBy({ top: -12, behavior: "smooth" })
        else if (cursorY > rect.bottom - threshold) container.scrollBy({ top: 12, behavior: "smooth" })
    },

    reorderNotes(draggedId, targetId, position) {
        if (!db || !state.user) return
        if (draggedId === targetId) return
        const visibleIds = this.visibleNotes.map(n => n.id)
        const fromIndex = visibleIds.indexOf(draggedId)
        const toIndex = visibleIds.indexOf(targetId)
        if (fromIndex === -1 || toIndex === -1) return
        visibleIds.splice(fromIndex, 1)
        const insertIndex = position === "after" ? toIndex + 1 : toIndex
        visibleIds.splice(insertIndex > fromIndex ? insertIndex - 1 : insertIndex, 0, draggedId)

        const previous = this.visibleNotes.map(n => ({ id: n.id, order: n.order || 0 }))
        state.orderHistory.push(previous)
        if (state.orderHistory.length > 20) state.orderHistory.shift()

        const updates = visibleIds.map((id, index) => ({ id, order: index + 1 }))
        updates.forEach(update => {
            const note = state.notes.find(n => n.id === update.id)
            if (note) note.order = update.order
        })

        const batch = db.batch()
        updates.forEach(update => {
            const ref = db.collection("users").doc(state.user.uid).collection("notes").doc(update.id)
            batch.update(ref, { order: update.order })
        })
        batch.commit()
        this.showToast(this.getText("order_updated", "Order updated"), {
            actionLabel: this.getText("undo", "Undo"),
            onAction: () => this.undoOrder()
        })
        filterAndRender(document.getElementById("search-input")?.value || "")
    },

    undoOrder() {
        if (!db || !state.user) return
        const last = state.orderHistory.pop()
        if (!last) return
        const batch = db.batch()
        last.forEach(item => {
            const note = state.notes.find(n => n.id === item.id)
            if (note) note.order = item.order
            const ref = db.collection("users").doc(state.user.uid).collection("notes").doc(item.id)
            batch.update(ref, { order: item.order })
        })
        batch.commit()
        filterAndRender(document.getElementById("search-input")?.value || "")
    },

    updateEmptyState(icon, text) {
        const iconEl = this.els.empty.querySelector("i")
        const textEl = this.els.empty.querySelector("p")
        if (iconEl) iconEl.textContent = icon
        if (textEl) textEl.textContent = text
    },

    renderFolders() {
        const root = this.els.folderList
        if (!root) return
        const hideList = state.config.folderViewMode === "full"
        root.classList.toggle("hidden", hideList)
        if (hideList) {
            root.innerHTML = ""
            return
        }
        root.innerHTML = state.folders.map(f => `
            <button type="button" class="nav-item ${state.activeFolderId === f.id ? "active" : ""}" onclick="switchView('folder', '${f.id}')">
                <i class="material-icons-round" aria-hidden="true">folder</i>
                <span>${Utils.escapeHtml(f.name)}</span>
                <i class="material-icons-round" style="margin-left:auto; opacity:0.5; font-size:16px" onclick="event.stopPropagation(); deleteFolder('${f.id}')">close</i>
            </button>
        `).join("")
    },

    renderFolderGrid() {
        this.updateEmptyState("folder_open", this.getText("folders_empty", "No folders yet"))
        this.els.empty.classList.toggle("hidden", state.folders.length > 0)
        this.els.grid.classList.add("folder-grid")
        this.els.grid.innerHTML = state.folders.map(folder => {
            const count = state.notes.filter(note => note.folderId === folder.id && !note.isArchived).length
            const label = count === 1 ? this.getText("note_single", "note") : this.getText("note_plural", "notes")
            return `
                <div class="folder-card" onclick="switchView('folder', '${folder.id}')">
                    <div class="folder-title">${Utils.escapeHtml(folder.name)}</div>
                    <div class="folder-meta">${count} ${label}</div>
                </div>
            `
        }).join("")
    },

    routeShare() {
        const h = String(location.hash || "")
        const m1 = h.match(/^#share\/([A-Za-z0-9]+)$/)
        const m2 = h.match(/^#collab\/([A-Za-z0-9]+)$/)
        const token = m1 ? m1[1] : m2 ? m2[1] : null
        if (!token) return
        const payload = ShareService.consume(token)
        history.replaceState({}, "", "#")
        if (!payload) return this.showToast("Ссылка недействительна")

        const openWhenReady = () => {
            const note = state.notes.find(n => n.id === payload.noteId)
            if (!note) return this.showToast("Заметка не найдена")
            if (payload.mode === "read") return Editor.openFromList(note)
            if (payload.mode === "collab") {
                this.showToast("Совместный режим включен")
                return Editor.openFromList(note)
            }
        }

        const int = setInterval(() => {
            if (state.user && state.notes.length) {
                clearInterval(int)
                openWhenReady()
            }
        }, 120)

        setTimeout(() => clearInterval(int), 6000)
    }
}

function normalizeVisibleNotes(list) {
    const arr = (list || []).filter(Boolean).map(n => NoteIO.normalizeNote(n))
    arr.sort((a, b) => {
        const ap = a.isPinned ? 1 : 0
        const bp = b.isPinned ? 1 : 0
        if (bp !== ap) return bp - ap
        const ao = typeof a.order === "number" ? a.order : 0
        const bo = typeof b.order === "number" ? b.order : 0
        return ao - bo
    })
    return arr
}

function renderNotes(list) {
    const grid = UI.els.grid
    if (!grid) return
    UI.els.grid.classList.remove("folder-grid")
    UI.visibleNotes = list

    if (!list.length) {
        UI.els.empty.classList.remove("hidden")
        grid.innerHTML = ""
        return
    }
    UI.els.empty.classList.add("hidden")

    grid.innerHTML = list.map(n => {
        const title = n.title ? n.title : UI.getText("untitled_note", "Untitled")
        const preview = Utils.stripHtml(n.content || "").trim() || UI.getText("empty_note", "No content")
        const lock = n.lock && n.lock.hidden ? `<span class="lock-badge"><i class="material-icons-round" aria-hidden="true" style="font-size:16px">lock</i><span>Locked</span></span>` : ""
        const pinCls = n.isPinned ? "pinned" : ""
        const tagLine = Array.isArray(n.tags) && n.tags.length ? n.tags.slice(0, 3).map(t => `#${Utils.escapeHtml(String(t))}`).join(" ") : ""
        const date = Utils.formatDate(n.updatedAt || n.createdAt || Date.now())
        return `
            <div class="note-card ${pinCls}" draggable="true" data-note-id="${encodeURIComponent(n.id)}">
                <div class="card-actions">
                    <button type="button" class="action-btn" aria-label="Pin" onclick="event.stopPropagation(); togglePin('${n.id}')"><i class="material-icons-round" aria-hidden="true">push_pin</i></button>
                    <button type="button" class="action-btn" aria-label="Star" onclick="event.stopPropagation(); toggleFavorite('${n.id}')"><i class="material-icons-round" aria-hidden="true">star</i></button>
                    <button type="button" class="action-btn" aria-label="Menu" onclick="event.stopPropagation(); openNoteActions('${n.id}')"><i class="material-icons-round" aria-hidden="true">more_horiz</i></button>
                </div>
                <h3>${Utils.escapeHtml(title)}</h3>
                <p>${Utils.escapeHtml(preview)}</p>
                <div class="note-meta">
                    <i class="material-icons-round" aria-hidden="true">schedule</i>
                    <span>${Utils.escapeHtml(date)}</span>
                    <span style="margin-left:auto; opacity:0.8">${Utils.escapeHtml(tagLine)}</span>
                </div>
                ${lock ? `<div style="margin-top:8px">${lock}</div>` : ""}
            </div>
        `
    }).join("")
}

function filterAndRender(query) {
    state.searchQuery = String(query || "")
    const q = state.searchQuery.trim()
    let list = state.notes.slice()

    if (state.view === "favorites") list = list.filter(n => !!n.isFavorite && !n.isArchived)
    if (state.view === "archive") list = list.filter(n => !!n.isArchived)
    if (state.view === "notes") list = list.filter(n => !n.isArchived)
    if (state.view === "folder") list = list.filter(n => !n.isArchived && n.folderId === state.activeFolderId)

    if (q) {
        const scored = list.map(n => {
            const score = SmartSearch.score(q, n.title, n.content, n.tags)
            return { n, score }
        }).filter(x => x.score >= 0.35).sort((a, b) => b.score - a.score)
        list = scored.map(x => x.n)
    }

    list = normalizeVisibleNotes(list)
    if (state.view === "folders") {
        UI.renderFolderGrid()
        UI.updateViewTitle()
        UI.updatePrimaryActionLabel()
        return
    }
    renderNotes(list)
    UI.updateViewTitle()
    UI.updatePrimaryActionLabel()
}

function switchView(view, folderId = null) {
    state.view = view
    state.activeFolderId = folderId
    document.querySelectorAll(".nav-item").forEach(btn => {
        const v = btn.dataset.view
        if (!v) return
        btn.classList.toggle("active", v === view)
    })
    filterAndRender(document.getElementById("search-input")?.value || "")
}

async function deleteFolder(folderId) {
    if (!folderId) return
    UI.confirm("delete_f", async () => {
        if (!db || !state.user) return
        const notes = state.notes.filter(n => n.folderId === folderId)
        const batch = db.batch()
        notes.forEach(n => {
            const ref = db.collection("users").doc(state.user.uid).collection("notes").doc(n.id)
            batch.update(ref, { folderId: null })
        })
        const folderRef = db.collection("users").doc(state.user.uid).collection("folders").doc(folderId)
        batch.delete(folderRef)
        await batch.commit()
        if (state.activeFolderId === folderId) {
            state.activeFolderId = null
            state.view = "notes"
        }
        UI.showToast("Папка удалена")
    })
}

function openNoteActions(noteId) {
    UI.currentNoteActionId = noteId
    UI.openModal("note-actions-modal")
}

async function toggleFavorite(noteId) {
    if (!db || !state.user) return
    const note = state.notes.find(n => n.id === noteId)
    if (!note) return
    const ref = db.collection("users").doc(state.user.uid).collection("notes").doc(noteId)
    const next = !note.isFavorite
    await ref.update({ isFavorite: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
}

async function togglePin(noteId) {
    if (!db || !state.user) return
    const note = state.notes.find(n => n.id === noteId)
    if (!note) return
    const ref = db.collection("users").doc(state.user.uid).collection("notes").doc(noteId)
    const next = !note.isPinned
    await ref.update({ isPinned: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    const card = document.querySelector(`.note-card[data-note-id="${encodeURIComponent(noteId)}"]`)
    if (card) {
        card.classList.add("pinning")
        setTimeout(() => card.classList.remove("pinning"), 520)
    }
}

async function toggleArchive(noteId, archive) {
    if (!db || !state.user) return
    const ref = db.collection("users").doc(state.user.uid).collection("notes").doc(noteId)
    await ref.update({ isArchived: !!archive, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    UI.showToast(archive ? UI.getText("archived", "Archived") : UI.getText("restored", "Restored"))
}

async function initApp() {
    await DriveService.init()
    ReminderService.init()
    Editor.init()
    UI.init()
    UI.setLang(localStorage.getItem("app-lang") || "ru")

    if (!db || !state.user) return

    db.collection("users").doc(state.user.uid).collection("folders")
        .orderBy("createdAt", "asc")
        .onSnapshot(snap => {
            state.folders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            UI.renderFolders()
            if (state.view === "folders") filterAndRender(document.getElementById("search-input")?.value || "")
        })

    db.collection("users").doc(state.user.uid).collection("notes")
        .orderBy("order", "asc")
        .onSnapshot(snap => {
            state.notes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            filterAndRender(document.getElementById("search-input")?.value || "")
        })

    const search = document.getElementById("search-input")
    if (search) search.value = ""
    switchView("notes")
}

window.initApp = initApp
window.switchView = switchView
window.filterAndRender = filterAndRender
window.deleteFolder = deleteFolder
window.openNoteActions = openNoteActions
window.toggleFavorite = toggleFavorite
window.togglePin = togglePin
window.toggleArchive = toggleArchive
