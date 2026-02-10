async function deleteFolder(folderId) {
    if (!folderId) return
    UI.confirm("delete_f", async () => {
        const user = StateStore.read().user
        if (!db || !user) return
        const foldersCollection = DataPath.getUserFoldersCollection(user)
        const notesCollection = DataPath.getUserNotesCollection(user)
        const movedAt = firebase.firestore.FieldValue.serverTimestamp()
        const folderRef = foldersCollection.doc(folderId)
        const notesSnapshot = await notesCollection.where("folderId", "==", folderId).get()
        const batch = db.batch()
        notesSnapshot.forEach(noteDoc => {
            batch.update(noteDoc.ref, {
                folderId: null,
                trashedAt: movedAt,
                updatedAt: movedAt
            })
        })
        batch.update(folderRef, { trashedAt: movedAt, isHidden: false })
        await batch.commit()
        if (StateStore.read().activeFolderId === folderId) switchView("notes")
        UI.showToast(UI.getText("folder_deleted", "Folder moved to trash"))
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
    return DataPath.getUserNotesCollection(user).doc(note.id)
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
    if (!note || !ensureManageAccess(note)) return
    UI.closeModal("note-actions-modal")
    UI.confirm("delete", async () => {
        const user = StateStore.read().user
        if (!db || !user) return
        const ref = getNoteReference(note, user)
        if (!ref) return
        if (note.trashedAt) {
            await ref.delete()
            UI.showToast(UI.getText("note_deleted_permanent", "Deleted permanently"))
            return
        }
        await ref.update({ trashedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        UI.showToast(UI.getText("note_deleted", "Moved to trash"))
    })
}

async function restoreNoteById(noteId) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({ trashedAt: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    UI.showToast(UI.getText("restored", "Restored"))
}

async function scheduleReminder(noteId) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note)) return
    const input = document.querySelector(`.note-reminder-input[data-note-id="${encodeURIComponent(noteId)}"]`)
    const value = input ? input.value : ""
    const date = new Date(value)
    if (!value || Number.isNaN(date.getTime())) {
        UI.showToast(UI.getText("future_required", "Pick date and time"))
        return
    }
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({ reminderAt: date.toISOString(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    UI.showToast(UI.getText("future_saved", "Reminder saved"))
    UI.closeModal("note-actions-modal")
}

async function clearReminder(noteId) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({ reminderAt: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    UI.showToast(UI.getText("future_cleared", "Reminder cleared"))
    UI.closeModal("note-actions-modal")
}

async function copyNoteTextById(noteId) {
    const note = getNoteById(noteId)
    if (!note) return
    if (note.lock?.hash) return UI.showToast(UI.getText("lock_download_blocked", "Note is locked"))
    const text = Utils.stripHtml(note.content || "")
    try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
        UI.showToast(UI.getText("copy_success", "Copied"))
        UI.closeModal("note-actions-modal")
    } catch {
        UI.showToast(UI.getText("copy_failed", "Copy failed"))
    }
}

async function toggleFavorite(noteId) {
    const note = getNoteById(noteId)
    if (!note || isHiddenLocked(note)) return
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
        await ref.update({ isFavorite: nextValue })
    } catch {
        StateActions.setNotes(StateStore.read().notes.map(n => n.id === noteId ? { ...n, isFavorite: note.isFavorite } : n))
    }
}

async function togglePin(noteId, options = {}) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note) || (isHiddenLocked(note) && !options.allowLocked)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({ isPinned: !note.isPinned })
}

async function toggleArchive(noteId, archive, options = {}) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note) || (isHiddenLocked(note) && !options.allowLocked)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({ isArchived: !!archive, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    UI.showToast(archive ? UI.getText("archived", "Archived") : UI.getText("restored", "Restored"))
}

async function moveNoteToFolder(noteId, folderId, options = {}) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note) || (isHiddenLocked(note) && !options.allowLocked)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({ folderId: folderId || null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
}


async function restoreFolderById(folderId) {
    const user = StateStore.read().user
    if (!db || !user || !folderId) return
    await DataPath.getUserFoldersCollection(user).doc(folderId).update({ trashedAt: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    UI.showToast(UI.getText("restored", "Restored"))
}

async function deleteFolderPermanently(folderId) {
    const user = StateStore.read().user
    if (!db || !user || !folderId) return
    await DataPath.getUserFoldersCollection(user).doc(folderId).delete()
    UI.showToast(UI.getText("folder_deleted_permanent", "Folder deleted permanently"))
}
window.deleteFolder = deleteFolder
window.openNoteActions = openNoteActions
window.deleteNoteById = deleteNoteById
window.restoreNoteById = restoreNoteById
window.scheduleReminder = scheduleReminder
window.clearReminder = clearReminder
window.copyNoteTextById = copyNoteTextById
window.toggleFavorite = toggleFavorite
window.togglePin = togglePin
window.toggleArchive = toggleArchive
window.moveNoteToFolder = moveNoteToFolder
window.restoreFolderById = restoreFolderById
window.deleteFolderPermanently = deleteFolderPermanently
