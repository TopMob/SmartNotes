Object.assign(UI, {
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
        const title = document.querySelector('.nav-title[data-lang="folders"]')
        if (title) title.classList.toggle("hidden", hideList)
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
                <span class="folder-action-group">
                    <i class="material-icons-round folder-action" data-action="delete-folder" data-folder-id="${f.id}" aria-hidden="true">close</i>
                </span>
            </button>
        `).join("")
        this.renderFilterMenu()
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
    }
})
