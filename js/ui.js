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
        this.syncSettingsUI()
        this.renderEditorSettings()
        this.renderSettingsPage()
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
        this.renderSettingsPage()
    },

    bindEvents() {
        document.addEventListener("click", (e) => {
            const actionEl = e.target.closest("[data-action]")
            if (actionEl) {
                const action = actionEl.dataset.action
                if (action) {
                    e.preventDefault()
                    if (["pin-note", "favorite-note", "note-actions", "delete-folder"].includes(action)) e.stopPropagation()
                    this.handleAction(action, actionEl)
                }
            }
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
            const action = e.target.closest("[data-action]")
            if (action) return
            if (!card) return
            const id = card.dataset.noteId ? decodeURIComponent(card.dataset.noteId) : null
            const note = state.notes.find(n => n.id === id)
            if (note) await Editor.openFromList(note)
        })

        this.els.grid?.addEventListener("dragstart", (e) => {
            if (state.searchQuery && state.searchQuery.trim()) {
                e.preventDefault()
                this.showToast(this.getText("reorder_disabled_search", "Reorder disabled while searching"))
                return
            }
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

        const searchInput = document.getElementById("search-input")
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                filterAndRender(e.target.value)
            })
        }
        document.querySelectorAll(".modal-overlay").forEach(modal => {
            if (["login-screen", "confirm-modal", "prompt-modal"].includes(modal.id)) return
            modal.addEventListener("click", (e) => {
                if (e.target === modal) this.closeModal(modal.id)
            })
        })
    },

    bindSettings() {
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
                state.config.folderViewMode = next
                this.savePreferences()
                this.renderFolders()
                filterAndRender(document.getElementById("search-input")?.value || "")
            })
        }

        const reduceToggle = document.getElementById("settings-reduce-motion")
        if (reduceToggle) {
            reduceToggle.addEventListener("change", (e) => {
                state.config.reduceMotion = !!e.target.checked
                this.savePreferences()
                ThemeManager.revertToLastSaved()
            })
        }
    },

    handleAction(action, el) {
        if (action === "login") return Auth.login()
        if (action === "toggle-sidebar") {
            const force = el.dataset.force
            return this.toggleSidebar(force === "true" ? true : force === "false" ? false : undefined)
        }
        if (action === "switch-view") return switchView(el.dataset.view)
        if (action === "primary-action") return this.primaryAction()
        if (action === "open-modal") return this.openModal(el.dataset.modal)
        if (action === "close-modal") return this.closeModal(el.dataset.modal)
        if (action === "trigger-import") return this.triggerImport()
        if (action === "toggle-user-menu") return this.toggleUserMenu()
        if (action === "switch-account") return this.showConfirm("account", () => Auth.switchAccount())
        if (action === "logout") return this.showConfirm("exit", () => Auth.logout())
        if (action === "editor-close") return Editor.close()
        if (action === "editor-undo") return Editor.undo()
        if (action === "editor-redo") return Editor.redo()
        if (action === "editor-delete") return Editor.deleteCurrent()
        if (action === "editor-save") return Editor.save()
        if (action === "media-reset") return Editor.resetMediaTransform()
        if (action === "media-align-left") return Editor.alignMediaOrText("left")
        if (action === "media-align-right") return Editor.alignMediaOrText("right")
        if (action === "media-draw") return Editor.drawOnSelectedMedia()
        if (action === "media-delete") return Editor.deleteSelectedMedia()
        if (action === "open-settings") return this.openSettings()
        if (action === "open-settings-page") return this.openSettingsPage(el.dataset.page)
        if (action === "settings-back") return this.backSettingsPage()
        if (action === "download-note") return this.downloadSelectedNote()
        if (action === "upload-note") return this.uploadSelectedNote()
        if (action === "copy-share") return this.copyToClipboard("share-link")
        if (action === "copy-collab") return this.copyToClipboard("collab-link")
        if (action === "submit-feedback") return this.submitFeedback()
        if (action === "sketch-undo") return SketchService.undo()
        if (action === "sketch-clear") return SketchService.clear()
        if (action === "sketch-save") return SketchService.save()
        if (action === "photo-undo") return PhotoEditor.undo()
        if (action === "photo-clear") return PhotoEditor.clear()
        if (action === "photo-save") return PhotoEditor.save()
        if (action === "pin-note") return togglePin(decodeURIComponent(el.dataset.id || ""))
        if (action === "favorite-note") return toggleFavorite(decodeURIComponent(el.dataset.id || ""))
        if (action === "note-actions") return openNoteActions(decodeURIComponent(el.dataset.id || ""))
        if (action === "open-folder") return switchView("folder", el.dataset.id)
        if (action === "delete-folder") return deleteFolder(el.dataset.id)
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
                    n.content = Utils.sanitizeHtml(n.content || "")
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
                const trimmed = String(name || "").trim()
                if (!trimmed) return this.showToast(this.getText("folder_empty", "Enter a folder name"))
                if (state.folders.some(f => f.name && f.name.toLowerCase() === trimmed.toLowerCase())) {
                    return this.showToast(this.getText("folder_exists", "Folder already exists"))
                }
                if (!db || !state.user) return
                await db.collection("users").doc(state.user.uid).collection("folders").add({
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
        state.config.folderViewMode = saved.folderViewMode || state.config.folderViewMode
        state.config.reduceMotion = !!saved.reduceMotion
        ThemeManager.revertToLastSaved()
        this.renderFolders()
        this.syncSettingsUI()
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
    },

    openSettings() {
        this.settingsPage = null
        this.openModal("settings-modal")
        this.syncSettingsUI()
        this.renderSettingsPage()
        this.renderEditorSettings()
        ThemeManager.renderPicker()
        ThemeManager.setupColorInputs()
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
        const body = document.getElementById("settings-body")
        const title = document.getElementById("settings-title")
        const backBtn = document.querySelector("[data-action=\"settings-back\"]")
        if (!body || !title || !backBtn) return
        const dict = LANG[state.config.lang] || LANG.ru
        const isRoot = !this.settingsPage
        backBtn.classList.toggle("hidden", isRoot)
        title.textContent = isRoot ? this.getText("settings_menu_title", "Settings") : this.getText(`settings_${this.settingsPage}`, "Settings")
        body.innerHTML = ""

        if (isRoot) {
            const menu = document.createElement("div")
            menu.className = "settings-menu"
            const items = [
                { id: "general", label: "settings_general", desc: "settings_category_general_desc" },
                { id: "appearance", label: "settings_appearance", desc: "settings_category_appearance_desc" },
                { id: "editor_tools", label: "settings_editor_tools", desc: "settings_category_editor_tools_desc" }
            ]
            items.forEach(item => {
                const btn = document.createElement("button")
                btn.type = "button"
                btn.className = "settings-menu-item"
                btn.dataset.action = "open-settings-page"
                btn.dataset.page = item.id
                const label = document.createElement("span")
                label.className = "settings-menu-title"
                label.textContent = dict[item.label] || item.id
                const desc = document.createElement("span")
                desc.className = "settings-menu-desc"
                desc.textContent = dict[item.desc] || ""
                btn.append(label, desc)
                menu.appendChild(btn)
            })
            body.appendChild(menu)
            return
        }

        if (this.settingsPage === "general") {
            const section = document.createElement("div")
            section.className = "settings-section"

            const langField = document.createElement("div")
            langField.className = "field"
            const langLabel = document.createElement("span")
            langLabel.className = "field-label"
            langLabel.textContent = this.getText("language", "Language")
            const langSelect = document.createElement("select")
            langSelect.id = "settings-language"
            langSelect.className = "input-area"
            langSelect.setAttribute("aria-label", langLabel.textContent)
            langSelect.innerHTML = `
                <option value="ru">Русский</option>
                <option value="en">English</option>
            `
            langField.append(langLabel, langSelect)

            const folderField = document.createElement("div")
            folderField.className = "field"
            const folderLabel = document.createElement("span")
            folderLabel.className = "field-label"
            folderLabel.textContent = this.getText("folder_view_mode", "Folder view")
            const folderSelect = document.createElement("select")
            folderSelect.id = "settings-folder-view"
            folderSelect.className = "input-area"
            folderSelect.setAttribute("aria-label", folderLabel.textContent)
            folderSelect.innerHTML = `
                <option value="compact">${this.getText("folder_view_compact", "Compact")}</option>
                <option value="full">${this.getText("folder_view_full", "Full")}</option>
            `
            folderField.append(folderLabel, folderSelect)

            const reduceRow = document.createElement("label")
            reduceRow.className = "row-left"
            const reduceToggle = document.createElement("input")
            reduceToggle.type = "checkbox"
            reduceToggle.id = "settings-reduce-motion"
            reduceToggle.setAttribute("aria-label", this.getText("reduce_motion", "Reduce motion"))
            const reduceLabel = document.createElement("span")
            reduceLabel.textContent = this.getText("reduce_motion", "Reduce motion")
            reduceRow.append(reduceToggle, reduceLabel)

            section.append(langField, folderField, reduceRow)
            body.appendChild(section)
        }

        if (this.settingsPage === "appearance") {
            const section = document.createElement("div")
            section.className = "settings-section"
            const presets = document.createElement("div")
            presets.className = "field"
            const presetsLabel = document.createElement("span")
            presetsLabel.className = "field-label"
            presetsLabel.textContent = this.getText("presets", "Presets")
            const presetsGrid = document.createElement("div")
            presetsGrid.id = "theme-picker-root"
            presetsGrid.className = "settings-theme-grid"
            presets.append(presetsLabel, presetsGrid)

            const manual = document.createElement("div")
            manual.className = "field"
            const manualLabel = document.createElement("span")
            manualLabel.className = "field-label"
            manualLabel.textContent = this.getText("manual", "Manual")
            const manualGrid = document.createElement("div")
            manualGrid.className = "settings-color-grid"
            manualGrid.innerHTML = `
                <label class="field">
                    <span class="field-label">${this.getText("c_accent", "Accent")}</span>
                    <input type="color" id="cp-primary" class="color-input" aria-label="${this.getText("color_accent", "Accent color")}">
                </label>
                <label class="field">
                    <span class="field-label">${this.getText("c_bg", "Background")}</span>
                    <input type="color" id="cp-bg" class="color-input" aria-label="${this.getText("color_bg", "Background color")}">
                </label>
                <label class="field">
                    <span class="field-label">${this.getText("c_text", "Text")}</span>
                    <input type="color" id="cp-text" class="color-input" aria-label="${this.getText("color_text", "Text color")}">
                </label>
            `
            manual.append(manualLabel, manualGrid)

            section.append(presets, manual)
            body.appendChild(section)
        }

        if (this.settingsPage === "editor_tools") {
            const section = document.createElement("div")
            section.className = "settings-section"
            const list = document.createElement("div")
            list.id = "editor-tools-list"
            list.className = "settings-toggle-list"
            section.appendChild(list)
            body.appendChild(section)
        }

        this.bindSettings()
        if (this.settingsPage === "appearance") {
            ThemeManager.renderPicker()
            ThemeManager.setupColorInputs()
        }
        if (this.settingsPage === "editor_tools") {
            this.renderEditorSettings()
        }
        this.syncSettingsUI()
    },

    copyToClipboard(inputId) {
        const input = document.getElementById(inputId)
        if (!input) return
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(input.value || "").then(() => {
                this.showToast(this.getText("copied", "Copied"))
            }).catch(() => {
                this.showToast(this.getText("copy_failed", "Copy failed"))
            })
            return
        }
        input.select()
        document.execCommand("copy")
        this.showToast(this.getText("copied", "Copied"))
    },

    async submitFeedback() {
        if (!db || !state.user) return this.showToast(this.getText("auth_required", "Sign in first"))
        const rating = Number(state.tempRating || 0)
        if (rating < 1) return this.showToast(this.getText("rate_required", "Please rate first"))
        const text = String(document.getElementById("feedback-text")?.value || "").trim()
        const payload = {
            uid: state.user.uid,
            email: state.user.email || "",
            displayName: state.user.displayName || "",
            rating,
            text,
            language: state.config.lang || "ru",
            userAgent: navigator.userAgent || "",
            appVersion: "1.0.0",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }
        try {
            await db.collection("feedback").add(payload)
            state.tempRating = 0
            document.querySelectorAll(".star").forEach(s => {
                s.textContent = "star_border"
                s.classList.remove("active")
            })
            const input = document.getElementById("feedback-text")
            if (input) input.value = ""
            this.showToast(this.getText("feedback_thanks", "Thanks"))
            this.closeModal("rate-modal")
        } catch {
            this.showToast(this.getText("feedback_failed", "Failed to send"))
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

    syncSettingsUI() {
        const langSelect = document.getElementById("settings-language")
        if (langSelect) langSelect.value = state.config.lang === "en" ? "en" : "ru"
        const folderSelect = document.getElementById("settings-folder-view")
        if (folderSelect) folderSelect.value = state.config.folderViewMode === "full" ? "full" : "compact"
        const reduceToggle = document.getElementById("settings-reduce-motion")
        if (reduceToggle) reduceToggle.checked = !!state.config.reduceMotion
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
            folderViewMode: state.config.folderViewMode,
            reduceMotion: state.config.reduceMotion
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
        let list = state.notes.slice()
        if (state.view === "folders") return []
        if (state.view === "favorites") list = list.filter(n => !!n.isFavorite && !n.isArchived)
        if (state.view === "archive") list = list.filter(n => !!n.isArchived)
        if (state.view === "notes") list = list.filter(n => !n.isArchived)
        if (state.view === "folder") list = list.filter(n => !n.isArchived && n.folderId === state.activeFolderId)
        return normalizeVisibleNotes(list)
    },

    reorderNotes(draggedId, targetId, position) {
        if (!db || !state.user) return
        if (state.searchQuery && state.searchQuery.trim()) {
            this.showToast(this.getText("reorder_disabled_search", "Reorder disabled while searching"))
            return
        }
        if (draggedId === targetId) return
        const scopeList = this.getReorderScope()
        const draggedNote = scopeList.find(n => n.id === draggedId)
        const targetNote = scopeList.find(n => n.id === targetId)
        if (!draggedNote || !targetNote) return
        if (!!draggedNote.isPinned !== !!targetNote.isPinned) return

        const groupList = scopeList.filter(n => !!n.isPinned === !!draggedNote.isPinned)
        const visibleIds = groupList.map(n => n.id)
        const fromIndex = visibleIds.indexOf(draggedId)
        const toIndex = visibleIds.indexOf(targetId)
        if (fromIndex === -1 || toIndex === -1) return
        visibleIds.splice(fromIndex, 1)
        const insertIndex = position === "after" ? toIndex + 1 : toIndex
        visibleIds.splice(insertIndex > fromIndex ? insertIndex - 1 : insertIndex, 0, draggedId)

        const previous = groupList.map(n => ({ id: n.id, order: typeof n.order === "number" ? n.order : 0 }))
        state.orderHistory.push(previous)
        if (state.orderHistory.length > 20) state.orderHistory.shift()

        const baseOrders = previous.map((item, index) => typeof item.order === "number" && item.order ? item.order : index + 1)
        const updates = visibleIds.map((id, index) => ({ id, order: baseOrders[index] }))
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
            <button type="button" class="nav-item ${state.activeFolderId === f.id ? "active" : ""}" data-action="open-folder" data-id="${Utils.escapeHtml(f.id)}">
                <i class="material-icons-round" aria-hidden="true">folder</i>
                <span>${Utils.escapeHtml(f.name)}</span>
                <i class="material-icons-round" data-action="delete-folder" data-id="${Utils.escapeHtml(f.id)}" style="margin-left:auto; opacity:0.5; font-size:16px">close</i>
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
                <div class="folder-card" data-action="open-folder" data-id="${Utils.escapeHtml(folder.id)}">
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
        if (!state.pendingShare || !state.user) return
        if (!state.notes.length) return
        const payload = state.pendingShare
        const note = state.notes.find(n => n.id === payload.noteId)
        state.pendingShare = null
        if (!note) return this.showShareFallback(this.getText("share_missing", "Note not found"))
        if (payload.mode === "collab") this.showToast(this.getText("collab_enabled", "Collaborative mode enabled"))
        Editor.openFromList(note)
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
        if (parsed.error) {
            state.pendingShare = null
            history.replaceState({}, "", ShareService.base())
            return this.showShareFallback(this.getText("share_invalid", "Invalid link"))
        }
        state.pendingShare = parsed
        history.replaceState({}, "", ShareService.base())
        this.handlePendingShare()
    }
}
