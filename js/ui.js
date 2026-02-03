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
