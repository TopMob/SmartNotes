Object.assign(UI, {
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
                    n.ownerUid = StateStore.read().user.uid

                    const current = StateStore.read()
                    if (current.notes.some(x => x.id === n.id)) n.id = Utils.generateId()
                    if (n.folderId && !current.folders.find(f => f.id === n.folderId)) n.folderId = null
                    const ref = DataPath.getUserNotesCollection(current.user).doc(n.id)
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
        window.SmartNotesEditor?.open()
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
            await DataPath.getUserFoldersCollection(StateStore.read().user).add({
                name: trimmed,
                isHidden: false,
                trashedAt: null,
                folderOrder: Date.now(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                ownerUid: StateStore.read().user.uid
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
            await DataPath.getUserFoldersCollection(StateStore.read().user).doc(id).update({
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
            reminders: dict.view_future || "Reminders",
            trash: dict.trash || "Trash",
            folder: dict.view_folder || "Folder",
            folders: dict.view_folders || "Folders",
            locked: dict.view_locked || dict.lock_center || "Note Protection",
            hidden_folders: "Скрытые папки"
        }
        const { view, activeFolderId, folders } = StateStore.read()
        let title = titles[view] || "SmartNotes"
        if (view === "folder" && activeFolderId) {
            const folder = folders.find(f => f.id === activeFolderId)
            if (folder) title = folder.name
        }
        const el = document.getElementById("current-view-title")
        if (el) el.textContent = title
        this.updateActiveFolderMenu()
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return
        const label = StateStore.read().view === "folders" ? this.getText("create_folder", "Create folder") : this.getText("create_note", "Create note")
        this.els.fab.setAttribute("aria-label", label)
        this.updateActiveFolderMenu()
    },


    async setFolderHidden(folderId, hiddenState) {
        const user = StateStore.read().user
        if (!db || !user || !folderId) return
        await DataPath.getUserFoldersCollection(user).doc(folderId).update({ isHidden: !!hiddenState })
    },

    async toggleFolderHidden(folderId, options = {}) {
        const folder = StateStore.read().folders.find(item => item.id === folderId)
        if (!folder) return
        const nextHiddenState = !folder.isHidden
        if (nextHiddenState && !options.skipConfirmation) {
            this.confirm("hide_f", () => this.setFolderHidden(folderId, true))
            return
        }
        await this.setFolderHidden(folderId, nextHiddenState)
    },

    async reorderFolders(draggedFolderId, targetFolderId) {
        const user = StateStore.read().user
        if (!db || !user || !draggedFolderId || !targetFolderId || draggedFolderId === targetFolderId) return
        const folders = StateStore.read().folders.filter(folder => !folder.trashedAt).sort((a, b) => (a.folderOrder || 0) - (b.folderOrder || 0))
        const fromIndex = folders.findIndex(folder => folder.id === draggedFolderId)
        const toIndex = folders.findIndex(folder => folder.id === targetFolderId)
        if (fromIndex < 0 || toIndex < 0) return
        const reordered = folders.slice()
        const [dragged] = reordered.splice(fromIndex, 1)
        reordered.splice(toIndex, 0, dragged)
        const batch = db.batch()
        reordered.forEach((folder, index) => {
            const ref = DataPath.getUserFoldersCollection(user).doc(folder.id)
            batch.update(ref, { folderOrder: index + 1 })
        })
        await batch.commit()
    },
    toggleActiveFolderMenu(force) {
        const menu = this.els.activeFolderMenu
        if (!menu) return
        menu.classList.toggle("active", typeof force === "boolean" ? force : !menu.classList.contains("active"))
    },

    updateActiveFolderMenu() {
        const wrapper = this.els.activeFolderMenuWrapper
        const hideLabel = this.els.activeFolderHideButton?.querySelector("span")
        const hideIcon = this.els.activeFolderHideButton?.querySelector("i")
        if (!wrapper) return
        const { view, activeFolderId, folders } = StateStore.read()
        const isVisible = view === "folder" && !!activeFolderId
        wrapper.classList.toggle("hidden", !isVisible)
        if (!isVisible) {
            this.toggleActiveFolderMenu(false)
            return
        }
        const folder = folders.find(item => item.id === activeFolderId)
        if (!folder) return
        if (hideLabel) hideLabel.textContent = folder.isHidden ? this.getText("show_folder", "Show folder") : this.getText("hide_folder", "Hide folder")
        if (hideIcon) hideIcon.textContent = folder.isHidden ? "visibility" : "visibility_off"
    }
})
