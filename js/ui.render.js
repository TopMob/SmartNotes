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
                        <div class="lock-center-title">${dict.lock_center_masked_title || "Protected note"}</div>
                        <div class="lock-center-meta">${Utils.formatDate(note.updatedAt || note.createdAt || Date.now())}</div>
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
        const verified = await new Promise(resolve => {
            this.showPrompt(this.getText("password_title", "Password"), this.getText("password_prompt", "Enter password"), async (val) => {
                resolve(await LockService.verify(note, val))
            })
        })
        if (!verified) {
            this.showToast(this.getText("lock_invalid_password", "Invalid password"))
            return
        }
        const nextNotes = StateStore.read().notes.map(n => n.id === id ? { ...n, lock: { ...n.lock, hidden: false } } : n)
        StateActions.setNotes(nextNotes)
        filterAndRender(document.getElementById("search-input")?.value || "")
        this.renderLockCenter()
        if (!db || !StateStore.read().user) return
        try {
            await db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(id).update({
                "lock.hidden": false
            })
        } catch (e) {
            this.showToast(this.getText("unlock_failed", "Unable to unlock"))
            console.error("Unlock failed", e)
        }
    },

    async removeLockPermanently(noteId) {
        const id = decodeURIComponent(noteId || "")
        if (!id) return
        const note = StateStore.read().notes.find(n => n.id === id)
        if (!note || !note.lock?.hash) return
        const verified = await new Promise(resolve => {
            this.showPrompt(this.getText("password_title", "Password"), this.getText("password_prompt", "Enter password"), async (val) => {
                resolve(await LockService.verify(note, val))
            })
        })
        if (!verified) {
            this.showToast(this.getText("lock_invalid_password", "Invalid password"))
            return
        }
        const nextNotes = StateStore.read().notes.map(n => n.id === id ? { ...n, lock: null } : n)
        StateActions.setNotes(nextNotes)
        filterAndRender(document.getElementById("search-input")?.value || "")
        this.renderLockCenter()
        if (!db || !StateStore.read().user) return
        try {
            const payload = { lock: null }
            if (firebase?.firestore?.FieldValue?.delete) {
                payload.lock = firebase.firestore.FieldValue.delete()
            }
            await db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(id).update(payload)
        } catch (e) {
            this.showToast(this.getText("unlock_failed", "Unable to unlock note"))
            console.error("Unlock failed", e)
        }
    },

    savePreferences() {
        const prefs = {
            folderViewMode: StateStore.read().config.folderViewMode,
            reduceMotion: StateStore.read().config.reduceMotion
        }
        localStorage.setItem("app-preferences", JSON.stringify(prefs))
    },

    closeAllModals() {
        document.querySelectorAll(".modal-overlay.active").forEach(el => el.classList.remove("active"))
    },

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
        if (view === "locked" || view === "hidden" || view === "future") return []
        let list = notes.slice()
        if (view === "favorites") list = list.filter(n => !!n.isFavorite && !n.isArchived)
        if (view === "archive") list = list.filter(n => !!n.isArchived)
        if (view === "notes") list = list.filter(n => !n.isArchived)
        if (view === "folder") list = list.filter(n => !n.isArchived && n.folderId === activeFolderId)
        return list
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
        const groupIds = this.visibleNotes.filter(n => !!n.isPinned === !!draggedNote.isPinned).map(n => n.id)
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
            const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(update.id)
            batch.update(ref, { [orderKey]: update.value })
        })
        batch.commit()
        this.showToast(this.getText("order_updated", "Order updated"), {
            actionLabel: this.getText("undo", "Undo"),
            onAction: () => this.undoOrder()
        })
        filterAndRender(document.getElementById("search-input")?.value || "")
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
            const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(item.id)
            batch.update(ref, { [orderKey]: item.value })
        })
        batch.commit()
        filterAndRender(document.getElementById("search-input")?.value || "")
    },

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
    },

    showShareFallback(message) {
        const text = document.getElementById("share-fallback-message")
        if (text) text.textContent = message
        this.openModal("share-fallback-modal")
    },

    handlePendingShare() {
        const { pendingShare, user, notes } = StateStore.read()
        if (!pendingShare || !user) return
        const payload = pendingShare
        StateActions.clearPendingShare()
        if (payload.error) {
            return this.showShareFallback(this.getText("share_invalid", "Invalid link"))
        }
        if (!payload.shareId) return this.showShareFallback(this.getText("share_invalid", "Invalid link"))
        ShareService.fetchSharedNote(payload.shareId).then(async (shared) => {
            if (!shared || !shared.note) return this.showShareFallback(this.getText("share_missing", "Note not found"))
            if (payload.mode === "collab") {
                const existing = notes.find(n => n.collabId === payload.shareId)
                if (existing) {
                    this.showToast(this.getText("collab_enabled", "Collaboration enabled"))
                    Editor.openFromList(existing)
                    return
                }
                const base = NoteIO.normalizeNote(shared.note)
                const id = notes.some(n => n.id === payload.shareId) ? Utils.generateId() : payload.shareId
                const collabNote = { ...base, id, collabId: payload.shareId, shareId: null }
                await db.collection("users").doc(user.uid).collection("notes").doc(id).set(collabNote, { merge: true })
                this.showToast(this.getText("collab_enabled", "Collaboration enabled"))
                Editor.openFromList(collabNote)
                return
            }
            const base = NoteIO.normalizeNote(shared.note)
            const sharedNote = { ...base, id: Utils.generateId(), shareId: null, collabId: null }
            await db.collection("users").doc(user.uid).collection("notes").doc(sharedNote.id).set(sharedNote, { merge: true })
            this.showToast(this.getText("share_imported", "Note added to your list"))
            Editor.openFromList(sharedNote)
        }).catch(() => {
            this.showShareFallback(this.getText("share_missing", "Note not found"))
        })
    },

    captureShareFromHash() {
        const rawHash = String(location.hash || "")
        const parsed = ShareService.parseHash(rawHash)
        if (!parsed) return
        StateActions.setPendingShare(parsed)
        history.replaceState({}, "", ShareService.base())
    },

    routeShare() {
        const rawHash = String(location.hash || "")
        const parsed = ShareService.parseHash(rawHash)
        if (!parsed) {
            if (/^#(share|collab)(\/|$)/.test(rawHash)) {
                history.replaceState({}, "", ShareService.base())
                return this.showShareFallback(this.getText("share_invalid", "Invalid link"))
            }
            return
        }
        StateActions.setPendingShare(parsed)
        history.replaceState({}, "", ShareService.base())
        this.handlePendingShare()
    },

    async submitFeedback() {
        if (!db || !StateStore.read().user) {
            this.showToast(this.getText("feedback_failed", "Unable to send feedback"))
            return
        }
        if (!StateStore.read().tempRating) {
            this.showToast(this.getText("rate_required", "Please rate first"))
            return
        }
        const text = String(document.getElementById("feedback-text")?.value || "")
        const { user, tempRating, config } = StateStore.read()
        const payload = {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            rating: tempRating,
            text: text.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent || "",
            appVersion: "web",
            language: config.lang
        }
        try {
            await db.collection("feedback").add(payload)
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
    },

    async submitPoll() {
        if (!db || !StateStore.read().user) {
            this.showToast(this.getText("poll_failed", "Unable to send poll"))
            return
        }
        const topic = String(document.getElementById("poll-topic")?.value || "").trim()
        const answer = String(document.getElementById("poll-answer")?.value || "").trim()
        if (!topic || !answer) {
            this.showToast(this.getText("poll_required", "Fill in the poll"))
            return
        }
        const { user, config } = StateStore.read()
        const payload = {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            topic,
            answer,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent || "",
            appVersion: "web",
            language: config.lang
        }
        try {
            await db.collection("polls").add(payload)
            const topicInput = document.getElementById("poll-topic")
            const answerInput = document.getElementById("poll-answer")
            if (topicInput) topicInput.value = ""
            if (answerInput) answerInput.value = ""
            this.showToast(this.getText("poll_thanks", "Thanks!"))
            this.closeModal("poll-modal")
        } catch {
            this.showToast(this.getText("poll_failed", "Unable to send poll"))
        }
    },

    renderNoteActions(noteId) {
        const note = StateStore.read().notes.find(n => n.id === noteId)
        const root = document.getElementById("note-actions-content")
        if (!note || !root) return
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const folders = StateStore.read().folders
        const isArchived = !!note.isArchived
        const isHidden = !!note.isHidden
        const archiveLabel = isArchived ? (dict.restore_note || "Restore") : (dict.archive_note || "Archive")
        const hiddenLabel = isHidden ? (dict.unhide_note || "Unhide") : (dict.hide_note || "Hide")
        const folderOptions = [`<option value="">${dict.folder_none || "No folder"}</option>`]
        folders.forEach(f => {
            const selected = note.folderId === f.id ? "selected" : ""
            folderOptions.push(`<option value="${f.id}" ${selected}>${Utils.escapeHtml(f.name)}</option>`)
        })
        const futureStamp = note.futureAt?.toDate ? note.futureAt.toDate() : (note.futureAt ? new Date(note.futureAt) : null)
        const futureValue = futureStamp ? new Date(futureStamp.getTime() - futureStamp.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""
        root.innerHTML = `
            <div class="modal-actions-grid">
                <button type="button" class="btn-secondary" data-action="note-archive" data-note-id="${encodeURIComponent(note.id)}">
                    ${archiveLabel}
                </button>
                <button type="button" class="btn-secondary" data-action="note-hide-toggle" data-note-id="${encodeURIComponent(note.id)}">
                    ${hiddenLabel}
                </button>
                <button type="button" class="btn-secondary" data-action="note-copy-text" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.copy_text || "Copy text"}
                </button>
                <button type="button" class="btn-secondary" data-action="note-share" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.share_note || "Share"}
                </button>
                <button type="button" class="btn-secondary" data-action="note-collab" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.collab_note || "Collaborate"}
                </button>
                <button type="button" class="btn-danger" data-action="note-delete" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.delete_note || "Delete"}
                </button>
            </div>
            <div class="lock-center-folder" style="margin-top:12px;">
                <select class="input-area lock-center-select note-actions-select" data-note-id="${encodeURIComponent(note.id)}" aria-label="${dict.folder_view_aria || "Folder"}">
                    ${folderOptions.join("")}
                </select>
                <button type="button" class="btn-primary" data-action="note-move-folder" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.move_to_folder || "Move"}
                </button>
            </div>
            <div class="lock-center-folder" style="margin-top:12px;">
                <input type="datetime-local" class="input-area note-future-input" data-note-id="${encodeURIComponent(note.id)}" value="${futureValue}" aria-label="${dict.future_note || "Future note"}">
                <button type="button" class="btn-primary" data-action="note-future-set" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.future_note || "Future note"}
                </button>
                <button type="button" class="btn-secondary" data-action="note-future-clear" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.future_clear || "Clear"}
                </button>
            </div>
            <div class="modal-actions-grid" style="margin-top:12px;">
                <button type="button" class="btn-primary" data-action="download-note" data-lang="download_note">
                    ${dict.download_note || "Download"}
                </button>
            </div>
        `
    },

    async toggleSelectedPin(noteId) {
        if (!noteId) return
        await togglePin(noteId)
        this.closeModal("note-actions-modal")
    },

    async toggleSelectedArchive(noteId) {
        if (!noteId) return
        const note = StateStore.read().notes.find(n => n.id === noteId)
        if (!note) return
        await toggleArchive(noteId, !note.isArchived)
        this.closeModal("note-actions-modal")
    },

    async moveSelectedNoteToFolder(noteId) {
        if (!noteId) return
        const select = document.querySelector(`.note-actions-select[data-note-id="${encodeURIComponent(noteId)}"]`)
        if (!select) return
        const folderId = select.value || null
        await moveNoteToFolder(noteId, folderId)
        this.closeModal("note-actions-modal")
    },

    downloadSelectedNote() {
        const note = StateStore.read().notes.find(n => n.id === this.currentNoteActionId)
        if (!note) return
        if (note.lock?.hash) {
            this.showToast(this.getText("lock_download_blocked", "Note is locked"))
            return
        }
        const data = NoteIO.exportNote(note)
        const blob = new Blob([data], { type: "application/json" })
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = NoteIO.fileNameFor(note)
        a.click()
        URL.revokeObjectURL(a.href)
        this.showToast(this.getText("download_success", "File saved"))
        this.closeModal("note-actions-modal")
    },

    uploadSelectedNote() {
        const note = StateStore.read().notes.find(n => n.id === this.currentNoteActionId)
        if (!note) return
        DriveService.uploadNote(note)
        this.closeModal("note-actions-modal")
    }
})
