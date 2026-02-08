async function deleteFolder(folderId) {
    if (!folderId) return
    UI.confirm("delete_f", async () => {
        const user = StateStore.read().user
        if (!db || !user) return

        const notes = StateStore.read().notes.filter(n => n.folderId === folderId)
        const batch = db.batch()

        notes.forEach(n => {
            const ref = db.collection("users").doc(user.uid).collection("notes").doc(n.id)
            batch.update(ref, { folderId: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        })

        const folderRef = db.collection("users").doc(user.uid).collection("folders").doc(folderId)
        batch.delete(folderRef)

        await batch.commit()

        if (StateStore.read().activeFolderId === folderId) {
            switchView("notes")
        }
        UI.showToast(UI.getText("folder_deleted", "Folder deleted"))
    })
}

const getNoteById = (noteId) => StateStore.read().notes.find(n => n.id === noteId)

const ensureManageAccess = (note) => {
    if (!note) return false
    if (typeof CollaborationService === "undefined" || CollaborationService.canManage(note)) return true
    UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
    return false
}

const getNoteReference = (note, user) => {
    if (typeof CollaborationService !== "undefined") return CollaborationService.getNoteReference(note, user)
    return db.collection("users").doc(user.uid).collection("notes").doc(note.id)
}

function openNoteActions(noteId) {
    const note = getNoteById(noteId)
    if (!note || isHiddenLocked(note)) return
    UI.currentNoteActionId = noteId
    UI.renderNoteActions(noteId)
    UI.openModal("note-actions-modal")
}

async function deleteNoteById(noteId) {
    const note = getNoteById(noteId)
    if (!note) return
    if (!ensureManageAccess(note)) return
    UI.confirm("delete", async () => {
        if (!db || !StateStore.read().user) return
        const ref = getNoteReference(note, StateStore.read().user)
        if (!ref) return
        await ref.delete()
        UI.showToast(UI.getText("note_deleted", "Deleted"))
        UI.closeModal("note-actions-modal")
    })
}

async function scheduleFutureNote(noteId) {
    const user = StateStore.read().user
    if (!db || !user) return
    const note = getNoteById(noteId)
    if (!ensureManageAccess(note)) return
    const input = document.querySelector(`.note-future-input[data-note-id="${encodeURIComponent(noteId)}"]`)
    const value = input ? input.value : ""
    if (!value) {
        UI.showToast(UI.getText("future_required", "Pick a date"))
        return
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        UI.showToast(UI.getText("future_required", "Pick a date"))
        return
    }
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({
        futureAt: date.toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    UI.showToast(UI.getText("future_saved", "Scheduled"))
    UI.closeModal("note-actions-modal")
}

async function clearFutureNote(noteId) {
    const user = StateStore.read().user
    if (!db || !user) return
    const note = getNoteById(noteId)
    if (!ensureManageAccess(note)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({
        futureAt: null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    UI.showToast(UI.getText("future_cleared", "Schedule cleared"))
    UI.closeModal("note-actions-modal")
}

async function copyNoteTextById(noteId) {
    const note = getNoteById(noteId)
    if (!note) return
    if (note.lock?.hash) {
        UI.showToast(UI.getText("lock_download_blocked", "Note is locked"))
        return
    }
    const text = Utils.stripHtml(note.content || "")
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text)
        } else {
            const textarea = document.createElement("textarea")
            textarea.value = text
            textarea.setAttribute("readonly", "true")
            textarea.style.position = "fixed"
            textarea.style.opacity = "0"
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand("copy")
            document.body.removeChild(textarea)
        }
        UI.showToast(UI.getText("copy_success", "Copied"))
        UI.closeModal("note-actions-modal")
    } catch {
        UI.showToast(UI.getText("copy_failed", "Copy failed"))
    }
}

async function toggleFavorite(noteId) {
    const note = getNoteById(noteId)
    if (!note) return
    if (isHiddenLocked(note)) return

    const nextValue = !note.isFavorite
    const nextNotes = StateStore.read().notes.map(n => n.id === noteId ? { ...n, isFavorite: nextValue } : n)
    StateActions.setNotes(nextNotes)
    NotesStorage.syncFavoritesStorage(nextNotes)
    filterAndRender(document.getElementById("search-input")?.value || "")

    const user = StateStore.read().user
    if (!db || !user) return

    if (typeof CollaborationService !== "undefined" && CollaborationService.isSharedNote(note)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    try {
        await ref.update({
            isFavorite: nextValue
        })
    } catch (error) {
        const revertedNotes = StateStore.read().notes.map(n => n.id === noteId ? { ...n, isFavorite: note.isFavorite } : n)
        StateActions.setNotes(revertedNotes)
        NotesStorage.syncFavoritesStorage(revertedNotes)
        filterAndRender(document.getElementById("search-input")?.value || "")
        UI.showToast(UI.getText("favorite_failed", "Unable to update favorite"))
        console.error("Favorite update failed", error)
    }
}

async function togglePin(noteId, options = {}) {
    const user = StateStore.read().user
    if (!db || !user) return

    const note = getNoteById(noteId)
    if (!note) return
    if (!ensureManageAccess(note)) return
    if (isHiddenLocked(note) && !options.allowLocked) return

    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({
        isPinned: !note.isPinned
    })

    const card = document.querySelector(`.note-card[data-note-id="${encodeURIComponent(noteId)}"]`)
    if (card) {
        card.classList.add("pinning")
        setTimeout(() => card.classList.remove("pinning"), 520)
    }
}

async function toggleArchive(noteId, archive, options = {}) {
    const user = StateStore.read().user
    if (!db || !user) return

    const note = getNoteById(noteId)
    if (!note) return
    if (!ensureManageAccess(note)) return
    if (isHiddenLocked(note) && !options.allowLocked) return

    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({
        isArchived: !!archive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })

    UI.showToast(archive ? UI.getText("archived", "Archived") : UI.getText("restored", "Restored"))
}

async function moveNoteToFolder(noteId, folderId, options = {}) {
    const user = StateStore.read().user
    if (!db || !user) return
    const note = getNoteById(noteId)
    if (!note) return
    if (!ensureManageAccess(note)) return
    if (isHiddenLocked(note) && !options.allowLocked) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({
        folderId: folderId || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
}

async function shareNoteLink(noteId, permission) {
    const note = getNoteById(noteId)
    if (!note) return
    if (typeof CollaborationService === "undefined") {
        UI.showToast(UI.getText("share_link_failed", "Unable to share"))
        return
    }
    if (!ensureManageAccess(note)) return
    const link = await CollaborationService.createShareLink(note, permission)
    if (!link) {
        UI.showToast(UI.getText("share_link_failed", "Unable to share"))
        return
    }
    const copied = await CollaborationService.copyToClipboard(link)
    UI.showToast(copied ? UI.getText("share_link_copied", "Link copied") : UI.getText("share_link_failed", "Unable to share"))
    UI.closeModal("note-actions-modal")
    UI.showPrompt(UI.getText("share_link_title", "Share link"), UI.getText("share_link_placeholder", "Copy the link"), () => null, link)
}

async function shareNoteView(noteId) {
    await shareNoteLink(noteId, "view")
}

async function shareNoteEdit(noteId) {
    await shareNoteLink(noteId, "edit")
}

window.deleteFolder = deleteFolder
window.openNoteActions = openNoteActions
window.deleteNoteById = deleteNoteById
window.scheduleFutureNote = scheduleFutureNote
window.clearFutureNote = clearFutureNote
window.copyNoteTextById = copyNoteTextById
window.toggleFavorite = toggleFavorite
window.togglePin = togglePin
window.toggleArchive = toggleArchive
window.moveNoteToFolder = moveNoteToFolder
window.shareNoteView = shareNoteView
window.shareNoteEdit = shareNoteEdit
