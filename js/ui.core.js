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
            folderList: document.getElementById("folder-list-root"),
            sidebarOverlay: document.getElementById("sidebar-overlay"),
            filterMenu: document.getElementById("notes-filter-menu"),
            filterButton: document.getElementById("notes-filter-toggle"),
            filterFolders: document.getElementById("notes-folder-filters"),
            filterSort: document.getElementById("notes-sort-select")
        }
        this.bindEvents()
        if (window.matchMedia("(min-width: 1024px)").matches) {
            this.els.sidebar?.classList.add("active")
        }
        this.updateSidebarLayout()
        window.addEventListener("resize", () => this.updateSidebarLayout())
        this.applyAppearanceSettings()
        this.renderFilterMenu()
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
        this.renderFilterMenu()
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

            const isDesktop = window.matchMedia("(min-width: 1024px)").matches
            if (!isDesktop && this.els.sidebar?.classList.contains("active") && !this.els.sidebar.contains(e.target) && !e.target.closest("#menu-toggle")) {
                this.toggleSidebar(false)
            }
            if (this.els.userMenu?.classList.contains("active") && !e.target.closest(".user-avatar-wrapper")) {
                this.toggleUserMenu(false)
            }
            if (this.els.filterMenu?.classList.contains("active") && !e.target.closest("#notes-filter-menu") && !e.target.closest("#notes-filter-toggle")) {
                this.toggleFilterMenu(false)
            }

            const overlay = e.target.closest(".modal-overlay")
            if (overlay && e.target === overlay && !overlay.dataset.modalStatic) {
                this.closeModal(overlay.id)
            }
        })

        if (this.els.sidebarOverlay) {
            this.els.sidebarOverlay.addEventListener("click", () => this.toggleSidebar(false))
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.els.sidebar?.classList.contains("active")) {
                this.toggleSidebar(false)
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

        if (this.els.filterSort) {
            this.els.filterSort.addEventListener("change", (e) => {
                this.updateFilterConfig({ sort: e.target.value })
            })
        }

        if (this.els.filterFolders) {
            this.els.filterFolders.addEventListener("change", (e) => {
                const input = e.target.closest("input[type='checkbox']")
                if (!input) return
                const selected = this.readFolderFilterSelection()
                this.updateFilterConfig({ folders: selected })
            })
        }

        this.els.grid?.addEventListener("click", async (e) => {
            const action = e.target.closest(".action-btn")
            if (action) return
            if (this.els.userMenu?.classList.contains("active")) return
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

    readFolderFilterSelection() {
        const selected = []
        this.els.filterFolders?.querySelectorAll("input[type='checkbox']").forEach(input => {
            if (input.checked) selected.push(input.value)
        })
        return selected
    },

    updateFilterConfig(next) {
        const current = StateStore.read().config.notesFilter || { sort: "manual", folders: [] }
        const updated = { ...current, ...next }
        StateActions.updateConfig({ notesFilter: updated })
        localStorage.setItem("notes-filter", JSON.stringify(updated))
        filterAndRender(document.getElementById("search-input")?.value || "")
        this.renderFilterMenu()
    },

    renderFilterMenu() {
        if (!this.els.filterFolders || !this.els.filterSort) return
        const { folders, config } = StateStore.read()
        const current = config.notesFilter || { sort: "manual", folders: [] }
        this.els.filterSort.value = current.sort || "updated"
        const items = []
        items.push({ id: "none", name: this.getText("folder_none", "No folder") })
        folders.forEach(folder => items.push({ id: folder.id, name: folder.name }))
        this.els.filterFolders.innerHTML = items.map(item => {
            const checked = current.folders?.includes(item.id) ? "checked" : ""
            return `
                <label class="filter-option">
                    <input type="checkbox" value="${item.id}" ${checked}>
                    <span>${Utils.escapeHtml(item.name || "")}</span>
                </label>
            `
        }).join("")
    },

    toggleFilterMenu(force) {
        const menu = this.els.filterMenu
        if (!menu) return
        const next = typeof force === "boolean" ? force : !menu.classList.contains("active")
        menu.classList.toggle("active", next)
        if (next && this.els.filterButton) {
            const rect = this.els.filterButton.getBoundingClientRect()
            menu.style.top = `${rect.bottom + 10}px`
            menu.style.left = `${Math.max(10, Math.min(window.innerWidth - menu.offsetWidth - 10, rect.right - menu.offsetWidth))}px`
        }
    },

    handleAction(el, e) {
        const action = el.dataset.action
        if (!action) return

        const stopFor = new Set(["note-pin", "note-favorite", "note-menu", "delete-folder", "rename-active-folder"])
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
            case "create-folder":
                this.createFolder()
                break
            case "rename-active-folder":
                this.renameFolder(StateStore.read().activeFolderId)
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
                this.confirm("account", () => Auth.switchAccount())
                break
            case "logout":
                this.confirm("exit", () => Auth.logout())
                break
            case "trigger-import":
                this.triggerImport()
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
            case "editor-lock":
                Editor.toggleLock()
                break
            case "editor-save":
                Editor.save()
                break
            case "editor-prev-page":
                Editor.prevPage()
                break
            case "editor-next-page":
                Editor.nextPage()
                break
            case "editor-add-page":
                Editor.addPage()
                break
            case "editor-voice":
                Editor.toggleRecording()
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
            case "note-pin-toggle":
                this.toggleSelectedPin(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-archive":
                this.toggleSelectedArchive(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-delete":
                deleteNoteById(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-share":
                this.openShareModal(decodeURIComponent(el.dataset.noteId || ""))
                this.closeModal("note-actions-modal")
                break
            case "note-collab":
                this.openCollabModal(decodeURIComponent(el.dataset.noteId || ""))
                this.closeModal("note-actions-modal")
                break
            case "note-copy-text":
                copyNoteTextById(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-future-set":
                scheduleFutureNote(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-future-clear":
                clearFutureNote(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-move-folder":
                this.moveSelectedNoteToFolder(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "download-note":
                this.downloadSelectedNote()
                break
            case "upload-note":
                this.uploadSelectedNote()
                break
            case "lock-pin":
                this.toggleLockPin(el.dataset.noteId || "")
                break
            case "lock-archive":
                this.toggleLockArchive(el.dataset.noteId || "")
                break
            case "lock-unhide":
                this.unlockLockedNote(el.dataset.noteId || "")
                break
            case "lock-remove":
                this.removeLockPermanently(el.dataset.noteId || "")
                break
            case "lock-move-folder":
                this.moveLockNoteToFolder(el.dataset.noteId || "")
                break
            case "appearance-reset":
                this.resetAppearanceDraft()
                break
            case "appearance-save":
                this.saveAppearanceDraft()
                break
            case "toggle-filter-menu":
                this.toggleFilterMenu()
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
            case "media-delete":
                Editor.deleteSelectedMedia()
                break
            case "editor-align":
                Editor.alignMediaOrText(el.dataset.align)
                break
            case "inline-sketch-undo":
                Editor.undoInlineSketch()
                break
            case "inline-sketch-clear":
                Editor.clearInlineSketch()
                break
            case "inline-sketch-cancel":
                Editor.cancelInlineSketch()
                break
            case "inline-sketch-apply":
                Editor.applyInlineSketch()
                break
            case "share-note-native":
                this.shareCurrentNoteNative()
                break
            case "copy-share-text":
                this.copyShareText()
                break
            case "collab-enable":
                this.enableCollaboration()
                break
            case "survey-next":
                this.advanceSurvey()
                break
            case "survey-prev":
                this.goBackSurvey()
                break
            case "survey-continue":
                this.continueSurvey()
                break
            case "survey-finish":
                this.finishSurvey()
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

    updateSidebarLayout() {
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches
        const isActive = this.els.sidebar?.classList.contains("active")
        if (this.els.sidebar) {
            this.els.sidebar.classList.toggle("collapsed", isDesktop && !isActive)
        }
        if (this.els.sidebarOverlay) {
            this.els.sidebarOverlay.classList.toggle("active", !!isActive && !isDesktop)
        }
    },

    toggleSidebar(force) {
        if (!this.els.sidebar) return
        const next = typeof force === "boolean" ? force : !this.els.sidebar.classList.contains("active")
        this.els.sidebar.classList.toggle("active", next)
        this.updateSidebarLayout()
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
            this.createFolder()
            return
        }
        Editor.open()
    },

    createFolder() {
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
    },

    renameFolder(folderId) {
        const id = String(folderId || "")
        if (!id) return
        const folder = StateStore.read().folders.find(f => f.id === id)
        if (!folder) return
        this.showPrompt(this.getText("rename_folder", "Rename folder"), this.getText("folder_placeholder", "Folder name"), async (name) => {
            const trimmed = String(name || "").trim()
            if (!trimmed) return this.showToast(this.getText("folder_empty", "Enter a folder name"))
            if (trimmed.toLowerCase() === String(folder.name || "").toLowerCase()) return
            if (StateStore.read().folders.some(f => f.id !== id && f.name && f.name.toLowerCase() === trimmed.toLowerCase())) {
                return this.showToast(this.getText("folder_exists", "Folder already exists"))
            }
            if (!db || !StateStore.read().user) return
            await db.collection("users").doc(StateStore.read().user.uid).collection("folders").doc(id).update({
                name: trimmed
            })
        }, String(folder.name || ""))
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
            future: dict.view_future || "Future",
            folder: dict.view_folder || "Folder",
            folders: dict.view_folders || "Folders",
            locked: dict.view_locked || dict.lock_center || "Note Protection"
        }
        const { view, activeFolderId, folders } = StateStore.read()
        let title = titles[view] || "SmartNotes"
        if (view === "folder" && activeFolderId) {
            const folder = folders.find(f => f.id === activeFolderId)
            if (folder) title = folder.name
        }
        const el = document.getElementById("current-view-title")
        if (el) el.textContent = title
        this.updateFolderRenameButton()
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return
        const label = StateStore.read().view === "folders" ? this.getText("create_folder", "Create folder") : this.getText("create_note", "Create note")
        this.els.fab.setAttribute("aria-label", label)
        this.updateFolderRenameButton()
    },

    updateFolderRenameButton() {
        const button = document.getElementById("rename-folder-button")
        if (!button) return
        const { view, activeFolderId } = StateStore.read()
        const isVisible = view === "folder" && !!activeFolderId
        button.classList.toggle("hidden", !isVisible)
    }
}
