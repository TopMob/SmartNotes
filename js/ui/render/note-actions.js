Object.assign(UI, {
    resolveNoteById(noteId) {
        const current = StateStore.read().currentNote
        if (current && (!noteId || current.id === noteId)) return current
        if (noteId) return StateStore.read().notes.find(n => n.id === noteId)
        return StateStore.read().notes.find(n => n.id === this.currentNoteActionId)
    },

    renderNoteActions(noteId) {
        const note = StateStore.read().notes.find(n => n.id === noteId)
        const root = document.getElementById("note-actions-content")
        if (!note || !root) return
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const folders = StateStore.read().folders
        const isArchived = !!note.isArchived
        const archiveLabel = isArchived ? (dict.restore_note || "Restore") : (dict.archive_note || "Archive")
        const folderOptions = [`<option value="">${dict.folder_none || "No folder"}</option>`]
        folders.forEach(f => {
            const selected = note.folderId === f.id ? "selected" : ""
            folderOptions.push(`<option value="${f.id}" ${selected}>${Utils.escapeHtml(f.name)}</option>`)
        })
        const futureStamp = note.futureAt?.toDate ? note.futureAt.toDate() : (note.futureAt ? new Date(note.futureAt) : null)
        const futureValue = futureStamp ? new Date(futureStamp.getTime() - futureStamp.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""
        const futureClearButton = futureValue
            ? `<button type="button" class="btn-secondary" data-action="note-future-clear" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.future_clear || "Clear"}
                </button>`
            : ""
        root.innerHTML = `
            <div class="modal-actions-grid">
                <button type="button" class="btn-secondary" data-action="note-archive" data-note-id="${encodeURIComponent(note.id)}">
                    ${archiveLabel}
                </button>
                <button type="button" class="btn-secondary" data-action="note-copy-text" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.copy_text || "Copy text"}
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
                ${futureClearButton}
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
