const UI = {
    els: {},
    currentNoteActionId: null,
    draggedNoteId: null,
    dragTargetId: null,
    dragPosition: null,
    visibleNotes: [],
    settingsPage: null,

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
        window.addEventListener("hashchange", () => this.routeShare())
    },

    getText(key, fallback = "") {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        return dict[key] || fallback || key
    },

    setLang(lang) {
        const applied = StateActions.setLanguage(lang)
        localStorage.setItem("app-lang", applied)
        this.applyLangToDom()
        this.updateViewTitle()
        this.updatePrimaryActionLabel()
        ThemeManager.renderPicker()
        this.syncSettingsUI()
        this.renderEditorSettings()
        this.renderSettingsPage()
    },

    applyLangToDom() {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
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
            const actionEl = e.target.closest("[data-action]")
            if (actionEl) {
                this.handleAction(actionEl, e)
            }

            if (this.els.sidebar?.classList.contains("active") && !this.els.sidebar.contains(e.target) && !e.target.closest("#menu-toggle")) {
                this.toggleSidebar(false)
            }
            if (this.els.userMenu?.classList.contains("active") && !e.target.closest(".user-avatar-wrapper")) {
                this.toggleUserMenu(false)
            }

            const overlay = e.target.closest(".modal-overlay")
            if (overlay && e.target === overlay && !overlay.dataset.modalStatic) {
                this.closeModal(overlay.id)
            }
        })

        document.querySelectorAll(".star").forEach(star => {
            star.addEventListener("click", () => {
                const val = parseInt(star.dataset.val, 10)
                StateActions.setTempRating(val)
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

        const search = document.getElementById("search-input")
        if (search) {
            search.addEventListener("input", (e) => {
                filterAndRender(e.target.value)
            })
        }

        this.els.grid?.addEventListener("click", async (e) => {
            const action = e.target.closest(".action-btn")
            if (action) return
            const card = e.target.closest(".note-card")
            if (!card) return
            const id = card.dataset.noteId ? decodeURIComponent(card.dataset.noteId) : null
            const note = StateStore.read().notes.find(n => n.id === id)
            if (note) await Editor.openFromList(note)
        })

        this.els.grid?.addEventListener("dragstart", (e) => {
            const card = e.target.closest(".note-card")
            if (!card) return
            if (StateStore.read().searchQuery.trim()) {
                e.preventDefault()
                this.showToast(this.getText("reorder_search_disabled", "Reordering is disabled while searching"))
                return
            }
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
    },

    handleAction(el, e) {
        const action = el.dataset.action
        if (!action) return

        const stopFor = new Set(["note-pin", "note-favorite", "note-menu", "delete-folder"])
        if (stopFor.has(action)) e.stopPropagation()

        switch (action) {
            case "login":
                Auth.login()
                break
            case "toggle-sidebar": {
                const forceAttr = el.dataset.force
                const force = typeof forceAttr === "string" ? forceAttr === "true" : undefined
                this.toggleSidebar(force)
                break
            }
            case "switch-view":
                switchView(el.dataset.view)
                break
            case "open-folder":
                switchView("folder", el.dataset.folderId)
                break
            case "delete-folder":
                deleteFolder(el.dataset.folderId)
                break
            case "primary-action":
                this.primaryAction()
                break
            case "open-modal":
                this.openModal(el.dataset.modal)
                break
            case "close-modal":
                this.closeModal(el.dataset.modal)
                break
            case "open-settings":
                this.openSettings()
                break
            case "settings-back":
                this.backSettingsPage()
                break
            case "open-settings-page":
                this.openSettingsPage(el.dataset.page)
                break
            case "toggle-user-menu":
                this.toggleUserMenu()
                break
            case "switch-account":
                this.showConfirm("account", () => Auth.switchAccount())
                break
            case "logout":
                this.showConfirm("exit", () => Auth.logout())
                break
            case "trigger-import":
                this.triggerImport()
                break
            case "copy-share-link":
                this.copyToClipboard("share-link")
                break
            case "copy-collab-link":
                this.copyToClipboard("collab-link")
                break
            case "editor-undo":
                Editor.undo()
                break
            case "editor-redo":
                Editor.redo()
                break
            case "editor-delete":
                Editor.deleteCurrent()
                break
            case "editor-save":
                Editor.save()
                break
            case "close-editor":
                Editor.close()
                break
            case "toggle-toolbar":
                Editor.toggleToolbar()
                break
            case "note-pin":
                togglePin(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-favorite":
                toggleFavorite(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-menu":
                openNoteActions(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "download-note":
                this.downloadSelectedNote()
                break
            case "upload-note":
                this.uploadSelectedNote()
                break
            case "submit-feedback":
                this.submitFeedback()
                break
            case "media-reset":
                Editor.resetMediaTransform()
                break
            case "media-align":
                Editor.alignMediaOrText(el.dataset.align)
                break
            case "media-draw":
                Editor.drawOnSelectedMedia()
                break
            case "media-delete":
                Editor.deleteSelectedMedia()
                break
            case "sketch-undo":
                SketchService.undo()
                break
            case "sketch-clear":
                SketchService.clear()
                break
            case "sketch-save":
                SketchService.save()
                break
            case "photo-undo":
                PhotoEditor.undo()
                break
            case "photo-clear":
                PhotoEditor.clear()
                break
            case "photo-save":
                PhotoEditor.save()
                break
            default:
                break
        }
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

    copyToClipboard(id) {
        const input = document.getElementById(id)
        if (!input || !navigator.clipboard) return
        navigator.clipboard.writeText(input.value || "").catch(() => null)
    },

    async handleNoteImport(e) {
        if (!db || !StateStore.read().user) return
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
                    const current = StateStore.read()
                    if (current.notes.some(x => x.id === n.id)) n.id = Utils.generateId()
                    if (n.folderId && !current.folders.find(f => f.id === n.folderId)) n.folderId = null
                    const ref = db.collection("users").doc(current.user.uid).collection("notes").doc(n.id)
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
        if (StateStore.read().view === "folders") {
            if (StateStore.read().folders.length >= 10) return this.showToast(this.getText("folder_limit", "Folder limit reached"))
            this.showPrompt(this.getText("new_folder", "New folder"), this.getText("folder_placeholder", "Folder name"), async (name) => {
                const trimmed = String(name || "").trim()
                if (!trimmed) return this.showToast(this.getText("folder_empty", "Enter a folder name"))
                if (StateStore.read().folders.some(f => f.name && f.name.toLowerCase() === trimmed.toLowerCase())) {
                    return this.showToast(this.getText("folder_exists", "Folder already exists"))
                }
                if (!db || !StateStore.read().user) return
                await db.collection("users").doc(StateStore.read().user.uid).collection("folders").add({
                    name: trimmed,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                })
            })
            return
        }
        Editor.open()
    },

    applyAppearanceSettings() {
        const saved = JSON.parse(localStorage.getItem("app-preferences")) || {}
        StateActions.updateConfig({
            folderViewMode: saved.folderViewMode || StateStore.read().config.folderViewMode,
            reduceMotion: !!saved.reduceMotion
        })
        ThemeManager.revertToLastSaved()
        this.renderFolders()
        this.syncSettingsUI()
    },

    updateViewTitle() {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const titles = {
            notes: dict.view_notes || "Notes",
            favorites: dict.view_favorites || "Favorites",
            archive: dict.view_archive || "Archive",
            folder: dict.view_folder || "Folder",
            folders: dict.view_folders || "Folders"
        }
        const { view, activeFolderId, folders } = StateStore.read()
        let title = titles[view] || "SmartNotes"
        if (view === "folder" && activeFolderId) {
            const folder = folders.find(f => f.id === activeFolderId)
            if (folder) title = folder.name
        }
        const el = document.getElementById("current-view-title")
        if (el) el.textContent = title
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return
        const label = StateStore.read().view === "folders" ? this.getText("create_folder", "Create folder") : this.getText("create_note", "Create note")
        this.els.fab.setAttribute("aria-label", label)
    },

    openModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.add("active")
        this.toggleSidebar(false)
        if (id === "share-modal") {
            const link = document.getElementById("share-link")
            const n = StateStore.read().currentNote
            if (link && n) link.value = ShareService.makeShareLink(n.id)
        }
        if (id === "collab-modal") {
            const link = document.getElementById("collab-link")
            const n = StateStore.read().currentNote
            if (link && n) link.value = ShareService.makeCollabLink(n.id)
        }
    },

    closeModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.remove("active")
    },

    openSettings() {
        this.settingsPage = null
        this.openModal("settings-modal")
        this.renderSettingsPage()
    },

    openSettingsPage(page) {
        this.settingsPage = page
        this.renderSettingsPage()
    },

    backSettingsPage() {
        this.settingsPage = null
        this.renderSettingsPage()
    },

    renderSettingsPage() {
        const root = document.getElementById("settings-content")
        const title = document.getElementById("settings-title")
        const backBtn = document.querySelector(".settings-back")
        if (!root || !title || !backBtn) return
        const page = this.settingsPage
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        if (!page) {
            title.textContent = dict.settings_menu_title || dict.settings || "Settings"
            backBtn.classList.add("is-hidden")
            root.innerHTML = `
                <div class="settings-menu-list">
                    <button type="button" class="settings-menu-item" data-action="open-settings-page" data-page="general">
                        <div class="settings-menu-meta">
                            <span class="settings-menu-title">${dict.settings_general || "General"}</span>
                            <span class="settings-menu-desc">${dict.settings_category_general_desc || ""}</span>
                        </div>
                        <i class="material-icons-round" aria-hidden="true">chevron_right</i>
                    </button>
                    <button type="button" class="settings-menu-item" data-action="open-settings-page" data-page="appearance">
                        <div class="settings-menu-meta">
                            <span class="settings-menu-title">${dict.settings_appearance || "Appearance"}</span>
                            <span class="settings-menu-desc">${dict.settings_category_appearance_desc || ""}</span>
                        </div>
                        <i class="material-icons-round" aria-hidden="true">chevron_right</i>
                    </button>
                    <button type="button" class="settings-menu-item" data-action="open-settings-page" data-page="editor_tools">
                        <div class="settings-menu-meta">
                            <span class="settings-menu-title">${dict.settings_editor_tools || "Editor Tools"}</span>
                            <span class="settings-menu-desc">${dict.settings_category_editor_tools_desc || ""}</span>
                        </div>
                        <i class="material-icons-round" aria-hidden="true">chevron_right</i>
                    </button>
                </div>
            `
            return
        }

        backBtn.classList.remove("is-hidden")
        if (page === "general") {
            title.textContent = dict.settings_general || dict.general || "General"
            root.innerHTML = `
                <div class="settings-group">
                    <div class="settings-grid">
                        <div class="field">
                            <span class="field-label">${dict.language || "Language"}</span>
                            <select id="settings-language" class="input-area" aria-label="${dict.language || "Language"}">
                                <option value="ru">Русский</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.folder_view_mode || "Display"}</span>
                            <select id="settings-folder-view" class="input-area" aria-label="${dict.folder_view_mode || "Display"}">
                                <option value="compact">${dict.folder_view_compact || "Sidebar list"}</option>
                                <option value="full">${dict.folder_view_full || "Full view"}</option>
                            </select>
                        </div>
                        <label class="row-left">
                            <input type="checkbox" id="settings-reduce-motion" aria-label="${dict.reduce_motion || "Reduce motion"}">
                            <span>${dict.reduce_motion || "Reduce motion"}</span>
                        </label>
                    </div>
                </div>
            `
            this.bindSettingsControls()
            this.syncSettingsUI()
            return
        }

        if (page === "appearance") {
            title.textContent = dict.settings_appearance || dict.appearance || "Appearance"
            root.innerHTML = `
                <div class="settings-group">
                    <div class="field">
                        <span class="field-label">${dict.presets || "Presets"}</span>
                        <div id="theme-picker-root" class="settings-theme-grid"></div>
                    </div>
                    <div class="field">
                        <span class="field-label">${dict.manual || "Manual"}</span>
                        <div class="settings-color-grid">
                            <label class="field">
                                <span class="field-label">${dict.c_accent || "Accent"}</span>
                                <input type="color" id="cp-primary" class="color-input" aria-label="${dict.color_accent || "Accent color"}">
                            </label>
                            <label class="field">
                                <span class="field-label">${dict.c_bg || "Background"}</span>
                                <input type="color" id="cp-bg" class="color-input" aria-label="${dict.color_bg || "Background color"}">
                            </label>
                            <label class="field">
                                <span class="field-label">${dict.c_text || "Text"}</span>
                                <input type="color" id="cp-text" class="color-input" aria-label="${dict.color_text || "Text color"}">
                            </label>
                        </div>
                    </div>
                </div>
            `
            ThemeManager.revertToLastSaved()
            ThemeManager.setupColorInputs()
            return
        }

        if (page === "editor_tools") {
            title.textContent = dict.settings_editor_tools || dict.editor_settings || "Editor tools"
            root.innerHTML = `<div id="editor-tools-list" class="settings-toggle-list"></div>`
            this.renderEditorSettings()
        }
    },

    bindSettingsControls() {
        const langSelect = document.getElementById("settings-language")
        if (langSelect) {
            langSelect.addEventListener("change", (e) => {
                this.setLang(e.target.value)
            })
        }

        const folderSelect = document.getElementById("settings-folder-view")
        if (folderSelect) {
            folderSelect.addEventListener("change", (e) => {
                const next = e.target.value === "full" ? "full" : "compact"
                StateActions.updateConfig({ folderViewMode: next })
                this.savePreferences()
                this.renderFolders()
                filterAndRender(document.getElementById("search-input")?.value || "")
            })
        }

        const reduceToggle = document.getElementById("settings-reduce-motion")
        if (reduceToggle) {
            reduceToggle.addEventListener("change", (e) => {
                StateActions.updateConfig({ reduceMotion: !!e.target.checked })
                this.savePreferences()
                ThemeManager.revertToLastSaved()
            })
        }
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

    showConfirm(type, cb) {
        this.confirm(type, cb)
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
        if (cancel) {
            const cancelClone = cancel.cloneNode(true)
            cancel.parentNode.replaceChild(cancelClone, cancel)
            cancelClone.onclick = () => this.els.confirmModal.classList.remove("active")
        }
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

        const cancelClone = cancel.cloneNode(true)
        cancel.parentNode.replaceChild(cancelClone, cancel)

        okClone.onclick = () => finish(String(input.value || "").trim())
        cancelClone.onclick = () => modal.classList.remove("active")

        modal.classList.add("active")
        setTimeout(() => input.focus(), 80)
    },

    syncSettingsUI() {
        const langSelect = document.getElementById("settings-language")
        if (langSelect) langSelect.value = StateStore.read().config.lang === "en" ? "en" : "ru"
        const folderSelect = document.getElementById("settings-folder-view")
        if (folderSelect) folderSelect.value = StateStore.read().config.folderViewMode === "full" ? "full" : "compact"
        const reduceToggle = document.getElementById("settings-reduce-motion")
        if (reduceToggle) reduceToggle.checked = !!StateStore.read().config.reduceMotion
    },

    renderEditorSettings() {
        const root = document.getElementById("editor-tools-list")
        if (!root || typeof Editor === "undefined") return
        const tools = Editor.getToolList()
        const enabled = Editor.getEnabledTools()
        root.innerHTML = ""
        tools.forEach(tool => {
            const row = document.createElement("div")
            row.className = "settings-toggle-item"
            const label = document.createElement("span")
            label.textContent = this.getText(tool.label, tool.label)
            const input = document.createElement("input")
            input.type = "checkbox"
            input.checked = enabled[tool.id] !== false
            input.setAttribute("aria-label", label.textContent)
            input.addEventListener("change", () => {
                Editor.setToolEnabled(tool.id, input.checked)
            })
            row.append(label, input)
            root.appendChild(row)
        })
    },

    savePreferences() {
        const prefs = {
            folderViewMode: StateStore.read().config.folderViewMode,
            reduceMotion: StateStore.read().config.reduceMotion
        }
        localStorage.setItem("app-preferences", JSON.stringify(prefs))
    },

    closeAllModals() {
        document.querySelectorAll(".modal-overlay.active").forEach(el => el.classList.remove("active"))
    },

    setDropIndicator(card, position) {
        this.clearDragIndicators()
        card.classList.add(position === "before" ? "drop-before" : "drop-after")
    },

    clearDragIndicators() {
        if (!this.els.grid) return
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

    getReorderScope() {
        const { notes, view, activeFolderId } = StateStore.read()
        let list = notes.slice()
        if (view === "favorites") list = list.filter(n => !!n.isFavorite && !n.isArchived)
        if (view === "archive") list = list.filter(n => !!n.isArchived)
        if (view === "notes") list = list.filter(n => !n.isArchived)
        if (view === "folder") list = list.filter(n => !n.isArchived && n.folderId === activeFolderId)
        return list
    },

    reorderNotes(draggedId, targetId, position) {
        if (!db || !StateStore.read().user) return
        if (draggedId === targetId) return
        if (StateStore.read().searchQuery.trim()) {
            this.showToast(this.getText("reorder_search_disabled", "Reordering is disabled while searching"))
            return
        }
        const draggedNote = StateStore.read().notes.find(n => n.id === draggedId)
        const targetNote = StateStore.read().notes.find(n => n.id === targetId)
        if (!draggedNote || !targetNote) return
        const { view, activeFolderId } = StateStore.read()
        const isFolderView = view === "folder" && !!activeFolderId
        if (!isFolderView && (draggedNote.folderId || targetNote.folderId)) {
            this.showToast(this.getText("reorder_folder_disabled", "Reordering is available only inside folders or for notes without folders"))
            return
        }
        if (!!draggedNote.isPinned !== !!targetNote.isPinned) {
            this.showToast(this.getText("reorder_pinned_blocked", "Pinned notes reorder separately"))
            return
        }
        const orderKey = isFolderView ? "folderOrder" : "order"
        const groupIds = this.visibleNotes.filter(n => !!n.isPinned === !!draggedNote.isPinned).map(n => n.id)
        const fromIndex = groupIds.indexOf(draggedId)
        const toIndex = groupIds.indexOf(targetId)
        if (fromIndex === -1 || toIndex === -1) return
        groupIds.splice(fromIndex, 1)
        const insertIndex = position === "after" ? toIndex + 1 : toIndex
        groupIds.splice(insertIndex > fromIndex ? insertIndex - 1 : insertIndex, 0, draggedId)

        const previous = groupIds.map(id => {
            const note = StateStore.read().notes.find(n => n.id === id)
            return { id, value: typeof note?.[orderKey] === "number" ? note[orderKey] : 0 }
        })
        const { orderHistory } = StateStore.read()
        const scopeKey = `${view}:${activeFolderId || "all"}:${draggedNote.isPinned ? "pinned" : "unpinned"}`
        const nextHistory = [...orderHistory, { scope: scopeKey, orderKey, items: previous }].slice(-20)
        StateActions.setOrderHistory(nextHistory)

        const updates = groupIds.map((id, index) => ({ id, value: index + 1 }))
        const updatedNotes = StateStore.read().notes.map(note => {
            const update = updates.find(item => item.id === note.id)
            return update ? { ...note, [orderKey]: update.value } : note
        })
        StateActions.setNotes(updatedNotes)

        const batch = db.batch()
        updates.forEach(update => {
            const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(update.id)
            batch.update(ref, { [orderKey]: update.value })
        })
        batch.commit()
        this.showToast(this.getText("order_updated", "Order updated"), {
            actionLabel: this.getText("undo", "Undo"),
            onAction: () => this.undoOrder()
        })
        filterAndRender(document.getElementById("search-input")?.value || "")
    },

    undoOrder() {
        if (!db || !StateStore.read().user) return
        const last = StateStore.read().orderHistory[StateStore.read().orderHistory.length - 1]
        if (!last) return
        StateActions.setOrderHistory(StateStore.read().orderHistory.slice(0, -1))
        const batch = db.batch()
        const orderKey = last.orderKey || "order"
        const updatedNotes = StateStore.read().notes.map(note => {
            const item = last.items.find(entry => entry.id === note.id)
            return item ? { ...note, [orderKey]: item.value } : note
        })
        StateActions.setNotes(updatedNotes)
        last.items.forEach(item => {
            const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(item.id)
            batch.update(ref, { [orderKey]: item.value })
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
        const hideList = StateStore.read().config.folderViewMode === "full"
        root.classList.toggle("hidden", hideList)
        if (hideList) {
            root.innerHTML = ""
            return
        }
        const { folders, activeFolderId } = StateStore.read()
        root.innerHTML = folders.map(f => `
            <button type="button" class="nav-item ${activeFolderId === f.id ? "active" : ""}" data-action="open-folder" data-folder-id="${f.id}">
                <i class="material-icons-round" aria-hidden="true">folder</i>
                <span>${Utils.escapeHtml(f.name)}</span>
                <i class="material-icons-round" style="margin-left:auto; opacity:0.5; font-size:16px" data-action="delete-folder" data-folder-id="${f.id}" aria-hidden="true">close</i>
            </button>
        `).join("")
    },

    renderFolderGrid() {
        this.updateEmptyState("folder_open", this.getText("folders_empty", "No folders yet"))
        const { folders, notes } = StateStore.read()
        this.els.empty.classList.toggle("hidden", folders.length > 0)
        this.els.grid.classList.add("folder-grid")
        this.els.grid.innerHTML = folders.map(folder => {
            const count = notes.filter(note => note.folderId === folder.id && !note.isArchived).length
            const label = count === 1 ? this.getText("note_single", "note") : this.getText("note_plural", "notes")
            return `
                <div class="folder-card" data-action="open-folder" data-folder-id="${folder.id}">
                    <div class="folder-title">${Utils.escapeHtml(folder.name)}</div>
                    <div class="folder-meta">${count} ${label}</div>
                </div>
            `
        }).join("")
    },

    showShareFallback(message) {
        const text = document.getElementById("share-fallback-message")
        if (text) text.textContent = message
        this.openModal("share-fallback-modal")
    },

    handlePendingShare() {
        const { pendingShare, user, notes } = StateStore.read()
        if (!pendingShare || !user) return
        if (!notes.length) return
        const payload = pendingShare
        StateActions.clearPendingShare()
        if (payload.error) {
            return this.showShareFallback(this.getText("share_invalid", "Invalid link"))
        }
        const note = notes.find(n => n.id === payload.noteId)
        if (!note) return this.showShareFallback(this.getText("share_missing", "Note not found"))
        if (payload.mode === "collab") this.showToast(this.getText("collab_enabled", "Collaboration enabled"))
        Editor.openFromList(note)
    },

    captureShareFromHash() {
        const rawHash = String(location.hash || "")
        const parsed = ShareService.parseHash(rawHash)
        if (!parsed) return
        StateActions.setPendingShare(parsed)
        history.replaceState({}, "", ShareService.base())
    },

    routeShare() {
        const rawHash = String(location.hash || "")
        const parsed = ShareService.parseHash(rawHash)
        if (!parsed) {
            if (/^#(share|collab)(\/|$)/.test(rawHash)) {
                history.replaceState({}, "", ShareService.base())
                return this.showShareFallback(this.getText("share_invalid", "Invalid link"))
            }
            return
        }
        StateActions.setPendingShare(parsed)
        history.replaceState({}, "", ShareService.base())
        this.handlePendingShare()
    },

    async submitFeedback() {
        if (!db || !StateStore.read().user) {
            this.showToast(this.getText("feedback_failed", "Unable to send feedback"))
            return
        }
        if (!StateStore.read().tempRating) {
            this.showToast(this.getText("rate_required", "Please rate first"))
            return
        }
        const text = String(document.getElementById("feedback-text")?.value || "")
        const { user, tempRating, config } = StateStore.read()
        const payload = {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            rating: tempRating,
            text: text.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent || "",
            appVersion: "web",
            language: config.lang
        }
        try {
            await db.collection("feedback").add(payload)
            StateActions.setTempRating(0)
            document.querySelectorAll(".star").forEach(s => {
                s.textContent = "star_border"
                s.classList.remove("active")
            })
            const feedbackInput = document.getElementById("feedback-text")
            if (feedbackInput) feedbackInput.value = ""
            this.showToast(this.getText("feedback_thanks", "Thanks!"))
            this.closeModal("rate-modal")
        } catch {
            this.showToast(this.getText("feedback_failed", "Unable to send feedback"))
        }
    },

    downloadSelectedNote() {
        const note = StateStore.read().notes.find(n => n.id === this.currentNoteActionId)
        if (!note) return
        const data = NoteIO.exportNote(note)
        const blob = new Blob([data], { type: "application/json" })
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = NoteIO.fileNameFor(note)
        a.click()
        URL.revokeObjectURL(a.href)
        this.showToast(this.getText("download_success", "File saved"))
        this.closeModal("note-actions-modal")
    },

    uploadSelectedNote() {
        const note = StateStore.read().notes.find(n => n.id === this.currentNoteActionId)
        if (!note) return
        DriveService.uploadNote(note)
        this.closeModal("note-actions-modal")
    }
}
