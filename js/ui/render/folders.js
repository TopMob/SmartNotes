Object.assign(UI, {
    updateNavigationActiveState() {
        const stateSnapshot = StateStore.read()
        document.querySelectorAll(".nav-item").forEach(buttonElement => {
            const buttonView = buttonElement.dataset.view
            const buttonFolderId = buttonElement.dataset.folderId
            let isActive = false
            if (buttonView) {
                isActive = stateSnapshot.view === buttonView
            } else if (buttonFolderId) {
                isActive = stateSnapshot.view === "folder" && stateSnapshot.activeFolderId === buttonFolderId
            }
            buttonElement.classList.toggle("active", isActive)
        })
    },

    updateEmptyState(icon, text) {
        const iconElement = this.els.empty.querySelector("i")
        const textElement = this.els.empty.querySelector("p")
        if (iconElement) window.DomSecurity.setText(iconElement, icon)
        if (textElement) window.DomSecurity.setText(textElement, text)
    },

    createFolderNavigationButton(folder, isActive) {
        const safeFolderId = window.DomSecurity.sanitizeIdentifier(folder?.id)
        if (!safeFolderId) return null
        const folderButton = document.createElement("button")
        folderButton.type = "button"
        folderButton.className = "nav-item"
        if (isActive) folderButton.classList.add("active")
        folderButton.dataset.action = "open-folder"
        folderButton.dataset.folderId = safeFolderId
        folderButton.draggable = true
        folderButton.dataset.folderDraggable = "true"

        const iconElement = document.createElement("i")
        iconElement.className = "material-icons-round"
        iconElement.setAttribute("aria-hidden", "true")
        window.DomSecurity.setText(iconElement, "folder")

        const nameElement = document.createElement("span")
        window.DomSecurity.setText(nameElement, window.DomSecurity.sanitizeInputValue(folder?.name))

        const folderDescription = window.DomSecurity.sanitizeInputValue(folder?.description)
        if (folderDescription) folderButton.title = folderDescription

        folderButton.append(iconElement, nameElement)
        return folderButton
    },

    renderFolders() {
        const root = this.els.folderList
        if (!root) return
        const hideList = StateStore.read().config.folderViewMode === "full"
        const title = document.querySelector('.nav-title[data-lang="folders"]')
        if (title) title.classList.toggle("hidden", hideList)
        root.classList.toggle("hidden", hideList)
        if (hideList) {
            root.replaceChildren()
            return
        }
        const { folders, activeFolderId } = StateStore.read()
        const visibleFolders = folders
            .filter(folder => !folder.isHidden && !folder.trashedAt)
            .sort((firstFolder, secondFolder) => (firstFolder.folderOrder || 0) - (secondFolder.folderOrder || 0))

        const fragment = document.createDocumentFragment()
        visibleFolders.forEach(folder => {
            const folderButton = this.createFolderNavigationButton(folder, activeFolderId === folder.id)
            if (folderButton) fragment.append(folderButton)
        })
        root.replaceChildren(fragment)
        this.updateNavigationActiveState()
        this.renderFilterMenu()
        this.updateFolderLimitControls()
        this.updateAdminToolsNavigationVisibility()
    },

    createHiddenFolderCard(folder) {
        const safeFolderId = window.DomSecurity.sanitizeIdentifier(folder?.id)
        if (!safeFolderId) return null

        const folderCard = document.createElement("div")
        folderCard.className = "folder-card"

        const titleElement = document.createElement("div")
        titleElement.className = "folder-title"
        window.DomSecurity.setText(titleElement, window.DomSecurity.sanitizeInputValue(folder?.name))

        const metaElement = document.createElement("div")
        metaElement.className = "folder-meta"
        window.DomSecurity.setText(metaElement, this.getText("hidden_folder_label", "Hidden folder"))

        const actionsRow = document.createElement("div")
        actionsRow.className = "row-left"

        const openButton = document.createElement("button")
        openButton.type = "button"
        openButton.className = "btn-secondary"
        openButton.dataset.action = "open-folder"
        openButton.dataset.folderId = safeFolderId
        window.DomSecurity.setText(openButton, this.getText("open", "Open"))

        const unhideButton = document.createElement("button")
        unhideButton.type = "button"
        unhideButton.className = "btn-secondary"
        unhideButton.dataset.action = "folder-unhide"
        unhideButton.dataset.folderId = safeFolderId
        window.DomSecurity.setText(unhideButton, this.getText("show_folder", "Show folder"))

        actionsRow.append(openButton, unhideButton)
        folderCard.append(titleElement, metaElement, actionsRow)
        return folderCard
    },

    renderHiddenFolders() {
        this.updateEmptyState("visibility_off", this.getText("hidden_folders_empty", "No hidden folders"))
        const { folders } = StateStore.read()
        const hiddenFolders = folders.filter(folder => !!folder.isHidden && !folder.trashedAt)
        this.els.empty.classList.toggle("hidden", hiddenFolders.length > 0)
        this.els.grid.classList.add("folder-grid")

        const fragment = document.createDocumentFragment()
        hiddenFolders.forEach(folder => {
            const folderCard = this.createHiddenFolderCard(folder)
            if (folderCard) fragment.append(folderCard)
        })
        this.els.grid.replaceChildren(fragment)
    },

    createTrashedFolderCard(folder) {
        const safeFolderId = window.DomSecurity.sanitizeIdentifier(folder?.id)
        if (!safeFolderId) return null

        const noteCard = document.createElement("div")
        noteCard.className = "note-card trashed-folder-card"

        const cardHead = document.createElement("div")
        cardHead.className = "trashed-folder-card-head"

        const badge = document.createElement("span")
        badge.className = "trashed-folder-badge"

        const badgeIcon = document.createElement("i")
        badgeIcon.className = "material-icons-round"
        badgeIcon.setAttribute("aria-hidden", "true")
        window.DomSecurity.setText(badgeIcon, "folder")

        const badgeText = document.createElement("span")
        window.DomSecurity.setText(badgeText, this.getText("folders", "Folders"))

        badge.append(badgeIcon, badgeText)
        cardHead.append(badge)

        const title = document.createElement("h3")
        window.DomSecurity.setText(title, window.DomSecurity.sanitizeInputValue(folder?.name))

        const subtitle = document.createElement("p")
        window.DomSecurity.setText(subtitle, this.getText("folder_trashed", "Folder in trash"))

        const actionsRow = document.createElement("div")
        actionsRow.className = "row-left"

        const restoreButton = document.createElement("button")
        restoreButton.type = "button"
        restoreButton.className = "btn-secondary"
        restoreButton.dataset.action = "folder-restore"
        restoreButton.dataset.folderId = safeFolderId
        window.DomSecurity.setText(restoreButton, this.getText("restore_note", "Restore"))

        const permanentDeleteButton = document.createElement("button")
        permanentDeleteButton.type = "button"
        permanentDeleteButton.className = "btn-danger"
        permanentDeleteButton.dataset.action = "folder-delete-permanent"
        permanentDeleteButton.dataset.folderId = safeFolderId
        window.DomSecurity.setText(permanentDeleteButton, this.getText("delete_permanently", "Delete permanently"))

        actionsRow.append(restoreButton, permanentDeleteButton)
        noteCard.append(cardHead, title, subtitle, actionsRow)
        return noteCard
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

        const foldersFragment = document.createDocumentFragment()
        trashedFolders.forEach(folder => {
            const folderCard = this.createTrashedFolderCard(folder)
            if (folderCard) foldersFragment.append(folderCard)
        })

        if (!hasNotes) {
            this.els.grid.replaceChildren(foldersFragment)
            return
        }

        NotesRenderer.render(trashedNotes)
        requestAnimationFrame(() => {
            this.els.grid.prepend(foldersFragment)
        })
    },

    createFolderOverviewCard(folder, notes) {
        const safeFolderId = window.DomSecurity.sanitizeIdentifier(folder?.id)
        if (!safeFolderId) return null
        const folderCard = document.createElement("div")
        folderCard.className = "folder-card"
        folderCard.dataset.action = "open-folder"
        folderCard.dataset.folderId = safeFolderId

        const titleElement = document.createElement("div")
        titleElement.className = "folder-title"
        window.DomSecurity.setText(titleElement, window.DomSecurity.sanitizeInputValue(folder?.name))

        const noteCount = notes.filter(note => note.folderId === folder.id && !note.trashedAt).length
        const label = noteCount === 1 ? this.getText("note_single", "note") : this.getText("note_plural", "notes")

        const metaElement = document.createElement("div")
        metaElement.className = "folder-meta"
        window.DomSecurity.setText(metaElement, `${noteCount} ${label}`)

        folderCard.append(titleElement, metaElement)

        const folderDescription = window.DomSecurity.sanitizeInputValue(folder?.description)
        if (folderDescription) {
            const descriptionElement = document.createElement("p")
            descriptionElement.className = "folder-description-preview"
            window.DomSecurity.setText(descriptionElement, folderDescription)
            const shouldShowExpandButton = folderDescription.length > 140
            if (shouldShowExpandButton) {
                const expandButton = document.createElement("button")
                expandButton.type = "button"
                expandButton.className = "folder-description-more"
                expandButton.dataset.action = "toggle-folder-description"
                expandButton.setAttribute("aria-expanded", "false")
                window.DomSecurity.setText(expandButton, this.getText("show_more", "Ещё"))
                folderCard.append(descriptionElement, expandButton)
            } else {
                folderCard.append(descriptionElement)
            }
        }
        return folderCard
    },

    renderFolderGrid() {
        this.updateEmptyState("folder_open", this.getText("folders_empty", "No folders yet"))
        const { folders, notes } = StateStore.read()
        const visibleFolders = folders.filter(folder => !folder.trashedAt && !folder.isHidden)
        this.els.empty.classList.toggle("hidden", visibleFolders.length > 0)
        this.els.grid.classList.add("folder-grid")

        const fragment = document.createDocumentFragment()
        visibleFolders.forEach(folder => {
            const folderCard = this.createFolderOverviewCard(folder, notes)
            if (folderCard) fragment.append(folderCard)
        })

        this.els.grid.replaceChildren(fragment)
        this.updateFolderLimitControls()
    }
})
