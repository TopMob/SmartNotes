Object.assign(UI, {
    savePreferences() {
        const prefs = {
            folderViewMode: StateStore.read().config.folderViewMode,
            reduceMotion: StateStore.read().config.reduceMotion
        }
        SafeStorage.local.setJson("app-preferences", prefs)
    },

    closeAllModals() {
        document.querySelectorAll(".modal-overlay.active").forEach(el => el.classList.remove("active"))
    }
});

const isHiddenLocked = (note) => !!(note && note.lock && note.lock.hidden)

window.isHiddenLocked = isHiddenLocked;

Object.assign(UI, {
    renderLockCenter() {
        const listRoot = document.getElementById("lock-center-list")
        const empty = document.getElementById("lock-center-empty")
        if (!listRoot || !empty) return
        const notes = getLockedNotes()
        empty.classList.toggle("hidden", notes.length > 0)
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const folders = StateStore.read().folders
        const randomText = () => {
            const parts = ["скрыто", "данные", "заметка", "защита", "контент", "секрет", "фрагмент", "поля", "шифр", "текст"]
            const count = 12 + Math.floor(Math.random() * 22)
            return Array.from({ length: count }, () => parts[Math.floor(Math.random() * parts.length)]).join(" ")
        }
        listRoot.innerHTML = notes.map(note => {
            const id = encodeURIComponent(note.id)
            const isArchived = !!note.isArchived
            const folderOptions = [`<option value="">${dict.folder_none || "No folder"}</option>`]
            folders.forEach(f => {
                const selected = note.folderId === f.id ? "selected" : ""
                folderOptions.push(`<option value="${f.id}" ${selected}>${Utils.escapeHtml(f.name)}</option>`)
            })
            return `
                <div class="lock-center-card" data-note-id="${id}">
                    <div class="lock-center-header">
                        <div>
                            <div class="lock-center-title">${dict.lock_center_masked_title || "Protected note"}</div>
                            <div class="lock-center-meta">${Utils.formatDate(note.updatedAt || note.createdAt || Date.now())}</div>
                        </div>
                        <button type="button" class="btn-icon" data-action="lock-note-menu" data-note-id="${id}" aria-label="${dict.note_actions || "Actions"}">
                            <i class="material-icons-round" aria-hidden="true">more_horiz</i>
                        </button>
                    </div>
                    <div class="lock-center-preview">${randomText()}</div>
                    <div class="lock-center-actions">
                        <button type="button" class="btn-secondary" data-action="lock-pin" data-note-id="${id}">
                            ${dict.pin_note || "Pin"}
                        </button>
                        <button type="button" class="btn-secondary" data-action="lock-archive" data-note-id="${id}">
                            ${isArchived ? (dict.restore_note || "Restore") : (dict.archive_note || "Archive")}
                        </button>
                        <button type="button" class="btn-secondary" data-action="lock-unhide" data-note-id="${id}">
                            ${dict.unlock_note || "Unlock"}
                        </button>
                        <button type="button" class="btn-secondary" data-action="lock-remove" data-note-id="${id}">
                            ${dict.unlock_forever || "Remove lock"}
                        </button>
                        <div class="lock-center-folder">
                            <select class="input-area lock-center-select" data-note-id="${id}" aria-label="${dict.folder_view_aria || "Folder"}">
                                ${folderOptions.join("")}
                            </select>
                            <button type="button" class="btn-primary" data-action="lock-move-folder" data-note-id="${id}">
                                ${dict.move_to_folder || "Move"}
                            </button>
                        </div>
                    </div>
                </div>
            `
        }).join("")
    },

    async toggleLockPin(noteId) {
        const id = decodeURIComponent(noteId || "")
        if (!id) return
        await togglePin(id, { allowLocked: true })
        this.renderLockCenter()
    },

    async toggleLockArchive(noteId) {
        const id = decodeURIComponent(noteId || "")
        if (!id) return
        const note = StateStore.read().notes.find(n => n.id === id)
        if (!note) return
        await toggleArchive(id, !note.isArchived, { allowLocked: true })
        this.renderLockCenter()
    },

    async moveLockNoteToFolder(noteId) {
        const id = decodeURIComponent(noteId || "")
        if (!id) return
        const select = document.querySelector(`.lock-center-select[data-note-id="${encodeURIComponent(id)}"]`)
        if (!select) return
        const folderId = select.value || null
        await moveNoteToFolder(id, folderId, { allowLocked: true })
        this.renderLockCenter()
    },

    async unlockLockedNote(noteId) {
        const id = decodeURIComponent(noteId || "")
        if (!id) return
        const note = StateStore.read().notes.find(n => n.id === id)
        if (!note || !note.lock?.hash) return
        const password = await this.showPasswordPrompt(this.getText("password_title", "Password"), this.getText("password_prompt", "Enter password"))
        if (password == null) return
        const verified = await LockService.verify(note, password)
        if (!verified) {
            this.showToast(this.getText("lock_invalid_password", "Invalid password"))
            return
        }
        const previousNotes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
        const nextNotes = previousNotes.map(n => n.id === id ? NoteIO.normalizeNote({ ...n, lock: { ...n.lock, hidden: false } }) : n)
        const nextNote = nextNotes.find(n => n.id === id) || null
        StateActions.setNotes(nextNotes)
        updateSearchQuery(document.getElementById("search-input")?.value || "")
        this.renderLockCenter()
        try {
            const savedNote = await window.NoteActionService.patch(id, {
                lock: nextNote?.lock || null
            })
            if (savedNote) {
                const syncedNotes = (Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []).map(n => n.id === id ? NoteIO.normalizeNote(savedNote) : n)
                StateActions.setNotes(syncedNotes)
                this.renderLockCenter()
            }
        } catch (error) {
            StateActions.setNotes(previousNotes)
            updateSearchQuery(document.getElementById("search-input")?.value || "")
            this.renderLockCenter()
            this.showToast(this.getText("unlock_failed", "Unable to unlock"))
            console.error("Unlock failed", error)
        }
    },

    async removeLockPermanently(noteId) {
        const id = decodeURIComponent(noteId || "")
        if (!id) return
        const note = StateStore.read().notes.find(n => n.id === id)
        if (!note || !note.lock?.hash) return
        const password = await this.showPasswordPrompt(this.getText("password_title", "Password"), this.getText("password_prompt", "Enter password"))
        if (password == null) return
        const verified = await LockService.verify(note, password)
        if (!verified) {
            this.showToast(this.getText("lock_invalid_password", "Invalid password"))
            return
        }
        const previousNotes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
        const nextNotes = previousNotes.map(n => n.id === id ? NoteIO.normalizeNote({ ...n, lock: null }) : n)
        StateActions.setNotes(nextNotes)
        updateSearchQuery(document.getElementById("search-input")?.value || "")
        this.renderLockCenter()
        try {
            const savedNote = await window.NoteActionService.patch(id, { lock: null })
            if (savedNote) {
                const syncedNotes = (Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []).map(n => n.id === id ? NoteIO.normalizeNote(savedNote) : n)
                StateActions.setNotes(syncedNotes)
                this.renderLockCenter()
            }
        } catch (error) {
            StateActions.setNotes(previousNotes)
            updateSearchQuery(document.getElementById("search-input")?.value || "")
            this.renderLockCenter()
            this.showToast(this.getText("unlock_failed", "Unable to unlock note"))
            console.error("Unlock failed", error)
        }
    }
});

