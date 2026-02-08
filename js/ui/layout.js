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
})
