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
            await DataPath.getUserNotesCollection(StateStore.read().user).doc(id).update({
                "lock.hidden": false
            })
        } catch (error) {
            this.showToast(this.getText("unlock_failed", "Unable to unlock"))
            console.error("Unlock failed", error)
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
            await DataPath.getUserNotesCollection(StateStore.read().user).doc(id).update(payload)
        } catch (error) {
            this.showToast(this.getText("unlock_failed", "Unable to unlock note"))
            console.error("Unlock failed", error)
        }
    }
})