Object.assign(UI, {
    setDropIndicator(card, position) {
        this.clearDragIndicators()
        card.classList.add(position === "before" ? "drop-before" : "drop-after")
    },

    clearDragIndicators() {
        if (!this.els.grid) return
        this.els.grid.querySelectorAll(".note-card").forEach(card => {
            card.classList.remove("drop-before", "drop-after")
        })
    },

    autoScroll(cursorY) {
        const container = document.getElementById("notes-content-area")
        if (!container) return
        const rect = container.getBoundingClientRect()
        const threshold = 80
        if (cursorY < rect.top + threshold) container.scrollBy({ top: -12, behavior: "smooth" })
        else if (cursorY > rect.bottom - threshold) container.scrollBy({ top: 12, behavior: "smooth" })
    },

    getReorderScope() {
        const { notes, view, activeFolderId } = StateStore.read()
        if (view === "locked" || view === "reminders") return []
        let list = notes.slice()
        if (view === "favorites") list = list.filter(n => !!n.isFavorite && !n.isArchived)
        if (view === "archive") list = list.filter(n => !!n.isArchived)
        if (view === "notes") list = list.filter(n => !n.isArchived)
        if (view === "folder") list = list.filter(n => n.folderId === activeFolderId)
        return list
    },

    getRenderedScopeNotes() {
        const stateSnapshot = StateStore.read()
        const queriedNotes = NotesQueryService.execute(stateSnapshot, stateSnapshot.searchQuery || "").notes
        const view = String(stateSnapshot.view || "notes")
        const supportsPagination = ["notes", "favorites", "archive", "folder", "reminders", "locked"].includes(view)
        const hasActiveSearch = String(stateSnapshot.searchQuery || "").trim().length > 0
        if (!supportsPagination || hasActiveSearch) return queriedNotes
        const displayLimit = Number(stateSnapshot.pagination?.displayLimit) || 20
        return queriedNotes.slice(0, displayLimit)
    },

    reorderNotes(draggedId, targetId, position) {
        if (!db || !StateStore.read().user) return
        if (draggedId === targetId) return
        if (StateStore.read().searchQuery.trim()) {
            this.showToast(this.getText("reorder_search_disabled", "Reordering is disabled while searching"))
            return
        }
        const notesFilter = StateStore.read().config.notesFilter || { sort: "updated" }
        if (notesFilter.sort && notesFilter.sort !== "manual") {
            this.showToast(this.getText("reorder_sort_disabled", "Switch to manual sorting to reorder"))
            return
        }
        const draggedNote = StateStore.read().notes.find(n => n.id === draggedId)
        const targetNote = StateStore.read().notes.find(n => n.id === targetId)
        if (!draggedNote || !targetNote) return
        const { view, activeFolderId } = StateStore.read()
        const isFolderView = view === "folder" && !!activeFolderId
        if (!!draggedNote.isPinned !== !!targetNote.isPinned) {
            this.showToast(this.getText("reorder_pinned_blocked", "Pinned notes reorder separately"))
            return
        }
        const orderKey = isFolderView ? "folderOrder" : "order"
        const groupIds = this.getRenderedScopeNotes().filter(note => !!note.isPinned === !!draggedNote.isPinned).map(note => note.id)
        const fromIndex = groupIds.indexOf(draggedId)
        const toIndex = groupIds.indexOf(targetId)
        if (fromIndex === -1 || toIndex === -1) return
        groupIds.splice(fromIndex, 1)
        const insertIndex = position === "after" ? toIndex + 1 : toIndex
        groupIds.splice(insertIndex > fromIndex ? insertIndex - 1 : insertIndex, 0, draggedId)

        const previous = groupIds.map(id => {
            const note = StateStore.read().notes.find(n => n.id === id)
            return { id, value: typeof note?.[orderKey] === "number" ? note[orderKey] : 0 }
        })
        const { orderHistory } = StateStore.read()
        const scopeKey = `${view}:${activeFolderId || "all"}:${draggedNote.isPinned ? "pinned" : "unpinned"}`
        const nextHistory = [...orderHistory, { scope: scopeKey, orderKey, items: previous }].slice(-20)
        StateActions.setOrderHistory(nextHistory)

        const updates = groupIds.map((id, index) => ({ id, value: index + 1 }))
        const updatedNotes = StateStore.read().notes.map(note => {
            const update = updates.find(item => item.id === note.id)
            return update ? { ...note, [orderKey]: update.value } : note
        })
        StateActions.setNotes(updatedNotes)

        const batch = db.batch()
        updates.forEach(update => {
            const ref = DataPath.getUserNotesCollection(StateStore.read().user).doc(update.id)
            batch.update(ref, { [orderKey]: update.value })
        })
        batch.commit()
        this.showToast(this.getText("order_updated", "Order updated"), {
            actionLabel: this.getText("undo", "Undo"),
            onAction: () => this.undoOrder()
        })
        updateSearchQuery(document.getElementById("search-input")?.value || "")
    },

    undoOrder() {
        if (!db || !StateStore.read().user) return
        const last = StateStore.read().orderHistory[StateStore.read().orderHistory.length - 1]
        if (!last) return
        StateActions.setOrderHistory(StateStore.read().orderHistory.slice(0, -1))
        const batch = db.batch()
        const orderKey = last.orderKey || "order"
        const updatedNotes = StateStore.read().notes.map(note => {
            const item = last.items.find(entry => entry.id === note.id)
            return item ? { ...note, [orderKey]: item.value } : note
        })
        StateActions.setNotes(updatedNotes)
        last.items.forEach(item => {
            const ref = DataPath.getUserNotesCollection(StateStore.read().user).doc(item.id)
            batch.update(ref, { [orderKey]: item.value })
        })
        batch.commit()
        updateSearchQuery(document.getElementById("search-input")?.value || "")
    }
});

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

        if (String(folder?.accessRole || "owner") !== "owner") {
            const roleBadge = document.createElement("span")
            roleBadge.className = "nav-access-badge"
            window.DomSecurity.setText(roleBadge, this.getAccessRoleLabel(folder.accessRole || "viewer"))
            folderButton.append(iconElement, nameElement, roleBadge)
        } else {
            folderButton.append(iconElement, nameElement)
        }

        const folderDescription = window.DomSecurity.sanitizeInputValue(folder?.description)
        if (folderDescription) folderButton.title = folderDescription

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
        this.updateTrashActionVisibility()
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
        this.resetContentGridLayout()
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
        this.updateTrashActionVisibility()
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
        this.resetContentGridLayout()
        this.els.grid.classList.add("folder-grid")

        const fragment = document.createDocumentFragment()
        visibleFolders.forEach(folder => {
            const folderCard = this.createFolderOverviewCard(folder, notes)
            if (folderCard) fragment.append(folderCard)
        })

        this.els.grid.replaceChildren(fragment)
        this.updateFolderLimitControls()
    }
});

