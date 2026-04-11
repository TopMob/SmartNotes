(() => {
window.UINoteActionsPanel = {

    renderNoteActions(noteId) {
        const note = this.resolveNoteById(noteId)
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
        const reminderStamp = note.reminderAt?.toDate ? note.reminderAt.toDate() : (note.reminderAt ? new Date(note.reminderAt) : null)
        const reminderValue = reminderStamp ? new Date(reminderStamp.getTime() - reminderStamp.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""
        const reminderClearButton = reminderValue
            ? `<button type="button" class="btn-secondary" data-action="note-reminder-clear" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.reminder_clear || "Clear"}
                </button>`
            : ""
        root.innerHTML = `
            <div class="modal-actions-grid">
                <button type="button" class="btn-secondary" data-action="note-archive" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">inventory_2</i>${archiveLabel}
                </button>
                <button type="button" class="btn-secondary" data-action="note-lock-toggle" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">lock</i>${note.lock?.hash ? (dict.unlock_note || "Unlock") : (dict.lock_note || "Lock")}
                </button>
                <button type="button" class="btn-secondary" data-action="note-copy-text" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">content_copy</i>${dict.copy_text || "Copy text"}
                </button>
                <button type="button" class="btn-secondary" data-action="note-mark-for-reanalysis" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">psychology</i>${dict.note_mark_for_reanalysis || "Отметить для повторного анализа"}
                </button>
                <button type="button" class="btn-danger" data-action="note-delete" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">delete</i>${note.trashedAt ? (dict.delete_permanently || "Delete permanently") : (dict.delete_note || "Delete")}
                </button>
                ${note.trashedAt ? `<button type="button" class="btn-secondary" data-action="note-restore" data-note-id="${encodeURIComponent(note.id)}">${dict.restore_note || "Restore"}</button>` : ""}
            </div>
            <div class="lock-center-folder" style="margin-top:12px;">
                <select class="input-area lock-center-select note-actions-select" data-note-id="${encodeURIComponent(note.id)}" aria-label="${dict.folder_view_aria || "Folder"}">
                    ${folderOptions.join("")}
                </select>
                <button type="button" class="btn-primary" data-action="note-move-folder" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">drive_file_move</i>${dict.move_to_folder || "Move"}
                </button>
            </div>
            <div class="lock-center-folder" style="margin-top:12px;">
                <input type="datetime-local" class="input-area note-reminder-input" data-note-id="${encodeURIComponent(note.id)}" value="${reminderValue}" aria-label="${dict.reminder_note || "Reminder"}">
                <button type="button" class="btn-primary" data-action="note-reminder-set" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">notifications</i>${dict.reminder_note || "Reminder"}
                </button>
                ${reminderClearButton}
            </div>
            <div class="modal-actions-grid" style="margin-top:12px;">
                <button type="button" class="btn-primary" data-action="download-note" data-lang="download_note">
                    <i class="material-icons-round" aria-hidden="true">download</i>${dict.download_note || "Download"}
                </button>
                <button type="button" class="btn-secondary" data-action="export-note-txt" data-lang="export_txt">
                    <i class="material-icons-round" aria-hidden="true">description</i>${dict.export_txt || "Export TXT"}
                </button>
                <button type="button" class="btn-secondary" data-action="export-note-pdf" data-lang="export_pdf">
                    <i class="material-icons-round" aria-hidden="true">picture_as_pdf</i>${dict.export_pdf || "Export PDF"}
                </button>
            </div>
        `
        this.applyInputAutocompletePolicy(root)
    },


    async toggleSelectedLock(noteId) {
        if (!noteId) return
        const note = this.resolveNoteById(noteId)
        if (!note) return
        if (note.lock?.hash) {
            const password = await this.showPasswordPrompt(this.getText("lock_title", "Lock"), this.getText("lock_password", "Password"))
            if (password == null) return
            const verified = await LockService.verify(note, password)
            if (!verified) {
                this.showToast(this.getText("lock_invalid_password", "Invalid password"))
                return
            }
            const user = StateStore.read().user
            if (!user || !db) return
            const ref = DataPath.getUserNotesCollection(user).doc(note.id)
            const payload = { lock: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }
            if (firebase?.firestore?.FieldValue?.delete) payload.lock = firebase.firestore.FieldValue.delete()
            await ref.update(payload)
            StateActions.setNotes(StateStore.read().notes.map(item => item.id === note.id ? { ...item, lock: null } : item))
            this.showToast(this.getText("unlock_success", "Note unlocked"))
            this.closeModal("note-actions-modal")
            return
        }
        const password = await this.showPasswordPrompt(this.getText("lock_title", "Lock"), this.getText("lock_password", "Password"))
        if (password == null) return
        const normalizedPassword = String(password || "").trim()
        if (!normalizedPassword) {
            this.showToast(this.getText("lock_password_empty", "Password is empty"))
            return
        }
        const user = StateStore.read().user
        if (!user || !db) return
        const lockedNote = await LockService.setLock(note, normalizedPassword)
        const ref = DataPath.getUserNotesCollection(user).doc(note.id)
        await ref.update({ lock: lockedNote.lock || null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        StateActions.setNotes(StateStore.read().notes.map(item => item.id === note.id ? { ...item, lock: lockedNote.lock } : item))
        this.showToast(this.getText("lock_hidden", "Note hidden"))
        this.closeModal("note-actions-modal")
    },
    async toggleSelectedPin(noteId) {
        if (!noteId) return
        await togglePin(noteId)
        this.closeModal("note-actions-modal")
    },

    async toggleSelectedArchive(noteId) {
        if (!noteId) return
        const note = this.resolveNoteById(noteId)
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
        const note = this.resolveNoteById(this.currentNoteActionId)
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

    exportSelectedNoteAsText() {
        const note = this.resolveNoteById(this.currentNoteActionId)
        if (!note) return
        if (note.lock?.hash) {
            this.showToast(this.getText("lock_download_blocked", "Note is locked"))
            return
        }
        const exportApi = window.UINoteActionsExport
        if (!exportApi || typeof exportApi.buildNoteTextExport !== "function" || typeof exportApi.buildExportFileName !== "function") return
        const text = exportApi.buildNoteTextExport(note)
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = exportApi.buildExportFileName(note, "txt")
        link.click()
        URL.revokeObjectURL(link.href)
        this.showToast(this.getText("download_success", "File saved"))
        this.closeModal("note-actions-modal")
    },

    exportSelectedNoteAsPdf() {
        const note = this.resolveNoteById(this.currentNoteActionId)
        if (!note) return
        if (note.lock?.hash) {
            this.showToast(this.getText("lock_download_blocked", "Note is locked"))
            return
        }
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const exportApi = window.UINoteActionsExport
        if (!exportApi || typeof exportApi.buildPrintableNoteHtml !== "function" || typeof exportApi.openPrintWindow !== "function") return
        const printableDocument = exportApi.buildPrintableNoteHtml(note, dict)
        exportApi.openPrintWindow(printableDocument, dict)
        this.closeModal("note-actions-modal")
    },
}
})()
