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
                <span class="folder-action-group">
                    <i class="material-icons-round folder-action" data-action="toggle-folder-hidden" data-folder-id="${folder.id}" aria-hidden="true">visibility_off</i>
                    <i class="material-icons-round folder-action" data-action="delete-folder" data-folder-id="${folder.id}" aria-hidden="true">close</i>
                </span>
            </button>
        `).join("")
        this.renderFilterMenu()
    },

    renderFolderGrid() {
        this.updateEmptyState("folder_open", this.getText("folders_empty", "No folders yet"))
        const { folders, notes } = StateStore.read()
        const visibleFolders = folders.filter(folder => !folder.trashedAt)
        this.els.empty.classList.toggle("hidden", visibleFolders.length > 0)
        this.els.grid.classList.add("folder-grid")
        this.els.grid.innerHTML = visibleFolders.map(folder => {
            const count = notes.filter(note => note.folderId === folder.id && !note.isArchived && !note.trashedAt).length
            const label = count === 1 ? this.getText("note_single", "note") : this.getText("note_plural", "notes")
            return `<div class="folder-card" data-action="open-folder" data-folder-id="${folder.id}"><div class="folder-title">${Utils.escapeHtml(folder.name)}</div><div class="folder-meta">${count} ${label}</div></div>`
        }).join("")
    }
})