Object.assign(UI, {
    async submitFeedback() {
        if (!this.isFeatureEnabled("feedback")) {
            this.showFeatureDisabledToast("feedback")
            return
        }
        if (!db || !StateStore.read().user) {
            this.showToast(this.getText("feedback_failed", "Unable to send feedback"))
            return
        }
        if (!StateStore.read().tempRating) {
            this.showToast(this.getText("rate_required", "Please rate first"))
            return
        }
        const text = String(document.getElementById("feedback-text")?.value || "")
        const sanitize = typeof window.sanitizeLogValue === "function" ? window.sanitizeLogValue : value => value
        const consoleLogs = window.ConsoleLogStore?.getEntries ? window.ConsoleLogStore.getEntries() : []
        const { user, tempRating, config } = StateStore.read()
        const rawPayload = {
            type: "feedback",
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            rating: tempRating,
            text: String(sanitize(text.trim()) || ""),
            consoleLogs: sanitize(consoleLogs),
            createdAt: new Date().toISOString(),
            userAgent: navigator.userAgent || "",
            appVersion: "web",
            language: config.lang
        }
        try {
            const payload = sanitize(rawPayload)
            const response = await fetch("/api/supabase/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {})
                },
                body: JSON.stringify(payload)
            })
            if (!response.ok) throw new Error(`supabase-feedback-http-${response.status}`)
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
    }
});

