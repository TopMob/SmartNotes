const buildExportFileName = (note, extension) => {
    const baseName = NoteIO.fileNameFor(note).replace(/\.json$/i, "")
    return `${baseName}.${extension}`
}

const buildNoteTextExport = (note) => {
    const contentWrapper = document.createElement("div")
    contentWrapper.innerHTML = Utils.sanitizeHtml(note.content || "")
    contentWrapper.querySelectorAll("img, figure, picture, svg, canvas").forEach(element => element.remove())
    const contentText = Utils.stripHtml(contentWrapper.innerHTML).replace(/\r\n/g, "\n").trim()
    const titleText = (note.title || NoteText.buildAutoTitle(note)).trim()
    const parts = []
    if (titleText) parts.push(titleText)
    if (contentText) parts.push(contentText)
    return parts.join("\n\n")
}

const buildSafeExportPagesHtml = (note) => {
    const safeContentHtml = Utils.sanitizeHtml(note.content || "")
    const contentWrapper = document.createElement("div")
    contentWrapper.innerHTML = safeContentHtml
    const pages = Array.from(contentWrapper.querySelectorAll(".note-page"))
    const pageDrawings = Array.isArray(note.pageDrawings) ? note.pageDrawings : []
    const sourcePages = pages.length ? pages : [contentWrapper]
    const exportRoot = document.createElement("div")
    sourcePages.forEach((page, index) => {
        const pageElement = document.createElement("div")
        pageElement.className = "note-page"
        const pageHtml = page.innerHTML || ""
        pageElement.innerHTML = Utils.sanitizeHtml(pageHtml)
        const drawingSource = pageDrawings[index]
        if (typeof drawingSource === "string" && drawingSource.trim()) {
            const drawingElement = document.createElement("img")
            drawingElement.className = "note-drawing"
            drawingElement.alt = ""
            drawingElement.src = drawingSource
            pageElement.appendChild(drawingElement)
        }
        exportRoot.appendChild(pageElement)
    })
    return Utils.sanitizeHtml(exportRoot.innerHTML)
}

const buildPrintableNoteHtml = (note, dict) => {
    const titleText = (note.title || NoteText.buildAutoTitle(note)).trim()
    const formattedDate = Utils.formatDate(note.updatedAt || note.createdAt || Date.now())
    return {
        language: StateStore.read().config.lang || "ru",
        printableTitle: titleText || dict.untitled_note || "Untitled",
        printableDate: formattedDate,
        printableContentHtml: buildSafeExportPagesHtml(note),
        printableStyles: `
        :root { color-scheme: light dark; }
        body { margin: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f1f1f; background: #ffffff; }
        h1 { font-size: 24px; margin: 0 0 6px; }
        .note-date { font-size: 12px; color: #6f6f6f; margin-bottom: 18px; }
        .note-content { font-size: 14px; line-height: 1.6; }
        .note-page { position: relative; padding: 18px; border: 1px solid #e6e6e6; border-radius: 12px; margin-bottom: 18px; min-height: 240px; }
        .note-page:last-child { margin-bottom: 0; }
        .note-drawing { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
        .note-content img { max-width: 100%; height: auto; }
        .note-content ul, .note-content ol { padding-left: 22px; }
        .note-content p { margin: 0 0 10px; }
        @media print {
            body { margin: 20mm; }
            .note-page { break-inside: avoid; }
        }
    `
    }
}

const openPrintWindow = (printableDocument, dict) => {
    const frame = document.createElement("iframe")
    frame.style.position = "fixed"
    frame.style.right = "0"
    frame.style.bottom = "0"
    frame.style.width = "0"
    frame.style.height = "0"
    frame.style.border = "0"
    frame.style.opacity = "0"
    frame.setAttribute("aria-hidden", "true")
    frame.src = "about:blank"
    document.body.appendChild(frame)
    frame.addEventListener("load", () => {
        const doc = frame.contentDocument
        if (!doc) {
            frame.remove()
            UI.showToast(dict.popup_blocked || "Allow popups to print")
            return
        }
        doc.documentElement.lang = printableDocument.language
        doc.head.replaceChildren()
        const metaCharset = doc.createElement("meta")
        metaCharset.setAttribute("charset", "utf-8")
        const documentTitle = doc.createElement("title")
        documentTitle.textContent = printableDocument.printableTitle
        const stylesElement = doc.createElement("style")
        stylesElement.textContent = printableDocument.printableStyles
        doc.head.append(metaCharset, documentTitle, stylesElement)
        doc.body.replaceChildren()
        const headerElement = doc.createElement("header")
        const titleElement = doc.createElement("h1")
        titleElement.textContent = printableDocument.printableTitle
        const dateElement = doc.createElement("div")
        dateElement.className = "note-date"
        dateElement.textContent = printableDocument.printableDate
        headerElement.append(titleElement, dateElement)
        const contentElement = doc.createElement("main")
        contentElement.className = "note-content"
        contentElement.innerHTML = printableDocument.printableContentHtml
        doc.body.append(headerElement, contentElement)
        requestAnimationFrame(() => {
            if (!frame.contentWindow) {
                UI.showToast(dict.popup_blocked || "Allow popups to print")
                frame.remove()
                return
            }
            frame.contentDocument.title = printableDocument.printableTitle
            frame.contentWindow.focus()
            frame.contentWindow.print()
            setTimeout(() => frame.remove(), 1200)
        })
    }, { once: true })
}

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
    },


    async toggleSelectedLock(noteId) {
        if (!noteId) return
        const note = StateStore.read().notes.find(item => item.id === noteId)
        if (!note) return
        if (note.lock?.hash) {
            const verified = await new Promise(resolve => {
                this.showPrompt(this.getText("lock_title", "Lock"), this.getText("lock_password", "Password"), async (value) => {
                    resolve(await LockService.verify(note, value))
                })
            })
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
        this.showPrompt(this.getText("lock_title", "Lock"), this.getText("lock_password", "Password"), async (value) => {
            const password = String(value || "").trim()
            if (!password) {
                this.showToast(this.getText("lock_password_empty", "Password is empty"))
                return
            }
            const user = StateStore.read().user
            if (!user || !db) return
            const lockedNote = await LockService.setLock(note, password)
            const ref = DataPath.getUserNotesCollection(user).doc(note.id)
            await ref.update({ lock: lockedNote.lock || null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
            StateActions.setNotes(StateStore.read().notes.map(item => item.id === note.id ? { ...item, lock: lockedNote.lock } : item))
            this.showToast(this.getText("lock_hidden", "Note hidden"))
            this.closeModal("note-actions-modal")
        })
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

    exportSelectedNoteAsText() {
        const note = StateStore.read().notes.find(n => n.id === this.currentNoteActionId)
        if (!note) return
        if (note.lock?.hash) {
            this.showToast(this.getText("lock_download_blocked", "Note is locked"))
            return
        }
        const text = buildNoteTextExport(note)
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = buildExportFileName(note, "txt")
        link.click()
        URL.revokeObjectURL(link.href)
        this.showToast(this.getText("download_success", "File saved"))
        this.closeModal("note-actions-modal")
    },

    exportSelectedNoteAsPdf() {
        const note = StateStore.read().notes.find(n => n.id === this.currentNoteActionId)
        if (!note) return
        if (note.lock?.hash) {
            this.showToast(this.getText("lock_download_blocked", "Note is locked"))
            return
        }
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const printableDocument = buildPrintableNoteHtml(note, dict)
        openPrintWindow(printableDocument, dict)
        this.closeModal("note-actions-modal")
    },

})
