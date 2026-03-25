Object.assign(UI, {
    createSharedWorkspaceCard(workspace) {
        const safeWorkspaceId = window.DomSecurity.sanitizeIdentifier(workspace?.id)
        if (!safeWorkspaceId) return null
        const card = document.createElement("div")
        card.className = "folder-card"

        const title = document.createElement("div")
        title.className = "folder-title"
        window.DomSecurity.setText(title, window.DomSecurity.sanitizeInputValue(workspace?.name || this.getText("shared_workspace_default", "Совместная папка")))

        const meta = document.createElement("div")
        meta.className = "folder-meta"
        const roleLabel = workspace.role === "owner"
            ? this.getText("shared_role_owner", "Владелец")
            : (workspace.role === "editor" ? this.getText("shared_role_editor", "Редактор") : this.getText("shared_role_viewer", "Читатель"))
        window.DomSecurity.setText(meta, roleLabel)

        const actions = document.createElement("div")
        actions.className = "row-left"

        const openButton = document.createElement("button")
        openButton.type = "button"
        openButton.className = "btn-primary"
        openButton.dataset.action = "open-shared-workspace"
        openButton.dataset.workspaceId = safeWorkspaceId
        window.DomSecurity.setText(openButton, this.getText("open", "Open"))

        const inviteButton = document.createElement("button")
        inviteButton.type = "button"
        inviteButton.className = "btn-secondary"
        inviteButton.dataset.action = "copy-shared-workspace-link"
        inviteButton.dataset.workspaceId = safeWorkspaceId
        inviteButton.disabled = workspace.role !== "owner"
        window.DomSecurity.setText(inviteButton, this.getText("shared_copy_link", "Скопировать ссылку"))

        const addUserButton = document.createElement("button")
        addUserButton.type = "button"
        addUserButton.className = "btn-secondary"
        addUserButton.dataset.action = "add-shared-workspace-user"
        addUserButton.dataset.workspaceId = safeWorkspaceId
        addUserButton.disabled = workspace.role !== "owner"
        window.DomSecurity.setText(addUserButton, this.getText("shared_add_user", "Добавить пользователя"))

        actions.append(openButton, inviteButton, addUserButton)
        card.append(title, meta, actions)
        return card
    },

    createJoinWorkspaceCard() {
        const card = document.createElement("div")
        card.className = "folder-card"
        const title = document.createElement("div")
        title.className = "folder-title"
        window.DomSecurity.setText(title, this.getText("join_shared_workspace", "Присоединиться по ссылке"))
        const actions = document.createElement("div")
        actions.className = "row-left"
        const joinButton = document.createElement("button")
        joinButton.type = "button"
        joinButton.className = "btn-secondary"
        joinButton.dataset.action = "join-shared-workspace-link"
        window.DomSecurity.setText(joinButton, this.getText("join_shared_workspace", "Присоединиться по ссылке"))
        actions.append(joinButton)
        card.append(title, actions)
        return card
    },

    renderSharedAccessView() {
        this.updateEmptyState("groups", this.getText("shared_access_empty", "У вас пока нет совместных папок"))
        const workspaces = Array.isArray(StateStore.read().sharedWorkspaces) ? StateStore.read().sharedWorkspaces : []
        this.els.grid.classList.add("folder-grid")
        this.els.empty.classList.add("hidden")
        const fragment = document.createDocumentFragment()
        fragment.append(this.createJoinWorkspaceCard())
        workspaces.forEach(workspace => {
            const card = this.createSharedWorkspaceCard(workspace)
            if (card) fragment.append(card)
        })
        this.els.grid.replaceChildren(fragment)
    }
})()
