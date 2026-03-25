;Object.assign(UI, {
    createSharedWorkspaceCard(workspace) {
        const safeWorkspaceId = window.DomSecurity.sanitizeIdentifier(workspace?.id)
        if (!safeWorkspaceId) return null
        const card = document.createElement("div")
        card.className = "folder-card shared-workspace-card"
        card.dataset.action = "open-shared-workspace"
        card.dataset.workspaceId = safeWorkspaceId

        const title = document.createElement("div")
        title.className = "folder-title"
        window.DomSecurity.setText(title, window.DomSecurity.sanitizeInputValue(workspace?.name || this.getText("shared_workspace_default", "Совместная папка")))

        const meta = document.createElement("div")
        meta.className = "folder-meta"
        const roleLabel = workspace.role === "owner"
            ? this.getText("shared_role_owner", "Владелец")
            : (workspace.role === "editor" ? this.getText("shared_role_editor", "Редактор") : this.getText("shared_role_viewer", "Читатель"))
        window.DomSecurity.setText(meta, roleLabel)

        const description = document.createElement("p")
        description.className = "folder-description-preview"
        window.DomSecurity.setText(description, window.DomSecurity.sanitizeInputValue(workspace?.description || this.getText("shared_workspace_no_description", "Без описания")))

        card.append(title, meta, description)
        return card
    },

    createJoinWorkspaceCard() {
        const card = document.createElement("div")
        card.className = "folder-card"
        const title = document.createElement("div")
        title.className = "folder-title"
        window.DomSecurity.setText(title, this.getText("join_shared_workspace", "Присоединиться по ссылке"))
        const subtitle = document.createElement("div")
        subtitle.className = "folder-meta"
        window.DomSecurity.setText(subtitle, this.getText("join_shared_workspace_hint", "Вставьте invite-ссылку или токен"))
        const actions = document.createElement("div")
        actions.className = "row-left"
        const joinButton = document.createElement("button")
        joinButton.type = "button"
        joinButton.className = "btn-secondary"
        joinButton.dataset.action = "join-shared-workspace-link"
        window.DomSecurity.setText(joinButton, this.getText("join_shared_workspace", "Присоединиться по ссылке"))
        actions.append(joinButton)
        card.append(title, subtitle, actions)
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
})
