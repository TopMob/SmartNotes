Object.assign(UI, {
    updateEmptyState(icon, text) {
        const iconElement = this.els.empty.querySelector("i")
        const textElement = this.els.empty.querySelector("p")
        if (iconElement) iconElement.textContent = icon
        if (textElement) textElement.textContent = text
    },

    renderFolders() {
        const root = this.els.folderList
        if (!root) return
        const hideList = StateStore.read().config.folderViewMode === "full"
        const title = document.querySelector('.nav-title[data-lang="folders"]')
        if (title) title.classList.toggle("hidden", hideList)
        root.classList.toggle("hidden", hideList)
        if (hideList) {
            root.innerHTML = ""
            return
        }
        const { folders, activeFolderId } = StateStore.read()
        const visibleFolders = folders.filter(folder => !folder.isHidden && !folder.trashedAt).sort((a, b) => (a.folderOrder || 0) - (b.folderOrder || 0))
        root.innerHTML = visibleFolders.map(folder => `
            <button type="button" class="nav-item ${activeFolderId === folder.id ? "active" : ""}" data-action="open-folder" data-folder-id="${folder.id}" draggable="true" data-folder-draggable="true">
                <i class="material-icons-round" aria-hidden="true">folder</i>
                <span>${Utils.escapeHtml(folder.name)}</span>
            </button>
        `).join("")
        this.renderFilterMenu()
    },


    renderHiddenFolders() {
        this.updateEmptyState("visibility_off", "Скрытых папок нет")
        const { folders } = StateStore.read()
        const hiddenFolders = folders.filter(folder => !!folder.isHidden && !folder.trashedAt)
        this.els.empty.classList.toggle("hidden", hiddenFolders.length > 0)
        this.els.grid.classList.add("folder-grid")
        this.els.grid.innerHTML = hiddenFolders.map(folder => `
            <div class="folder-card">
                <div class="folder-title">${Utils.escapeHtml(folder.name)}</div>
                <div class="folder-meta">Скрытая папка</div>
                <div class="row-left">
                    <button type="button" class="btn-secondary" data-action="open-folder" data-folder-id="${folder.id}">Открыть</button>
                    <button type="button" class="btn-secondary" data-action="folder-unhide" data-folder-id="${folder.id}">${this.getText("show_folder", "Show folder")}</button>
                </div>
            </div>
        `).join("")
    },


    renderTrash(trashedNotes) {
        const { folders } = StateStore.read()
        const trashedFolders = folders.filter(folder => !!folder.trashedAt)
        const hasNotes = Array.isArray(trashedNotes) && trashedNotes.length > 0
        const hasFolders = trashedFolders.length > 0
        this.els.empty.classList.toggle("hidden", hasNotes || hasFolders)
        this.els.grid.classList.remove("folder-grid")
        if (!hasFolders) {
            NotesRenderer.render(trashedNotes)
            return
        }
        const foldersMarkup = trashedFolders.map(folder => `
            <div class="note-card trashed-folder-card">
                <h3>${Utils.escapeHtml(folder.name)}</h3>
                <p>${this.getText("folder_trashed", "Folder in trash")}</p>
                <div class="row-left">
                    <button type="button" class="btn-secondary" data-action="folder-restore" data-folder-id="${folder.id}">${this.getText("restore_note", "Restore")}</button>
                    <button type="button" class="btn-danger" data-action="folder-delete-permanent" data-folder-id="${folder.id}">${this.getText("delete_permanently", "Delete permanently")}</button>
                </div>
            </div>
        `).join("")
        if (!hasNotes) {
            this.els.grid.innerHTML = foldersMarkup
            return
        }
        NotesRenderer.render(trashedNotes)
        this.els.grid.insertAdjacentHTML("afterbegin", foldersMarkup)
    },

    renderFolderGrid() {
        this.updateEmptyState("folder_open", this.getText("folders_empty", "No folders yet"))
        const { folders, notes } = StateStore.read()
        const visibleFolders = folders.filter(folder => !folder.trashedAt && !folder.isHidden)
        this.els.empty.classList.toggle("hidden", visibleFolders.length > 0)
        this.els.grid.classList.add("folder-grid")
        this.els.grid.innerHTML = visibleFolders.map(folder => {
            const count = notes.filter(note => note.folderId === folder.id && !note.isArchived && !note.trashedAt).length
            const label = count === 1 ? this.getText("note_single", "note") : this.getText("note_plural", "notes")
            return `<div class="folder-card" data-action="open-folder" data-folder-id="${folder.id}"><div class="folder-title">${Utils.escapeHtml(folder.name)}</div><div class="folder-meta">${count} ${label}</div></div>`
        }).join("")
    }
})
