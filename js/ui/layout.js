const DRIVE_LAST_MANUAL_BACKUP_AT_KEY = "drive-last-manual-backup-at";

(() => {
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
        const note = this.resolveNoteById(this.currentNoteActionId)
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

});
})();


Object.assign(UI, {
    updateSidebarLayout() {
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches
        const isActive = this.els.sidebar?.classList.contains("active")
        if (this.els.sidebar) {
            this.els.sidebar.classList.toggle("collapsed", isDesktop && !isActive)
        }
        if (this.els.sidebarOverlay) {
            this.els.sidebarOverlay.classList.toggle("active", !!isActive && !isDesktop)
        }
    },

    toggleSidebar(force) {
        if (!this.els.sidebar) return
        const next = typeof force === "boolean" ? force : !this.els.sidebar.classList.contains("active")
        this.els.sidebar.classList.toggle("active", next)
        this.updateSidebarLayout()
    },

    toggleUserMenu(force) {
        if (!this.els.userMenu) return
        this.els.userMenu.classList.toggle("active", typeof force === "boolean" ? force : !this.els.userMenu.classList.contains("active"))
    },

    triggerImport() {
        const input = document.getElementById("note-import")
        if (!input) return
        input.value = ""
        input.click()
    },

    resolveExternalMediaMessage(error, options = {}) {
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const descriptor = mediaService?.resolveUserFacingError?.(error, options) || (options.attachmentOnly ? { messageKey: "external_attachment_unavailable", fallbackMessage: "Disk is not connected, attachment unavailable" } : { messageKey: "external_storage_unlinked", fallbackMessage: "External storage is not connected" })
        return this.getText(descriptor.messageKey, descriptor.fallbackMessage)
    },

    normalizeImportedDate(inputValue) {
        const timestampType = firebase?.firestore?.Timestamp
        if (timestampType && typeof inputValue?.toDate === "function") return inputValue
        if (timestampType && inputValue && typeof inputValue === "object" && Number.isFinite(inputValue.seconds)) {
            return timestampType.fromMillis(inputValue.seconds * 1000)
        }
        if (timestampType && typeof inputValue === "number" && Number.isFinite(inputValue)) {
            return timestampType.fromMillis(inputValue)
        }
        if (timestampType && typeof inputValue === "string") {
            const parsedDate = new Date(inputValue)
            if (Number.isFinite(parsedDate.getTime())) {
                return timestampType.fromDate(parsedDate)
            }
        }
        if (inputValue instanceof Date && Number.isFinite(inputValue.getTime()) && timestampType) {
            return timestampType.fromDate(inputValue)
        }
        return firebase.firestore.FieldValue.serverTimestamp()
    },

    normalizeImportedTags(rawTags) {
        if (!Array.isArray(rawTags)) return []
        const uniqueTags = []
        const seenTags = new Set()
        for (const rawTag of rawTags) {
            const normalizedTag = String(rawTag || "").trim()
            if (!normalizedTag) continue
            const lowerTag = normalizedTag.toLowerCase()
            if (seenTags.has(lowerTag)) continue
            seenTags.add(lowerTag)
            uniqueTags.push(normalizedTag)
            if (uniqueTags.length >= 50) break
        }
        return uniqueTags
    },

    buildImportedFolder(rawFolder, ownerUid, index = 0) {
        const safeFolder = rawFolder && typeof rawFolder === "object" ? rawFolder : {}
        const nameSource = String(safeFolder.name || "").trim()
        const descriptionSource = String(safeFolder.description || "").trim()
        const validatedName = window.Validators.validateFolderName(nameSource) || nameSource.slice(0, 50).trim()
        const validatedDescription = window.Validators.validateFolderDescription(descriptionSource)
        const importedFolderOrder = Number(safeFolder.folderOrder)
        if (!validatedName) return null
        return {
            sourceId: String(safeFolder.id || ""),
            id: Utils.generateId(),
            name: validatedName,
            description: validatedDescription == null ? descriptionSource.slice(0, 300) : validatedDescription,
            isHidden: !!safeFolder.isHidden,
            trashedAt: null,
            folderOrder: Number.isFinite(importedFolderOrder) ? importedFolderOrder : Date.now() + index,
            createdAt: this.normalizeImportedDate(safeFolder.createdAt),
            updatedAt: this.normalizeImportedDate(safeFolder.updatedAt || safeFolder.createdAt),
            ownerUid: String(ownerUid || "")
        }
    },

    async normalizeImportedNoteMedia(note) {
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const inlineSummary = mediaService?.getInlineMediaSummary?.(note) || {
            hasInlineMedia: /data:(image|audio)\//i.test(String(note?.content || "")) || (Array.isArray(note?.pageDrawings) && note.pageDrawings.some(item => /data:(image|audio)\//i.test(String(item || "")))),
            count: (String(note?.content || "").match(/data:(image|audio)\//gi) || []).length + ((Array.isArray(note?.pageDrawings) ? note.pageDrawings : []).filter(item => /data:(image|audio)\//i.test(String(item || ""))).length)
        }
        if (!mediaService) {
            const sanitizedContent = String(note?.content || "").replace(/<img[^>]+src=["']data:(?:image|audio)[^>]*>/gi, "").replace(/<audio[^>]*>[\s\S]*?<\/audio>/gi, "")
            return {
                note: NoteIO.normalizeNote({ ...note, content: sanitizedContent, pageDrawings: [] }),
                hadInlineMedia: !!inlineSummary.hasInlineMedia,
                failedMediaCount: inlineSummary.hasInlineMedia ? Math.max(1, Number(inlineSummary.count || 0)) : 0
            }
        }
        const normalizedResult = await mediaService.externalizeNoteMedia(note, {
            fileNameBase: window.NoteExportService?.sanitizeExportFileName?.(note?.title || note?.id || "imported_note", "imported_note") || "imported_note",
            mode: "best-effort"
        })
        return {
            note: NoteIO.normalizeNote(normalizedResult.note),
            hadInlineMedia: !!inlineSummary.hasInlineMedia,
            failedMediaCount: Array.isArray(normalizedResult.failures) ? normalizedResult.failures.length : 0
        }
    },

    async buildImportedNote(rawNote, ownerUid, folderIdMap = new Map()) {
        const normalizedNote = NoteIO.normalizeNote({
            ...(rawNote && typeof rawNote === "object" ? rawNote : {}),
            id: Utils.generateId(),
            ownerUid: String(ownerUid || ""),
            trashedAt: null,
            access: null,
            hiddenTags: []
        })
        const normalizedFolderId = String(normalizedNote.folderId || "")
        const targetFolderId = normalizedFolderId ? (folderIdMap.get(normalizedFolderId) || null) : null
        const importedNote = {
            ...normalizedNote,
            tags: this.normalizeImportedTags(normalizedNote.tags),
            pageTitles: Array.isArray(normalizedNote.pageTitles) ? normalizedNote.pageTitles : [],
            pageDrawings: Array.isArray(normalizedNote.pageDrawings) ? normalizedNote.pageDrawings : [],
            pageDrawingsRevision: String(normalizedNote.pageDrawingsRevision || ""),
            createdAt: this.normalizeImportedDate(normalizedNote.createdAt),
            updatedAt: this.normalizeImportedDate(normalizedNote.updatedAt),
            ownerUid: String(ownerUid || ""),
            access: {
                ownerUid: String(ownerUid || ""),
                roles: String(ownerUid || "") ? { [String(ownerUid || "")]: "owner" } : {},
                noteId: "",
                shareId: "",
                ownerCollection: ""
            },
            analyzed: false,
            aiProcessed: false,
            aiFolder: "",
            aiTags: [],
            aiRelevance: 0,
            aiVersion: 0,
            aiLastAnalyzed: null,
            hiddenTags: [],
            relevance: 0,
            folderId: targetFolderId,
            trashedAt: null,
            reminderAt: normalizedNote.reminderAt ? this.normalizeImportedDate(normalizedNote.reminderAt) : null,
            order: Date.now()
        }
        return this.normalizeImportedNoteMedia(importedNote)
    },

    buildImportResultSummary(results = []) {
        return results.reduce((summary, result) => {
            if (!result) return summary
            if (result.note) summary.savedNotes += 1
            if (result.failedMediaCount) summary.failedMediaCount += Number(result.failedMediaCount) || 0
            if (result.hadInlineMedia) summary.notesWithInlineMedia += 1
            return summary
        }, {
            savedNotes: 0,
            failedMediaCount: 0,
            notesWithInlineMedia: 0
        })
    },

    async importNotesWithRecovery(rawNotes, ownerUid, folderIdMap = new Map()) {
        const importResults = []
        for (const rawNote of Array.isArray(rawNotes) ? rawNotes : []) {
            try {
                const result = await this.buildImportedNote(rawNote, ownerUid, folderIdMap)
                if (result?.note) importResults.push(result)
            } catch (error) {
                const errorCode = String(error?.message || error?.code || "")
                if (errorCode.includes("external-") || errorCode.startsWith("drive-")) {
                    const fallbackNote = await this.buildImportedNote({
                        ...(rawNote && typeof rawNote === "object" ? rawNote : {}),
                        content: Utils.sanitizeHtml(Utils.stripHtml(String(rawNote?.content || rawNote?.body || rawNote?.text || ""))),
                        pageDrawings: []
                    }, ownerUid, folderIdMap)
                    if (fallbackNote?.note) {
                        importResults.push({
                            ...fallbackNote,
                            failedMediaCount: (Number(fallbackNote.failedMediaCount) || 0) + 1,
                            hadInlineMedia: true
                        })
                        continue
                    }
                }
                throw error
            }
        }
        return importResults
    },

    async saveImportedNotes(user, importedNotes) {
        const notes = Array.isArray(importedNotes) ? importedNotes : []
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const hasInlineMedia = mediaService
            ? notes.some(note => mediaService.getInlineMediaSummary?.(note)?.hasInlineMedia)
            : notes.some(note => /data:(image|audio)\//i.test(String(note?.content || "")) || (Array.isArray(note?.pageDrawings) && note.pageDrawings.some(item => /data:(image|audio)\//i.test(String(item || "")))))
        if (hasInlineMedia) {
            throw new Error(mediaService ? "external-inline-media-blocked" : "external-storage-unlinked")
        }
        const chunkSize = 450
        for (let index = 0; index < notes.length; index += chunkSize) {
            const batch = db.batch()
            notes.slice(index, index + chunkSize).forEach(importedNote => {
                const reference = DataPath.getUserNotesCollection(user).doc(importedNote.id)
                batch.set(reference, importedNote, { merge: true })
            })
            await batch.commit()
        }
    },

    async saveImportedFolders(user, importedFolders) {
        const folders = Array.isArray(importedFolders) ? importedFolders : []
        if (!folders.length) return new Map()
        const existingFolders = StateStore.read().folders.filter(folder => !folder.trashedAt)
        const existingByName = new Map(existingFolders.map(folder => [String(folder.name || "").trim().toLowerCase(), folder]))
        const folderIdMap = new Map()
        const foldersToCreate = []

        folders.forEach((importedFolder, index) => {
            if (!importedFolder) return
            const normalizedName = String(importedFolder.name || "").trim().toLowerCase()
            if (!normalizedName) return
            const existingFolder = existingByName.get(normalizedName)
            if (existingFolder) {
                folderIdMap.set(String(importedFolder.sourceId || importedFolder.id || ""), existingFolder.id)
                return
            }
            const nextFolder = {
                ...importedFolder,
                id: importedFolder.id || Utils.generateId(),
                folderOrder: Date.now() + index
            }
            folderIdMap.set(String(importedFolder.sourceId || importedFolder.id || ""), nextFolder.id)
            foldersToCreate.push(nextFolder)
            existingByName.set(normalizedName, nextFolder)
        })

        if (!foldersToCreate.length) return folderIdMap

        const batch = db.batch()
        foldersToCreate.forEach(folder => {
            const reference = DataPath.getUserFoldersCollection(user).doc(folder.id)
            const { sourceId, ...folderPayload } = folder
            batch.set(reference, folderPayload, { merge: true })
        })
        await batch.commit()
        return folderIdMap
    },

    async handleNoteImport(e) {
        if (!db || !StateStore.read().user) return
        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null
        if (!file) return
        if (!String(file.type).includes("json") && !String(file.name).toLowerCase().endsWith(".json")) {
            this.showToast(this.getText("import_invalid", "Unsupported file"))
            return
        }
        const reader = new FileReader()
        reader.onload = async () => {
            const loadingLock = this.startLoading(this.getText("loading_import", "Импорт данных..."))
            try {
                const text = String(reader.result || "").replace(/^﻿/, "")
                const parsed = JSON.parse(text)
                const importBundle = NoteIO.parseImportBundle(parsed)
                if (!importBundle.notes.length) {
                    this.showToast(this.getText("import_empty", "No notes found"))
                    return
                }
                const current = StateStore.read()
                const foldersToImport = (Array.isArray(importBundle.folders) ? importBundle.folders : [])
                    .map((folder, index) => this.buildImportedFolder(folder, current.user.uid, index))
                    .filter(Boolean)
                const folderIdMap = await this.saveImportedFolders(current.user, foldersToImport)
                const importResults = await this.importNotesWithRecovery(importBundle.notes, current.user.uid, folderIdMap)
                const notesToImport = importResults.map(result => result.note).filter(Boolean)
                if (!notesToImport.length) {
                    this.showToast(this.getText("import_failed", "Import failed"))
                    return
                }
                await this.saveImportedNotes(current.user, notesToImport)
                const importSummary = this.buildImportResultSummary(importResults)
                if (importSummary.failedMediaCount > 0) {
                    this.showToast(`${this.getText("import_success", "Imported")}. ${this.resolveExternalMediaMessage(new Error("external-attachment-save-failed"), { attachmentOnly: true })}`)
                    return
                }
                this.showToast(this.getText("import_success", "Imported"))
            } catch (error) {
                console.error("Import failed", error)
                const errorCode = String(error?.message || error?.code || "")
                if (errorCode.includes("external-") || errorCode.includes("drive-")) {
                    this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
                    return
                }
                this.showToast(this.getText("import_failed", "Import failed"))
            } finally {
                this.stopLoading(loadingLock)
            }
        }
        reader.onerror = () => this.showToast(this.getText("import_failed", "Import failed"))
        reader.readAsText(file, "utf-8")
    },

    getExportableNotes(filterFn = null) {
        const notes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
        return notes.filter(note => {
            if (!note || note.trashedAt) return false
            return typeof filterFn === "function" ? filterFn(note) : true
        })
    },

    getVisibleExportableNotes() {
        const stateSnapshot = StateStore.read()
        const query = document.getElementById("search-input")?.value || stateSnapshot.searchQuery || ""
        const visible = NotesQueryService.execute(stateSnapshot, query).notes || []
        return visible.filter(note => !!note && !note.trashedAt)
    },

    getExportFoldersForNotes(notes, options = {}) {
        if (Array.isArray(options.folders)) return options.folders
        const stateFolders = Array.isArray(StateStore.read().folders) ? StateStore.read().folders : []
        const folderIds = new Set((Array.isArray(notes) ? notes : []).map(note => String(note?.folderId || "")).filter(Boolean))
        if (options.folder && typeof options.folder === "object") {
            folderIds.add(String(options.folder.id || ""))
        }
        return stateFolders.filter(folder => folderIds.has(String(folder.id || "")))
    },

    async prepareExportNotes(notes) {
        const exportableNotes = Array.isArray(notes) ? notes : []
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        if (!mediaService) {
            if (exportableNotes.some(note => /data:(image|audio)\//i.test(String(note?.content || "")) || (Array.isArray(note?.pageDrawings) && note.pageDrawings.some(item => /data:(image|audio)\//i.test(String(item || "")))))) {
                throw new Error("external-storage-unlinked")
            }
            return exportableNotes
        }
        return Promise.all(exportableNotes.map(async note => {
            const prepared = await mediaService.externalizeNoteMedia(note, {
                fileNameBase: window.NoteExportService?.sanitizeExportFileName?.(note?.title || note?.id || "note_export", "note_export") || "note_export"
            })
            const normalizedNote = NoteIO.normalizeNote(prepared.note)
            if (mediaService.getInlineMediaSummary?.(normalizedNote)?.hasInlineMedia) {
                throw new Error("drive-upload-failed:export-inline-media")
            }
            return normalizedNote
        }))
    },

    async exportNotesBundle(notes, options = {}) {
        const loadingLock = this.startLoading(this.getText("loading_export", "Подготовка экспорта..."))
        try {
            const exportableNotes = Array.isArray(notes) ? notes : []
            if (!exportableNotes.length) {
                const emptyKey = options.emptyMessageKey || "export_empty"
                const fallbackMessage = options.emptyFallback || "No notes available for export"
                this.showToast(this.getText(emptyKey, fallbackMessage))
                return null
            }
            const preparedNotes = await this.prepareExportNotes(exportableNotes)
            const payload = window.NoteExportService.buildExportPayload({
                notes: preparedNotes,
                folders: this.getExportFoldersForNotes(preparedNotes, options),
                scope: options.scope || "all",
                folder: options.folder || null
            })
            const fileName = window.NoteExportService.downloadExportPayload(payload, {
                scope: options.scope || "all",
                folderName: options.folder?.name || ""
            })
            this.showToast(this.getText("download_success", "File saved"))
            return fileName
        } finally {
            this.stopLoading(loadingLock)
        }
    },

    async backupNotesBundleToDrive(notes, options = {}) {
        const loadingLock = this.startLoading(this.getText("loading_backup", "Создание резервной копии..."))
        try {
            const exportableNotes = Array.isArray(notes) ? notes : []
            if (!exportableNotes.length) {
                const emptyKey = options.emptyMessageKey || "export_empty"
                const fallbackMessage = options.emptyFallback || "No notes available for export"
                this.showToast(this.getText(emptyKey, fallbackMessage))
                return null
            }
            const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
            if (!mediaService?.uploadFile) {
                this.showToast(this.getText("backup_connected_drive_required", "Connect external storage to create a backup"))
                return null
            }
            const preparedNotes = await this.prepareExportNotes(exportableNotes)
            const payload = window.NoteExportService.buildExportPayload({
                notes: preparedNotes,
                folders: this.getExportFoldersForNotes(preparedNotes, options),
                scope: options.scope || "all",
                folder: options.folder || null
            })
            const fileName = window.NoteExportService.buildExportFileName({
                scope: options.scope || "all",
                folderName: options.folder?.name || ""
            })
            const blob = window.NoteExportService.createExportBlob(payload)
            const publicUrl = await mediaService.uploadFile(blob, {
                fileName,
                mimeType: "application/json",
                targetFolder: "backups"
            })
            const completedAt = new Date().toISOString()
            SafeStorage.local.set(DRIVE_LAST_MANUAL_BACKUP_AT_KEY, completedAt)
            this.showToast(this.getText("backup_success", "Backup saved to external storage"))
            return { fileName, publicUrl, completedAt }
        } finally {
            this.stopLoading(loadingLock)
        }
    },

    async exportAllNotes() {
        try {
            return await this.exportNotesBundle(this.getExportableNotes(), {
                scope: "all",
                emptyMessageKey: "export_empty",
                emptyFallback: "No notes available for export"
            })
        } catch (error) {
            console.error("Export failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    async exportVisibleNotes() {
        try {
            return await this.exportNotesBundle(this.getVisibleExportableNotes(), {
                scope: "selection",
                emptyMessageKey: "export_visible_empty",
                emptyFallback: "No notes found for the current filters"
            })
        } catch (error) {
            console.error("Export failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    getExportableFoldersList() {
        const folders = Array.isArray(StateStore.read().folders) ? StateStore.read().folders : []
        return folders.filter(folder => !folder?.trashedAt)
    },

    getLastDriveBackupAt() {
        const rawValue = SafeStorage.local.get(DRIVE_LAST_MANUAL_BACKUP_AT_KEY)
        if (!rawValue) return null
        const date = new Date(rawValue)
        return Number.isFinite(date.getTime()) ? date : null
    },

    getLastDriveBackupLabel() {
        const date = this.getLastDriveBackupAt()
        if (!date) return this.getText("backup_last_manual_none", "Пока не выполнялось")
        return date.toLocaleString(StateStore.read().config.lang === "en" ? "en-US" : "ru-RU")
    },

    resolveFolderByName(folderName) {
        const normalizedName = String(folderName || "").trim().toLocaleLowerCase()
        if (!normalizedName) return null
        return this.getExportableFoldersList().find(folder => String(folder.name || "").trim().toLocaleLowerCase() === normalizedName) || null
    },

    selectFolderForExport(callback) {
        const folders = this.getExportableFoldersList()
        if (!folders.length) {
            this.showToast(this.getText("folder_not_found", "Folder not found"))
            return
        }
        this.showPrompt(
            this.getText("export_folder_prompt_title", "Выберите папку для экспорта/резервной копии"),
            this.getText("export_folder_prompt_placeholder", "Введите точное название папки"),
            (value) => {
                const folder = this.resolveFolderByName(value)
                if (!folder) {
                    this.showToast(this.getText("export_folder_not_found", "Папка не найдена"))
                    return
                }
                callback(folder)
            }
        )
    },

    async backupAllNotesToDrive() {
        try {
            return await this.backupNotesBundleToDrive(this.getExportableNotes(), {
                scope: "all",
                emptyMessageKey: "export_empty",
                emptyFallback: "No notes available for export"
            })
        } catch (error) {
            console.error("Backup failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    async exportActiveFolderNotes(folderId = null) {
        const { activeFolderId, folders } = StateStore.read()
        const targetFolderId = folderId || activeFolderId
        if (!targetFolderId) return null
        const folder = folders.find(item => item.id === targetFolderId)
        try {
            return await this.exportNotesBundle(this.getExportableNotes(note => note.folderId === targetFolderId), {
                scope: "folder",
                folder,
                folders: folder ? [folder] : [],
                emptyMessageKey: "export_folder_empty",
                emptyFallback: "This folder has no notes to export"
            })
        } catch (error) {
            console.error("Export failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    async backupActiveFolderToDrive(folderId = null) {
        const { activeFolderId, folders } = StateStore.read()
        const targetFolderId = folderId || activeFolderId
        if (!targetFolderId) return null
        const folder = folders.find(item => item.id === targetFolderId)
        try {
            return await this.backupNotesBundleToDrive(this.getExportableNotes(note => note.folderId === targetFolderId), {
                scope: "folder",
                folder,
                folders: folder ? [folder] : [],
                emptyMessageKey: "export_folder_empty",
                emptyFallback: "This folder has no notes to export"
            })
        } catch (error) {
            console.error("Backup failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    exportFolderBySelection() {
        this.selectFolderForExport(folder => {
            this.exportActiveFolderNotes(folder.id)
        })
    },

    backupFolderBySelection() {
        this.selectFolderForExport(folder => {
            this.backupActiveFolderToDrive(folder.id)
        })
    },

    openNoteActionsFlow(noteId, options = {}) {
        const normalizedNoteId = String(noteId || "")
        if (!normalizedNoteId) return false
        const opener = typeof window.openNoteActions === "function" ? window.openNoteActions : null
        if (!opener) return false
        opener(normalizedNoteId, options)
        const modalElement = document.getElementById("note-actions-modal")
        const contentElement = document.getElementById("note-actions-content")
        const isVisible = !!modalElement && modalElement.classList.contains("active") && !modalElement.classList.contains("hidden") && document.body.contains(modalElement)
        const hasContent = !!contentElement && String(contentElement.innerHTML || "").trim().length > 0
        const opened = isVisible && hasContent
        if (!opened && options.showError !== false) {
            this.showToast(this.getText("note_actions_unavailable", "Unable to open note actions"))
        }
        return opened
    },

    canShowPrimaryAction(view = StateStore.read().view) {
        return new Set(["notes", "folder", "folders", "shared_access", "shared_workspace"]).has(String(view || "notes"))
    },

    primaryAction() {
        const currentView = StateStore.read().view
        if (!this.canShowPrimaryAction(currentView)) return
        if (currentView === "folders") {
            this.createFolder()
            return
        }
        if (currentView === "shared_access") {
            this.createSharedWorkspace()
            return
        }
        if (currentView === "shared_workspace") {
            const workspace = WorkspaceAccessService?.getWorkspaceById?.(StateStore.read().activeSharedWorkspaceId)
            if (!workspace || !WorkspaceAccessService?.canEditWorkspace?.(workspace)) {
                this.showToast(this.getText("share_manage_denied", "Permission denied"))
                return
            }
        }
        window.SmartNotesEditor?.open()
    },


    createSharedWorkspace() {
        this.showPrompt(this.getText("shared_workspace_create", "Новая совместная папка"), this.getText("shared_workspace_placeholder", "Название папки"), async (name, description) => {
            const normalizedName = String(name || "").trim()
            const normalizedDescription = String(description || "").trim()
            if (!normalizedName) {
                this.showToast(this.getText("folder_empty", "Введите название папки"))
                return
            }
            if (normalizedName.length > 50 || normalizedDescription.length > 300) {
                this.showToast(this.getText("shared_workspace_limits_error", "Проверьте длину названия и описания"))
                return
            }
            const workspace = await WorkspaceAccessService?.createWorkspace?.(normalizedName, normalizedDescription)
            if (!workspace) {
                this.showToast(this.getText("save_failed", "Save failed"))
                return
            }
            this.showToast(this.getText("shared_workspace_created", "Совместная папка создана"))
        }, "", {
            maxLength: 50,
            showCounter: true,
            secondaryField: {
                value: "",
                placeholder: this.getText("shared_workspace_description_placeholder", "Описание папки"),
                ariaLabel: this.getText("shared_workspace_description", "Описание"),
                showCounter: true,
                softLimit: 300,
                maxLength: 300
            }
        })
    },

    updateFolderLimitControls() {
        const createFolderButton = document.querySelector('[data-action="create-folder"]')
        if (!createFolderButton) return
        const canCreateFolder = window.Validators.canAddFolder(StateStore.read().folders.length)
        createFolderButton.disabled = !canCreateFolder
        createFolderButton.classList.toggle("is-disabled", !canCreateFolder)
    },

    createFolder() {
        if (!window.Validators.canAddFolder(StateStore.read().folders.length)) {
            return this.showToast(window.AppMessages.getAppMessage(this, window.AppMessages.APP_MESSAGES.folderLimitReached))
        }
        this.showPrompt(this.getText("new_folder", "New folder"), this.getText("folder_placeholder", "Folder name"), async (name, description) => {
            const validatedName = window.Validators.validateFolderName(name)
            const validatedDescription = window.Validators.validateFolderDescription(description)
            if (!String(name || "").trim()) return this.showToast(this.getText("folder_empty", "Enter a folder name"))
            if (!validatedName) return this.showToast(window.AppMessages.getAppMessage(this, window.AppMessages.APP_MESSAGES.folderNameTooLong))
            if (validatedDescription == null) return this.showToast(this.getText("folder_description_too_long", "Folder description must be up to 300 characters"))
            if (StateStore.read().folders.some(f => f.name && f.name.toLowerCase() === validatedName.toLowerCase())) {
                return this.showToast(this.getText("folder_exists", "Folder already exists"))
            }
            if (!db || !StateStore.read().user) return
            await DataPath.getUserFoldersCollection(StateStore.read().user).add({
                name: validatedName,
                description: validatedDescription,
                isHidden: false,
                trashedAt: null,
                folderOrder: Date.now(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                ownerUid: StateStore.read().user.uid
            })
        }, "", {
            maxLength: 50,
            showCounter: true,
            secondaryField: {
                value: "",
                placeholder: this.getText("folder_description_placeholder", "Describe what notes should go to this folder"),
                ariaLabel: this.getText("folder_description_label", "Folder description"),
                showCounter: true,
                softLimit: window.Validators.FOLDER_DESCRIPTION_SOFT_LIMIT,
                maxLength: window.Validators.FOLDER_DESCRIPTION_HARD_LIMIT
            }
        })
    },

    renameFolder(folderId) {
        const id = String(folderId || "")
        if (!id) return
        const folder = StateStore.read().folders.find(f => f.id === id)
        if (!folder) return
        this.showPrompt(this.getText("rename_folder", "Rename folder"), this.getText("folder_placeholder", "Folder name"), async (name, description) => {
            const validatedName = window.Validators.validateFolderName(name)
            const validatedDescription = window.Validators.validateFolderDescription(description)
            if (!String(name || "").trim()) return this.showToast(this.getText("folder_empty", "Enter a folder name"))
            if (!validatedName) return this.showToast(window.AppMessages.getAppMessage(this, window.AppMessages.APP_MESSAGES.folderNameTooLong))
            if (validatedDescription == null) return this.showToast(this.getText("folder_description_too_long", "Folder description must be up to 300 characters"))
            const sameName = validatedName.toLowerCase() === String(folder.name || "").toLowerCase()
            const sameDescription = validatedDescription === String(folder.description || "").trim()
            if (sameName && sameDescription) return
            if (StateStore.read().folders.some(f => f.id !== id && f.name && f.name.toLowerCase() === validatedName.toLowerCase())) {
                return this.showToast(this.getText("folder_exists", "Folder already exists"))
            }
            if (!db || !StateStore.read().user) return
            await DataPath.getUserFoldersCollection(StateStore.read().user).doc(id).update({
                name: validatedName,
                description: validatedDescription
            })
        }, String(folder.name || ""), {
            maxLength: 50,
            showCounter: true,
            secondaryField: {
                value: String(folder.description || ""),
                placeholder: this.getText("folder_description_placeholder", "Describe what notes should go to this folder"),
                ariaLabel: this.getText("folder_description_label", "Folder description"),
                showCounter: true,
                softLimit: window.Validators.FOLDER_DESCRIPTION_SOFT_LIMIT,
                maxLength: window.Validators.FOLDER_DESCRIPTION_HARD_LIMIT
            }
        })
    },

    applyAppearanceSettings() {
        const saved = SafeStorage.local.getJson("app-preferences") || {}
        StateActions.updateConfig({
            folderViewMode: saved.folderViewMode || StateStore.read().config.folderViewMode,
            reduceMotion: !!saved.reduceMotion
        })
        ThemeManager.revertToLastSaved()
        this.renderFolders()
        this.syncSettingsUI()
    },

    updateViewTitle() {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const titles = {
            notes: dict.view_notes || "Notes",
            favorites: dict.view_favorites || "Favorites",
            archive: dict.view_archive || "Archive",
            reminders: dict.view_reminders || "Reminders",
            trash: dict.trash || "Trash",
            folder: dict.view_folder || "Folder",
            folders: dict.view_folders || "Folders",
            locked: dict.view_locked || dict.lock_center || "Note Protection",
            hidden_folders: dict.hidden_folders || "Hidden folders",
            admin_tools: dict.admin_tools || "Admin tools",
            shared_access: dict.shared_access || "Совместный доступ",
            shared_workspace: dict.shared_workspace || "Совместная папка"
        }
        const { view, activeFolderId, activeSharedWorkspaceId, folders, sharedWorkspaces } = StateStore.read()
        let title = titles[view] || "SmartNotes"
        if (view === "folder" && activeFolderId) {
            const folder = folders.find(f => f.id === activeFolderId)
            if (folder) title = folder.name
        }
        if (view === "shared_workspace" && activeSharedWorkspaceId) {
            const workspace = (sharedWorkspaces || []).find(item => item.id === activeSharedWorkspaceId)
            if (workspace) title = workspace.name
        }
        const el = document.getElementById("current-view-title")
        if (el) el.textContent = title
        this.updateActiveFolderMenu()
        this.updateActiveWorkspaceMenu()
        this.updateTrashActionVisibility()
        this.updateFolderLimitControls()
        this.updateAdminToolsNavigationVisibility()
    },

    getTrashSummary() {
        const state = StateStore.read()
        const trashedNotes = Array.isArray(state.notes) ? state.notes.filter(note => !!note?.trashedAt) : []
        const trashedFolders = Array.isArray(state.folders) ? state.folders.filter(folder => !!folder?.trashedAt) : []
        return {
            notes: trashedNotes,
            folders: trashedFolders,
            totalCount: trashedNotes.length + trashedFolders.length
        }
    },

    updateTrashActionVisibility() {
        const clearTrashButton = this.els.clearTrashButton
        if (!clearTrashButton) return
        const isTrashView = StateStore.read().view === "trash"
        const trashSummary = this.getTrashSummary()
        clearTrashButton.classList.toggle("hidden", !isTrashView)
        clearTrashButton.disabled = trashSummary.totalCount === 0
        clearTrashButton.title = this.getText("clear_trash", "Clear trash")
        clearTrashButton.setAttribute("aria-label", this.getText("clear_trash", "Clear trash"))
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return
        const view = StateStore.read().view
        const label = view === "folders"
            ? this.getText("create_folder", "Create folder")
            : (view === "shared_access" ? this.getText("shared_workspace_create", "Новая совместная папка") : this.getText("create_note", "Create note"))
        this.els.fab.setAttribute("aria-label", label)
        this.els.fab.classList.toggle("hidden", !this.canShowPrimaryAction(view))
        this.updateActiveFolderMenu()
        this.updateActiveWorkspaceMenu()
        this.updateFolderLimitControls()
        this.updateAdminToolsNavigationVisibility()
    },

    handleMobileBackNavigation() {
        const editorOverlay = document.getElementById("note-editor")
        if (editorOverlay?.classList.contains("active")) {
            window.SmartNotesEditor?.close?.()
            return true
        }
        const activeModal = Array.from(document.querySelectorAll(".modal-overlay.active")).pop()
        if (activeModal) {
            if (activeModal.id === "settings-modal") {
                this.requestCloseSettingsModal()
            } else {
                this.closeModal(activeModal.id)
            }
            return true
        }
        if (this.els.sidebar?.classList.contains("active")) {
            this.toggleSidebar(false)
            return true
        }
        const currentView = StateStore.read().view
        if (currentView === "shared_workspace") {
            switchView("shared_access")
            return true
        }
        if (currentView !== "notes") {
            switchView("notes")
            return true
        }
        return false
    },

    updateNotesLoadMoreButton(loadMoreState) {
        const loadMoreButton = document.getElementById("load-more-notes-button")
        if (!loadMoreButton) return
        const state = loadMoreState || { hasMoreItems: false, isLoading: false }
        loadMoreButton.disabled = !!state.isLoading
        loadMoreButton.classList.toggle("hidden", !state.hasMoreItems)
    },


    async setFolderHidden(folderId, hiddenState) {
        const user = StateStore.read().user
        if (!db || !user || !folderId) return
        await DataPath.getUserFoldersCollection(user).doc(folderId).update({ isHidden: !!hiddenState })
    },

    async toggleFolderHidden(folderId, options = {}) {
        const folder = StateStore.read().folders.find(item => item.id === folderId)
        if (!folder) return
        const nextHiddenState = !folder.isHidden
        if (nextHiddenState && !options.skipConfirmation) {
            this.confirm("hide_f", () => this.setFolderHidden(folderId, true))
            return
        }
        await this.setFolderHidden(folderId, nextHiddenState)
    },

    async reorderFolders(draggedFolderId, targetFolderId) {
        const user = StateStore.read().user
        if (!db || !user || !draggedFolderId || !targetFolderId || draggedFolderId === targetFolderId) return
        const folders = StateStore.read().folders.filter(folder => !folder.trashedAt).sort((a, b) => (a.folderOrder || 0) - (b.folderOrder || 0))
        const fromIndex = folders.findIndex(folder => folder.id === draggedFolderId)
        const toIndex = folders.findIndex(folder => folder.id === targetFolderId)
        if (fromIndex < 0 || toIndex < 0) return
        const reordered = folders.slice()
        const [dragged] = reordered.splice(fromIndex, 1)
        reordered.splice(toIndex, 0, dragged)
        const batch = db.batch()
        reordered.forEach((folder, index) => {
            const ref = DataPath.getUserFoldersCollection(user).doc(folder.id)
            batch.update(ref, { folderOrder: index + 1 })
        })
        await batch.commit()
    },

    toggleActiveWorkspaceMenu(force) {
        const menu = this.els.activeWorkspaceMenu
        if (!menu) return
        menu.classList.toggle("active", typeof force === "boolean" ? force : !menu.classList.contains("active"))
    },


    async openWorkspaceMembersModal() {
        const workspace = WorkspaceAccessService?.getWorkspaceById?.(StateStore.read().activeSharedWorkspaceId)
        if (!workspace) return
        const root = document.getElementById("workspace-members-content")
        if (!root) return
        const canManage = WorkspaceAccessService?.canManageWorkspace?.(workspace)
        const members = WorkspaceAccessService?.getWorkspaceMembers?.(workspace.id) || []
        if (!members.length) {
            const empty = document.createElement("div")
            empty.className = "folder-meta"
            window.DomSecurity.setText(empty, this.getText("shared_members_empty", "Пока нет участников"))
            root.replaceChildren(empty)
            this.openModal("workspace-members-modal")
            return
        }
        const fragment = document.createDocumentFragment()
        members.forEach(member => {
            const row = document.createElement("div")
            row.className = "shared-member-row"
            const uidLabel = document.createElement("div")
            uidLabel.className = "shared-member-uid"
            window.DomSecurity.setText(uidLabel, member.uid)

            const nameGroup = document.createElement("div")
            nameGroup.className = "shared-member-field"
            const nameLabel = document.createElement("div")
            nameLabel.className = "shared-member-field-label"
            window.DomSecurity.setText(nameLabel, this.getText("display_name", "Отображаемое имя"))
            const nameInput = document.createElement("input")
            nameInput.type = "text"
            nameInput.className = "input-area"
            nameInput.maxLength = 50
            nameInput.value = member.displayName || member.uid
            nameInput.disabled = !canManage && member.uid !== StateStore.read().user?.uid
            nameGroup.append(nameLabel, nameInput)

            const roleGroup = document.createElement("div")
            roleGroup.className = "shared-member-field"
            const roleLabel = document.createElement("div")
            roleLabel.className = "shared-member-field-label"
            window.DomSecurity.setText(roleLabel, this.getText("workspace_access_level", "Права"))
            const roleSelect = document.createElement("select")
            roleSelect.className = "input-area"
            const options = [
                { value: "viewer", label: this.getText("role_viewer", "Читатель") },
                { value: "editor", label: this.getText("role_editor", "Редактор") },
                { value: "owner", label: this.getText("role_owner", "Полный доступ") }
            ]
            options.forEach(optionData => {
                const option = document.createElement("option")
                option.value = optionData.value
                option.textContent = optionData.label
                roleSelect.append(option)
            })
            roleSelect.value = member.role
            roleSelect.disabled = !canManage || member.uid === workspace.ownerUid
            roleGroup.append(roleLabel, roleSelect)

            const saveButton = document.createElement("button")
            saveButton.type = "button"
            saveButton.className = "btn-secondary"
            window.DomSecurity.setText(saveButton, this.getText("save", "Сохранить"))
            saveButton.onclick = async () => {
                const nextName = String(nameInput.value || "").trim()
                if (nextName && nextName.length <= 50) {
                    await WorkspaceAccessService.updateMemberDisplayName(workspace.id, member.uid, nextName)
                }
                if (canManage && member.uid !== workspace.ownerUid) {
                    await WorkspaceAccessService.updateMemberRole(workspace.id, member.uid, roleSelect.value)
                }
                this.showToast(this.getText("saved", "Сохранено"))
            }

            const removeButton = document.createElement("button")
            removeButton.type = "button"
            removeButton.className = "btn-danger"
            window.DomSecurity.setText(removeButton, this.getText("remove_member", "Удалить"))
            removeButton.disabled = !canManage || member.uid === workspace.ownerUid
            removeButton.onclick = async () => {
                const ok = await WorkspaceAccessService.removeMember(workspace.id, member.uid)
                if (!ok) return
                row.remove()
                this.showToast(this.getText("saved", "Сохранено"))
            }

            row.append(uidLabel, nameGroup, roleGroup, saveButton, removeButton)
            fragment.append(row)
        })
        root.replaceChildren(fragment)
        this.openModal("workspace-members-modal")
    },

        renameActiveWorkspace() {
        const workspace = WorkspaceAccessService?.getWorkspaceById?.(StateStore.read().activeSharedWorkspaceId)
        if (!workspace || !WorkspaceAccessService?.canManageWorkspace?.(workspace)) return
        this.showPrompt(this.getText("rename_workspace", "Переименовать папку"), this.getText("shared_workspace_placeholder", "Название папки"), async name => {
            const normalizedName = String(name || "").trim()
            if (!normalizedName || normalizedName.length > 50) return
            const ok = await WorkspaceAccessService.updateWorkspace(workspace.id, { name: normalizedName })
            this.showToast(ok ? this.getText("saved", "Сохранено") : this.getText("save_failed", "Save failed"))
        }, String(workspace.name || ""), { maxLength: 50, showCounter: true })
    },

    editActiveWorkspaceDescription() {
        const workspace = WorkspaceAccessService?.getWorkspaceById?.(StateStore.read().activeSharedWorkspaceId)
        if (!workspace || !WorkspaceAccessService?.canManageWorkspace?.(workspace)) return
        this.showPrompt(this.getText("edit_workspace_description", "Изменить описание"), this.getText("shared_workspace_description_placeholder", "Описание папки"), async value => {
            const normalized = String(value || "").trim()
            if (normalized.length > 300) return
            const ok = await WorkspaceAccessService.updateWorkspace(workspace.id, { description: normalized })
            this.showToast(ok ? this.getText("saved", "Сохранено") : this.getText("save_failed", "Save failed"))
        }, String(workspace.description || ""), { maxLength: 300, showCounter: true })
    },

    toggleActiveFolderMenu(force) {
        const menu = this.els.activeFolderMenu
        if (!menu) return
        menu.classList.toggle("active", typeof force === "boolean" ? force : !menu.classList.contains("active"))
    },


    isStandaloneAppMode() {
        const displayModeStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches
        return !!(displayModeStandalone || window.navigator.standalone)
    },

    isIosBrowserInstallAvailable() {
        return document.body.classList.contains("platform-ios") && !this.isStandaloneAppMode()
    },

    getAnalysisApiEndpoint() {
        return "https://backendfornmartnotes.vercel.app/api/analyze"
    },

    async requestAnalysis({ secretToken = "", requestVariant = "pending" } = {}) {
        const requestHeaders = {
            "Content-Type": "application/json"
        }
        if (secretToken) {
            requestHeaders["x-secret"] = secretToken
        }

        let endpoint = this.getAnalysisApiEndpoint()
        let requestBody = {}

        if (requestVariant === "reindex_query") {
            endpoint = `${endpoint}?reindexAll=true`
            requestBody = null
        } else if (requestVariant === "reindex_body") {
            requestBody = { reindexAll: true }
        } else if (requestVariant === "reindex_force") {
            requestBody = { forceReindex: true }
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: requestHeaders,
            body: requestBody === null ? null : JSON.stringify(requestBody)
        })
        if (!response.ok) {
            throw new Error(`Analysis request failed with status ${response.status}`)
        }
        const responseData = await response.json().catch(() => ({}))
        return responseData
    },

    hasSmartNotesFolderAccess() {
        const currentUserUid = String(StateStore.read().user?.uid || "")
        if (!currentUserUid) return false
        return StateStore.read().folders.some(folder => String(folder.name || "").trim().toLowerCase() === "smartnotes")
    },

    updateAdminToolsNavigationVisibility() {
        const adminToolsButton = this.els.adminToolsNavButton
        if (!adminToolsButton) return
        const canShowAdminTools = this.hasSmartNotesFolderAccess() && !!StateStore.read().user?.uid
        adminToolsButton.classList.toggle("hidden", !canShowAdminTools)
        if (!canShowAdminTools && StateStore.read().view === "admin_tools") {
            switchView("notes")
        }
    },

    renderAdminToolsView() {
        const root = this.els.grid
        if (!root) return
        this.els.empty.classList.add("hidden")
        this.els.grid.classList.remove("folder-grid")
        const actionCard = document.createElement("div")
        actionCard.className = "note-card"

        const title = document.createElement("h3")
        window.DomSecurity.setText(title, this.getText("admin_tools", "Админ-меню"))

        const description = document.createElement("p")
        window.DomSecurity.setText(description, this.getText("analysis_admin_description", "Запуск серверного анализа заметок"))

        const actions = [
            { key: "pending", className: "btn-primary", action: "trigger-admin-analysis-pending", labelKey: "analysis_pending_reindex_button", fallback: "Проиндексировать непроиндексированные" },
            { key: "reindex_query", className: "btn-secondary", action: "trigger-admin-analysis-reindex-query", labelKey: "analysis_reindex_query_button", fallback: "Полная переиндексация через query-параметр" },
            { key: "reindex_body", className: "btn-secondary", action: "trigger-admin-analysis-reindex-body", labelKey: "analysis_reindex_body_button", fallback: "Полная переиндексация через body reindexAll" },
            { key: "reindex_force", className: "btn-secondary", action: "trigger-admin-analysis-reindex-force", labelKey: "analysis_force_reindex_button", fallback: "Полная переиндексация через body forceReindex" }
        ]

        const buttonsContainer = document.createElement("div")
        buttonsContainer.style.display = "grid"
        buttonsContainer.style.gridTemplateColumns = "1fr"
        buttonsContainer.style.gap = "10px"
        buttonsContainer.style.marginTop = "10px"

        actions.forEach(actionConfig => {
            const actionButton = document.createElement("button")
            actionButton.type = "button"
            actionButton.className = actionConfig.className
            actionButton.dataset.action = actionConfig.action
            actionButton.dataset.analysisVariant = actionConfig.key
            window.DomSecurity.setText(actionButton, this.getText(actionConfig.labelKey, actionConfig.fallback))
            buttonsContainer.append(actionButton)
        })

        actionCard.append(title, description, buttonsContainer)
        root.replaceChildren(actionCard)
    },

    async markNoteForReanalysis(noteId = "") {
        const user = StateStore.read().user
        const normalizedNoteId = String(noteId || "")
        if (!db || !user?.uid || !normalizedNoteId) {
            this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
            return
        }
        try {
            const noteReference = DataPath.getUserNotesCollection(user)?.doc(normalizedNoteId)
            if (!noteReference) {
                this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
                return
            }
            await noteReference.update({
                analyzed: false,
                aiProcessed: false,
                tags: [],
                hiddenTags: [],
                relevance: null,
                folderId: null
            })
            this.showToast(this.getText("analysis_marked_for_reanalysis", "Заметка отмечена для повторного анализа"))
            this.closeModal("note-actions-modal")
        } catch {
            this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
        }
    },
    async triggerAnalysisRequest(analysisVariant = "pending", actionName = "") {
        const secretToken = window.prompt(this.getText("analysis_admin_secret_prompt", "Введите admin secret"), "")
        if (!secretToken) return
        const normalizedActionName = String(actionName || "")
        const triggerButton = normalizedActionName ? document.querySelector(`[data-action="${normalizedActionName}"]`) : null
        const initialLabel = triggerButton ? triggerButton.textContent : ""
        if (triggerButton) {
            triggerButton.disabled = true
            triggerButton.setAttribute("aria-busy", "true")
            window.DomSecurity.setText(triggerButton, this.getText("loading", "Loading..."))
        }
        try {
            await this.requestAnalysis({ secretToken, requestVariant: analysisVariant })
            this.showToast(this.getText("analysis_request_sent", "Запрос отправлен. Анализ выполнится на стороне сервера"))
        } catch {
            this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
        } finally {
            if (triggerButton) {
                triggerButton.disabled = false
                triggerButton.setAttribute("aria-busy", "false")
                window.DomSecurity.setText(triggerButton, initialLabel || this.getText("analysis_pending_reindex_button", "Проиндексировать непроиндексированные"))
            }
        }
    },


    updateActiveWorkspaceMenu() {
        const wrapper = this.els.activeWorkspaceMenuWrapper
        if (!wrapper) return
        const state = StateStore.read()
        const isVisible = state.view === "shared_workspace" && !!state.activeSharedWorkspaceId
        wrapper.classList.toggle("hidden", !isVisible)
        if (!isVisible) {
            this.toggleActiveWorkspaceMenu(false)
            return
        }
        const workspace = WorkspaceAccessService?.getWorkspaceById?.(state.activeSharedWorkspaceId)
        const canManage = !!workspace && WorkspaceAccessService?.canManageWorkspace?.(workspace)
        if (this.els.workspaceCopyLinkButton) this.els.workspaceCopyLinkButton.classList.toggle("hidden", !canManage)
        if (this.els.workspaceAddUserButton) this.els.workspaceAddUserButton.classList.toggle("hidden", !canManage)
        if (this.els.workspaceRenameButton) this.els.workspaceRenameButton.classList.toggle("hidden", !canManage)
        if (this.els.workspaceEditDescriptionButton) this.els.workspaceEditDescriptionButton.classList.toggle("hidden", !canManage)
    },

    updateActiveFolderMenu() {
        const wrapper = this.els.activeFolderMenuWrapper
        const hideLabel = this.els.activeFolderHideButton?.querySelector("span")
        const hideIcon = this.els.activeFolderHideButton?.querySelector("i")
        if (!wrapper) return
        const { view, activeFolderId, activeSharedWorkspaceId, folders, sharedWorkspaces } = StateStore.read()
        const isVisible = view === "folder" && !!activeFolderId
        wrapper.classList.toggle("hidden", !isVisible)
        if (!isVisible) {
            this.toggleActiveFolderMenu(false)
            return
        }
        const folder = folders.find(item => item.id === activeFolderId)
        if (!folder) return
        if (hideLabel) hideLabel.textContent = folder.isHidden ? this.getText("show_folder", "Show folder") : this.getText("hide_folder", "Hide folder")
        if (hideIcon) hideIcon.textContent = folder.isHidden ? "visibility" : "visibility_off"
    }
})
