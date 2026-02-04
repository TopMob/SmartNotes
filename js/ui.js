const UI = {
    els: {},
    currentNoteActionId: null,
    draggedNoteId: null,
    dragTargetId: null,
    dragPosition: null,
    visibleNotes: [],
    settingsPage: null,
    appearanceDraft: null,

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
            const id = decodeURIComponent(card.dataset.noteId || "")
            const note = StateStore.read().notes.find(n => n.id === id)
            if (!note) return
            await Editor.openFromList(note)
        })

        this.els.grid?.addEventListener("dragstart", (e) => {
            const card = e.target.closest(".note-card")
            if (!card) return
            this.draggedNoteId = decodeURIComponent(card.dataset.noteId || "")
            card.classList.add("dragging")
            e.dataTransfer.effectAllowed = "move"
        })

        this.els.grid?.addEventListener("dragend", (e) => {
            const card = e.target.closest(".note-card")
            if (card) card.classList.remove("dragging")
            this.draggedNoteId = null
            this.dragTargetId = null
            this.dragPosition = null
            document.querySelectorAll(".note-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"))
        })

        this.els.grid?.addEventListener("dragover", (e) => {
            e.preventDefault()
            const card = e.target.closest(".note-card")
            if (!card) return
            const targetId = decodeURIComponent(card.dataset.noteId || "")
            if (!this.draggedNoteId || targetId === this.draggedNoteId) return

            const rect = card.getBoundingClientRect()
            const mid = rect.top + rect.height / 2
            const pos = e.clientY < mid ? "top" : "bottom"

            if (this.dragTargetId !== targetId || this.dragPosition !== pos) {
                document.querySelectorAll(".note-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"))
                card.classList.add(pos === "top" ? "drag-over-top" : "drag-over-bottom")
                this.dragTargetId = targetId
                this.dragPosition = pos
            }
        })

        this.els.grid?.addEventListener("drop", (e) => {
            e.preventDefault()
            const draggedId = this.draggedNoteId
            const targetId = this.dragTargetId
            const pos = this.dragPosition
            if (!draggedId || !targetId || draggedId === targetId || !pos) return

            document.querySelectorAll(".note-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"))

            const { view, activeFolderId } = StateStore.read()
            const scopeKey = view === "folder" && activeFolderId ? `folder:${activeFolderId}` : "main"
            const orderKey = view === "folder" && activeFolderId ? "folderOrder" : "order"

            const list = StateStore.read().notes
                .filter(n => {
                    if (n.lock && n.lock.hidden) return false
                    if (view === "favorites") return n.isFavorite && !n.isArchived
                    if (view === "archive") return n.isArchived
                    if (view === "folder") return !n.isArchived && n.folderId === activeFolderId
                    return !n.isArchived
                })
                .map(n => NoteIO.normalizeNote(n))
                .sort((a, b) => {
                    const ap = a.isPinned ? 1 : 0
                    const bp = b.isPinned ? 1 : 0
                    if (bp !== ap) return bp - ap
                    const ao = typeof a[orderKey] === "number" ? a[orderKey] : 0
                    const bo = typeof b[orderKey] === "number" ? b[orderKey] : 0
                    return ao - bo
                })

            const draggedIndex = list.findIndex(n => n.id === draggedId)
            const targetIndex = list.findIndex(n => n.id === targetId)
            if (draggedIndex < 0 || targetIndex < 0) return

            const moved = list.splice(draggedIndex, 1)[0]
            const insertAt = pos === "top" ? targetIndex : targetIndex + 1
            list.splice(insertAt, 0, moved)

            const orderHistory = StateStore.read().orderHistory || []
            const previousItems = list.map(n => ({ id: n.id, v: typeof n[orderKey] === "number" ? n[orderKey] : 0 }))
            const nextHistory = [...orderHistory, { scope: scopeKey, orderKey, items: previousItems }]
            StateStore.update("orderHistory", nextHistory.slice(-20))

            const step = 100
            const updates = list.map((n, i) => ({ id: n.id, v: i * step }))
            StateActions.applyOrderUpdates(updates, orderKey)

            if (typeof StateActions.flushOrderUpdates === "function") StateActions.flushOrderUpdates(orderKey)
        })
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
            case "appearance-select-preset":
                if (!this.appearanceDraft) this.beginAppearanceDraft()
                this.appearanceDraft.preset = el.dataset.preset || "dark"
                this.syncAppearanceDraftUI()
                break
            case "appearance-reset":
                this.resetAppearanceDraft()
                break
            case "appearance-save":
                this.applyAppearanceDraft()
                this.showToast(this.getText("saved", "Saved"))
                break
            case "lock-open": {
                const id = decodeURIComponent(el.dataset.noteId || "")
                const note = StateStore.read().notes.find(n => n.id === id)
                if (note) Editor.openFromList(note)
                break
            }
            case "lock-meta-pin":
                togglePin(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "lock-meta-fav":
                toggleFavorite(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "lock-meta-archive":
                toggleArchive(decodeURIComponent(el.dataset.noteId || ""), true)
                break
            case "lock-meta-move": {
                const id = decodeURIComponent(el.dataset.noteId || "")
                const note = StateStore.read().notes.find(n => n.id === id)
                if (!note) break
                const folders = StateStore.read().folders || []
                const dict = LANG[StateStore.read().config.lang] || LANG.ru
                const names = folders.map(f => f.name).filter(Boolean)
                const hint = names.length ? names.join(", ") : (dict.folders_empty || "No folders")
                this.showPrompt(dict.folders || "Folders", hint, async (val) => {
                    const name = String(val || "").trim()
                    const f = folders.find(x => String(x.name || "").trim() === name)
                    if (!f) {
                        this.showToast(this.getText("folder_not_found", "Folder not found"))
                        return
                    }
                    const user = StateStore.read().user
                    if (!db || !user) return
                    await db.collection("users").doc(user.uid).collection("notes").doc(id).update({
                        folderId: f.id,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                })
                break
            }
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
            default:
                break
        }
    },

    toggleSidebar(force) {
        const sidebar = this.els.sidebar
        if (!sidebar) return
        const next = typeof force === "boolean" ? force : !sidebar.classList.contains("active")
        sidebar.classList.toggle("active", next)
        document.body.classList.toggle("sidebar-open", next)
    },

    toggleUserMenu(force) {
        const menu = this.els.userMenu
        if (!menu) return
        const next = typeof force === "boolean" ? force : !menu.classList.contains("active")
        menu.classList.toggle("active", next)
    },

    showToast(text) {
        const toast = document.getElementById("toast")
        if (!toast) return
        toast.textContent = String(text || "")
        toast.classList.add("active")
        clearTimeout(this._toastTimer)
        this._toastTimer = setTimeout(() => toast.classList.remove("active"), 2600)
    },

    showConfirm(type, onOk) {
        const modal = this.els.confirmModal
        if (!modal) return
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const title = modal.querySelector(".confirm-title")
        const body = modal.querySelector(".confirm-body")
        const ok = modal.querySelector("#confirm-ok")
        if (title) title.textContent = dict[`confirm_${type}_title`] || dict.confirm || "Confirm"
        if (body) body.textContent = dict[`confirm_${type}_body`] || dict.confirm_text || "Are you sure?"
        if (ok) {
            ok.onclick = () => {
                this.closeModal("confirm-modal")
                if (typeof onOk === "function") onOk()
            }
        }
        this.openModal("confirm-modal")
    },

    showPrompt(title, placeholder, onOk) {
        const modal = this.els.promptModal
        if (!modal) return
        const titleEl = modal.querySelector(".prompt-title")
        const input = document.getElementById("prompt-input")
        const ok = document.getElementById("prompt-ok")
        if (titleEl) titleEl.textContent = String(title || "")
        if (input) {
            input.value = ""
            input.placeholder = String(placeholder || "")
            setTimeout(() => input.focus(), 50)
        }
        if (ok) {
            ok.onclick = async () => {
                this.closeModal("prompt-modal")
                if (typeof onOk === "function") await onOk(input ? input.value : "")
            }
        }
        this.openModal("prompt-modal")
    },

    copyToClipboard(inputId) {
        const input = document.getElementById(inputId)
        if (!input) return
        input.select()
        input.setSelectionRange(0, 99999)
        try {
            document.execCommand("copy")
            this.showToast(this.getText("copied", "Copied"))
        } catch {
            this.showToast(this.getText("copy_failed", "Copy failed"))
        }
    },

    triggerImport() {
        const input = document.getElementById("import-file")
        if (!input) return
        input.click()
    },

    updateViewTitle() {
        const title = document.getElementById("view-title")
        if (!title) return
        const { view, folders, activeFolderId } = StateStore.read()
        const dict = LANG[StateStore.read().config.lang] || LANG.ru

        if (view === "favorites") title.textContent = dict.favorites || "Favorites"
        else if (view === "archive") title.textContent = dict.archive || "Archive"
        else if (view === "folders") title.textContent = dict.folders || "Folders"
        else if (view === "folder") {
            const folder = folders.find(f => f.id === activeFolderId)
            title.textContent = folder ? folder.name : (dict.folder || "Folder")
        } else title.textContent = dict.notes || "Notes"
    },

    updatePrimaryActionLabel() {
        const btn = this.els.fab
        if (!btn) return
        const { view } = StateStore.read()
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const label = view === "folders" ? (dict.new_folder || "New folder") : (dict.new_note || "New note")
        btn.setAttribute("aria-label", label)
    },

    primaryAction() {
        const { view } = StateStore.read()
        if (view === "folders") {
            this.showPrompt(this.getText("new_folder", "New folder"), this.getText("folder_name", "Folder name"), async (name) => {
                const n = String(name || "").trim()
                if (!n) return
                await FolderService.create(n)
            })
            return
        }
        Editor.create()
    },

    applyAppearanceSettings() {
        ThemeManager.init()
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
            const count = notes.filter(note => note.folderId === folder.id && !note.isArchived && !(note.lock && note.lock.hidden)).length
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
        if (note.lock && note.lock.hidden) return this.showShareFallback(this.getText("lock_action_denied", "Locked note"))
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

    openModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.add("active")
        this.toggleSidebar(false)

        if (id === "share-modal") {
            const n = StateStore.read().currentNote
            if (!n) return
            if (n.lock && n.lock.hidden) {
                this.showToast(this.getText("lock_action_denied", "Locked note"))
                this.closeModal(id)
                return
            }
            const link = document.getElementById("share-link")
            if (link) link.value = ShareService.makeShareLink(n.id)
        }

        if (id === "collab-modal") {
            const n = StateStore.read().currentNote
            if (!n) return
            if (n.lock && n.lock.hidden) {
                this.showToast(this.getText("lock_action_denied", "Locked note"))
                this.closeModal(id)
                return
            }
            const link = document.getElementById("collab-link")
            if (link) link.value = ShareService.makeCollabLink(n.id)
        }

        if (id === "lock-center-modal") {
            this.renderLockCenter()
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
                            <select id="lang-select" class="field-input">
                                <option value="ru">${dict.lang_ru || "Russian"}</option>
                                <option value="en">${dict.lang_en || "English"}</option>
                            </select>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.folder_view_mode || "Folders view"}</span>
                            <select id="folder-view-select" class="field-input">
                                <option value="full">${dict.folder_view_full || "Grid"}</option>
                                <option value="sidebar">${dict.folder_view_sidebar || "Sidebar"}</option>
                            </select>
                        </div>
                    </div>
                </div>
            `
            const lang = document.getElementById("lang-select")
            if (lang) {
                lang.value = StateStore.read().config.lang || "ru"
                lang.onchange = (e) => {
                    StateActions.setLang(e.target.value)
                    this.renderSettingsPage()
                }
            }
            const folderView = document.getElementById("folder-view-select")
            if (folderView) {
                folderView.value = StateStore.read().config.folderViewMode || "full"
                folderView.onchange = (e) => {
                    StateActions.setFolderViewMode(e.target.value)
                    this.renderFolders()
                    this.renderSettingsPage()
                }
            }
            return
        }

        if (page === "appearance") {
            title.textContent = dict.settings_appearance || dict.appearance || "Appearance"

            root.innerHTML = `
                <div class="settings-group">
                    <div class="field">
                        <span class="field-label">${dict.presets || "Presets"}</span>
                        <div id="appearance-presets" class="settings-theme-grid"></div>
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

                    <div class="settings-actions">
                        <button type="button" class="btn-secondary" data-action="appearance-reset">${dict.reset || "Reset"}</button>
                        <button type="button" class="btn-primary" data-action="appearance-save">${dict.save || "Save"}</button>
                    </div>
                </div>
            `

            this.beginAppearanceDraft()
            this.renderAppearancePresets()
            this.syncAppearanceDraftUI()
            this.bindAppearanceDraftInputs()
            return
        }

        if (page === "editor_tools") {
            title.textContent = dict.settings_editor_tools || dict.editor_tools || "Editor Tools"
            root.innerHTML = `
                <div class="settings-group">
                    <div class="settings-grid">
                        <div class="field">
                            <span class="field-label">${dict.editor_autosave || "Autosave"}</span>
                            <label class="toggle">
                                <input type="checkbox" id="autosave-toggle">
                                <span class="toggle-track"></span>
                            </label>
                        </div>
                    </div>
                </div>
            `
            const auto = document.getElementById("autosave-toggle")
            if (auto) {
                auto.checked = !!StateStore.read().config.autosave
                auto.onchange = (e) => StateActions.setAutosave(!!e.target.checked)
            }
            return
        }
    },

    beginAppearanceDraft() {
        const savedRaw = localStorage.getItem("app-theme-settings")
        let saved = null
        try { saved = savedRaw ? JSON.parse(savedRaw) : null } catch { saved = null }

        const preset = saved && typeof saved.preset === "string" ? saved.preset : null
        if (preset) {
            this.appearanceDraft = { preset }
            return
        }

        const base = ThemeManager.themes?.dark || { p: "#00f2ff", bg: "#050505", t: "#ffffff" }
        const p = saved && typeof saved.p === "string" ? saved.p : base.p
        const bg = saved && typeof saved.bg === "string" ? saved.bg : base.bg
        const t = saved && typeof saved.t === "string" ? saved.t : base.t

        this.appearanceDraft = { preset: "manual", p, bg, t }
    },

    renderAppearancePresets() {
        const root = document.getElementById("appearance-presets")
        if (!root) return
        const dict = LANG[StateStore.read().config.lang] || LANG.ru

        const labels = {
            system: dict.theme_system || "System",
            dark: dict.theme_dark_default || dict.theme_dark || "Dark",
            graphite: dict.theme_graphite || "Graphite",
            neon_cyan: dict.theme_neon_cyan || "Neon Cyan",
            emerald_calm: dict.theme_emerald_calm || "Emerald Calm",
            violet_pulse: dict.theme_violet_pulse || "Violet Pulse",
            ocean_deep: dict.theme_ocean_deep || "Ocean Deep",
            oled_pure: dict.theme_oled_pure || "OLED",
            light: dict.theme_light || "Light",
            manual: dict.theme_manual || dict.manual || "Manual"
        }

        const ordered = ["system", "dark", "graphite", "neon_cyan", "emerald_calm", "violet_pulse", "ocean_deep", "oled_pure", "light", "manual"]

        root.innerHTML = ordered.map(key => {
            const label = labels[key] || key
            return `
                <button type="button" class="theme-dot" data-action="appearance-select-preset" data-preset="${key}" aria-label="${Utils.escapeHtml(label)}">
                    <span class="theme-dot-label">${Utils.escapeHtml(label)}</span>
                </button>
            `
        }).join("")
    },

    syncAppearanceDraftUI() {
        const draft = this.appearanceDraft
        if (!draft) return

        const setVal = (id, val) => {
            const el = document.getElementById(id)
            if (el && typeof val === "string") el.value = val
        }

        const markActive = (preset) => {
            const root = document.getElementById("appearance-presets")
            if (!root) return
            root.querySelectorAll("[data-action='appearance-select-preset']").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.preset === preset)
            })
        }

        const activePreset = draft.preset && draft.preset !== "manual" ? draft.preset : "manual"
        markActive(activePreset)

        const base = ThemeManager.themes?.dark || { p: "#00f2ff", bg: "#050505", t: "#ffffff" }

        if (draft.preset && draft.preset !== "manual") {
            const t = ThemeManager.themes?.[draft.preset]
            if (t && typeof t.p === "string" && typeof t.bg === "string" && typeof t.t === "string") {
                setVal("cp-primary", t.p)
                setVal("cp-bg", t.bg)
                setVal("cp-text", t.t)
                return
            }
            setVal("cp-primary", base.p)
            setVal("cp-bg", base.bg)
            setVal("cp-text", base.t)
            return
        }

        setVal("cp-primary", typeof draft.p === "string" ? draft.p : base.p)
        setVal("cp-bg", typeof draft.bg === "string" ? draft.bg : base.bg)
        setVal("cp-text", typeof draft.t === "string" ? draft.t : base.t)
    },

    bindAppearanceDraftInputs() {
        const bind = (id, key) => {
            const el = document.getElementById(id)
            if (!el) return
            el.oninput = (e) => {
                if (!this.appearanceDraft) this.beginAppearanceDraft()
                const v = String(e.target.value || "")
                this.appearanceDraft.preset = "manual"
                this.appearanceDraft[key] = v
                this.syncAppearanceDraftUI()
            }
        }
        bind("cp-primary", "p")
        bind("cp-bg", "bg")
        bind("cp-text", "t")
    },

    applyAppearanceDraft() {
        const draft = this.appearanceDraft
        if (!draft) return

        if (draft.preset && draft.preset !== "manual") {
            ThemeManager.applyPreset(draft.preset)
            return
        }

        const base = ThemeManager.themes?.dark || { p: "#00f2ff", bg: "#050505", t: "#ffffff" }
        const p = typeof draft.p === "string" ? draft.p : base.p
        const bg = typeof draft.bg === "string" ? draft.bg : base.bg
        const t = typeof draft.t === "string" ? draft.t : base.t
        ThemeManager.setManual(p, bg, t)
    },

    resetAppearanceDraft() {
        this.appearanceDraft = { preset: "dark" }
        this.syncAppearanceDraftUI()
    },

    async renderLockCenter() {
        const modal = document.getElementById("lock-center-modal")
        if (!modal) return

        const body = modal.querySelector(".modal-body")
        if (!body) return

        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const notes = typeof window.getLockedNotes === "function" ? window.getLockedNotes() : []

        const randWord = () => {
            const chars = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
            const len = 3 + Math.floor(Math.random() * 8)
            let s = ""
            for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length))
            return s
        }

        const randText = () => {
            const parts = 10 + Math.floor(Math.random() * 30)
            const arr = []
            for (let i = 0; i < parts; i++) arr.push(randWord())
            return arr.join(" ")
        }

        const folders = StateStore.read().folders || []

        const folderNameById = (id) => {
            const f = folders.find(x => x.id === id)
            return f ? f.name : ""
        }

        body.innerHTML = `
            <div class="lock-center-wrapper">
                <p class="muted">${Utils.escapeHtml(dict.lock_center_desc || "Protected notes are stored here")}</p>
                <div id="lock-center-list" class="lock-center-list"></div>
            </div>
        `

        const list = body.querySelector("#lock-center-list")
        if (!list) return

        if (!notes.length) {
            list.innerHTML = `<div class="empty-placeholder"><p>${Utils.escapeHtml(dict.empty || "Empty")}</p></div>`
            return
        }

        list.innerHTML = notes.map(n => {
            const folderName = n.folderId ? folderNameById(n.folderId) : ""
            const folderLabel = folderName ? Utils.escapeHtml(folderName) : ""
            return `
                <div class="lock-note-card" data-note-id="${encodeURIComponent(n.id)}">
                    <div class="lock-note-top">
                        <div class="lock-note-title" style="filter: blur(8px); user-select:none;">${Utils.escapeHtml(randText())}</div>
                        <div class="lock-note-meta">${folderLabel}</div>
                    </div>
                    <div class="lock-note-body" style="filter: blur(10px); user-select:none;">${Utils.escapeHtml(randText())}</div>
                    <div class="lock-note-actions">
                        <button type="button" class="btn-icon" data-action="lock-meta-pin" data-note-id="${encodeURIComponent(n.id)}" aria-label="Pin">
                            <i class="material-icons-round" aria-hidden="true">push_pin</i>
                        </button>
                        <button type="button" class="btn-icon" data-action="lock-meta-fav" data-note-id="${encodeURIComponent(n.id)}" aria-label="Fav">
                            <i class="material-icons-round" aria-hidden="true">star</i>
                        </button>
                        <button type="button" class="btn-icon" data-action="lock-meta-archive" data-note-id="${encodeURIComponent(n.id)}" aria-label="Archive">
                            <i class="material-icons-round" aria-hidden="true">archive</i>
                        </button>
                        <button type="button" class="btn-icon" data-action="lock-meta-move" data-note-id="${encodeURIComponent(n.id)}" aria-label="Move">
                            <i class="material-icons-round" aria-hidden="true">folder</i>
                        </button>
                        <button type="button" class="btn-primary" data-action="lock-open" data-note-id="${encodeURIComponent(n.id)}">${Utils.escapeHtml(dict.open || "Open")}</button>
                    </div>
                </div>
            `
        }).join("")
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
        if (note.lock && note.lock.hidden) {
            this.showToast(this.getText("lock_action_denied", "Locked note"))
            this.closeModal("note-actions-modal")
            return
        }
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
        if (note.lock && note.lock.hidden) {
            this.showToast(this.getText("lock_action_denied", "Locked note"))
            this.closeModal("note-actions-modal")
            return
        }
        DriveService.uploadNote(note)
        this.closeModal("note-actions-modal")
    }
}