const getCountLabel = (count, singleKey, pluralKey) => {
    if (count === 1) return UI.getText(singleKey, singleKey)
    return UI.getText(pluralKey, UI.getText(singleKey, singleKey))
}

const getCleanText = (html) => {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = html || ""
    wrapper.querySelectorAll(".audio-block, .audio-wrapper").forEach(element => element.remove())
    wrapper.querySelectorAll("br").forEach(element => element.replaceWith("\n"))
    wrapper.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, blockquote").forEach(element => {
        element.appendChild(document.createTextNode("\n"))
    })
    const text = wrapper.textContent || ""
    return text.replace(/\n{3,}/g, "\n\n").trim()
}

const getMediaCounts = (html) => {
    if (!html) return { images: 0, audio: 0 }
    const wrapper = document.createElement("div")
    wrapper.innerHTML = html
    return {
        images: wrapper.querySelectorAll("img").length,
        audio: wrapper.querySelectorAll("audio").length
    }
}

const formatMediaSummary = (counts) => {
    const parts = []
    if (counts.images) {
        parts.push(`${counts.images} ${getCountLabel(counts.images, "media_photo", "media_photos")}`)
    }
    if (counts.audio) {
        parts.push(`${counts.audio} ${getCountLabel(counts.audio, "media_audio", "media_audios")}`)
    }
    return parts.join(" · ")
}

const buildAutoTitle = (note) => {
    const text = getCleanText(note.content || "")
    if (text) {
        const firstLine = text.split(/\r?\n/).find(line => line.trim()) || text
        const normalized = firstLine.trim()
        return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized
    }
    const mediaSummary = formatMediaSummary(getMediaCounts(note.content || ""))
    return mediaSummary || UI.getText("untitled_note", "Untitled")
}

const buildPreviewText = (note) => {
    const text = getCleanText(note.content || "")
    if (text) return text
    const mediaSummary = formatMediaSummary(getMediaCounts(note.content || ""))
    return mediaSummary || UI.getText("empty_note", "No content")
}

window.NoteText = {
    buildAutoTitle,
    buildPreviewText
};
