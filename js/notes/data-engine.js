"use strict";

const FAVORITES_STORAGE_KEY = "favorite-notes"
const NOTES_FILTER_KEY = "notes-filter"
const SAVED_NOTES_FILTERS_KEY = "saved-notes-filters"
const NOTES_CACHE_KEY = "notes-cache"

const getRefs = () => window.InfraEngine?.getRefs?.() || window.DataPath

const shrinkNoteForCache = (note) => {
    const normalizedNote = NoteIO.normalizeNote(note || {})
    return {
        id: String(normalizedNote.id || ""),
        title: String(normalizedNote.title || ""),
        folderId: normalizedNote.folderId ? String(normalizedNote.folderId) : null,
        order: Number.isFinite(normalizedNote.order) ? normalizedNote.order : null,
        createdAt: normalizedNote.createdAt || null,
        updatedAt: normalizedNote.updatedAt || null,
        isFavorite: !!normalizedNote.isFavorite,
        isPinned: !!normalizedNote.isPinned,
        isArchived: !!normalizedNote.isArchived,
        trashedAt: normalizedNote.trashedAt || null,
        reminderAt: normalizedNote.reminderAt || null,
        lockHidden: !!(normalizedNote.lock && normalizedNote.lock.hidden)
    }
}

const readFavoriteIds = () => {
    const storedFavorites = SafeStorage.local.getJson(FAVORITES_STORAGE_KEY)
    if (Array.isArray(storedFavorites)) return new Set(storedFavorites)
    return new Set()
}

const writeFavoriteIds = (ids) => {
    SafeStorage.local.setJson(FAVORITES_STORAGE_KEY, [...ids])
}

const syncFavoritesStorage = (notes) => {
    const favoriteIds = new Set()
    notes.forEach((note) => {
        if (note.isFavorite) favoriteIds.add(note.id)
    })
    writeFavoriteIds(favoriteIds)
}

const applyStoredFavorites = (notes) => {
    const storedFavorites = readFavoriteIds()
    if (!storedFavorites.size) return notes
    return notes.map((note) => {
        if (typeof note.isFavorite !== "boolean" && storedFavorites.has(note.id)) {
            return { ...note, isFavorite: true }
        }
        return note
    })
}

const loadNotesFilter = () => {
    const storedFilter = SafeStorage.local.getJson(NOTES_FILTER_KEY)
    if (storedFilter && typeof storedFilter === "object") {
        const currentFilter = normalizeNotesFilter(StateStore.read().config.notesFilter || { sort: "manual", folders: [], tags: [], updatedWindowDays: 0 })
        StateActions.updateConfig({ notesFilter: normalizeNotesFilter({ ...currentFilter, ...storedFilter }) })
    }
}

const normalizeNotesFilter = (filter) => {
    const source = filter && typeof filter === "object" ? filter : {}
    const allowedSortValues = new Set(["updated", "relevance", "importance", "title", "length", "manual"])
    const allowedDateWindowValues = new Set([0, 1, 7, 30, 365])
    const parsedUpdatedWindowDays = Number(source.updatedWindowDays)
    return {
        sort: allowedSortValues.has(String(source.sort || "")) ? String(source.sort) : "manual",
        folders: Array.isArray(source.folders)
            ? [...new Set(source.folders.map(value => String(value || "").trim()).filter(Boolean))]
            : [],
        tags: Array.isArray(source.tags)
            ? [...new Set(source.tags.map(value => String(value || "").trim()).filter(Boolean))]
            : [],
        updatedWindowDays: allowedDateWindowValues.has(parsedUpdatedWindowDays) ? parsedUpdatedWindowDays : 0
    }
}

const normalizeSavedNotesFilter = (savedFilter) => {
    const source = savedFilter && typeof savedFilter === "object" ? savedFilter : {}
    const normalizedConfig = normalizeNotesFilter(source)
    const id = String(source.id || "").trim()
    const name = String(source.name || "").trim()
    if (!id || !name) return null
    return {
        id,
        name,
        sort: normalizedConfig.sort,
        folders: normalizedConfig.folders,
        tags: normalizedConfig.tags,
        updatedWindowDays: normalizedConfig.updatedWindowDays,
        createdAt: Number(source.createdAt || Date.now())
    }
}

const readSavedNotesFilters = () => {
    const stored = SafeStorage.local.getJson(SAVED_NOTES_FILTERS_KEY, [])
    if (!Array.isArray(stored)) return []
    return stored
        .map(normalizeSavedNotesFilter)
        .filter(Boolean)
        .sort((firstItem, secondItem) => String(firstItem.name || "").localeCompare(String(secondItem.name || ""), StateStore.read().config.lang || "ru"))
}

const writeSavedNotesFilters = (savedFilters) => {
    const normalized = (Array.isArray(savedFilters) ? savedFilters : [])
        .map(normalizeSavedNotesFilter)
        .filter(Boolean)
    SafeStorage.local.setJson(SAVED_NOTES_FILTERS_KEY, normalized)
    return normalized
}

const readCachedNotes = (uid) => {
    if (!uid) return []
    const allCaches = SafeStorage.local.getJson(NOTES_CACHE_KEY) || {}
    const userCache = allCaches[uid]
    if (!Array.isArray(userCache?.notes)) return []
    return userCache.notes.map((note) => NoteIO.normalizeNote(note))
}

const writeCachedNotes = (uid, notes) => {
    if (!uid || !Array.isArray(notes)) return
    const tryWrite = (limit) => {
        const allCaches = SafeStorage.local.getJson(NOTES_CACHE_KEY) || {}
        const sanitizedNotes = notes.slice(0, limit).map(shrinkNoteForCache)
        allCaches[uid] = { updatedAt: Date.now(), notes: sanitizedNotes }

        const entries = Object.entries(allCaches)
            .sort((firstEntry, secondEntry) => (secondEntry[1]?.updatedAt || 0) - (firstEntry[1]?.updatedAt || 0))
            .slice(0, 3)

        const nextCache = Object.fromEntries(entries)
        return SafeStorage.local.setJson(NOTES_CACHE_KEY, nextCache)
    }

    if (tryWrite(120).success) return
    if (tryWrite(40).success) return

    SafeStorage.local.remove(NOTES_CACHE_KEY)
}

loadNotesFilter()

window.NotesStorage = {
    applyStoredFavorites,
    syncFavoritesStorage,
    loadNotesFilter,
    normalizeNotesFilter,
    readSavedNotesFilters,
    writeSavedNotesFilters,
    readCachedNotes,
    writeCachedNotes
}



function updateSearchQuery(query) {
    const queryValue = String(query || "")
    if (StateStore.read().searchQuery === queryValue) return
    StateStore.update("searchQuery", queryValue)
}

function switchView(view, folderId = null, sharedWorkspaceId = null) {
    const currentState = StateStore.read()
    const nextView = String(view || "notes")
    const nextFolderId = nextView === "folder" ? folderId : null
    const nextWorkspaceId = nextView === "shared_workspace" ? sharedWorkspaceId : null
    if (currentState.view === nextView && currentState.activeFolderId === nextFolderId && currentState.activeSharedWorkspaceId === nextWorkspaceId) return
    if (nextView === "admin_tools" && !(UI.hasSmartNotesFolderAccess && UI.hasSmartNotesFolderAccess())) return
    StateStore.set(previousState => ({ ...previousState, view: nextView, activeFolderId: nextFolderId, activeSharedWorkspaceId: nextWorkspaceId }))
}

function getLockedNotes() {
    const currentState = StateStore.read()
    return (currentState.notes || []).filter(note => !!(note && note.lock && note.lock.hidden))
}



async function deleteFolder(folderId) {
    if (!folderId) return
    UI.confirm("delete_f", async () => {
        const user = StateStore.read().user
        if (!db || !user) return
        const foldersCollection = getRefs().getUserFoldersCollection(user)
        const notesCollection = getRefs().getUserNotesCollection(user)
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
        const updatedFolders = StateStore.read().folders.map(folder => folder.id === folderId ? { ...folder, trashedAt: new Date().toISOString(), isHidden: false } : folder)
        const updatedNotes = StateStore.read().notes.map(item => item.folderId === folderId ? { ...item, folderId: null, trashedAt: new Date().toISOString() } : item)
        StateStore.update("folders", updatedFolders)
        StateActions.setNotes(updatedNotes)
        if (StateStore.read().activeFolderId === folderId) switchView("notes")
        UI.showToast(UI.getText("folder_deleted", "Folder moved to trash"))
        refreshCurrentList()
    })
}


const getNoteById = (noteId) => StateStore.read().notes.find(n => n.id === noteId)

const refreshCurrentList = () => {
    const currentSearchValue = document.getElementById("search-input")?.value || ""
    updateSearchQuery(currentSearchValue)
}

const getTrashedItems = () => {
    const state = StateStore.read()
    return {
        notes: Array.isArray(state.notes) ? state.notes.filter(note => !!note?.trashedAt) : [],
        folders: Array.isArray(state.folders) ? state.folders.filter(folder => !!folder?.trashedAt) : []
    }
}

const normalizeConfirmationValue = value => String(value || "").trim().toLocaleUpperCase()

const commitPermanentDeletes = async (references, chunkSize = 400) => {
    const validReferences = (Array.isArray(references) ? references : []).filter(Boolean)
    for (let index = 0; index < validReferences.length; index += chunkSize) {
        const batch = db.batch()
        validReferences.slice(index, index + chunkSize).forEach(reference => {
            batch.delete(reference)
        })
        await batch.commit()
    }
}

async function clearTrashPermanently() {
    const user = StateStore.read().user
    if (!db || !user) return
    const trashedItems = getTrashedItems()
    if (!trashedItems.notes.length && !trashedItems.folders.length) {
        UI.showToast(UI.getText("trash_already_empty", "Trash is already empty"))
        UI.updateTrashActionVisibility?.()
        return
    }
    UI.confirm("clear_trash", () => {
        const confirmationKeyword = UI.getText("clear_trash_keyword", "DELETE")
        UI.showPrompt(
            UI.getText("clear_trash_prompt_title", "Type DELETE to clear trash"),
            UI.getText("clear_trash_prompt_placeholder", "Type DELETE"),
            async (value) => {
                if (normalizeConfirmationValue(value) !== normalizeConfirmationValue(confirmationKeyword)) {
                    UI.showToast(UI.getText("clear_trash_keyword_error", "Confirmation did not match, trash was not cleared"))
                    return
                }
                const currentTrashedItems = getTrashedItems()
                const noteReferences = currentTrashedItems.notes
                    .map(note => getNoteReference(note, user))
                    .filter(Boolean)
                const folderReferences = currentTrashedItems.folders
                    .map(folder => getRefs().getUserFoldersCollection(user).doc(folder.id))
                    .filter(Boolean)
                await commitPermanentDeletes([...noteReferences, ...folderReferences])
                const deletedNoteIds = new Set(currentTrashedItems.notes.map(note => note.id))
                const deletedFolderIds = new Set(currentTrashedItems.folders.map(folder => folder.id))
                StateActions.setNotes(StateStore.read().notes.filter(note => !deletedNoteIds.has(note.id)))
                StateStore.update("folders", StateStore.read().folders.filter(folder => !deletedFolderIds.has(folder.id)))
                if (deletedNoteIds.has(StateStore.read().currentNote?.id)) {
                    window.SmartNotesEditor?.close?.()
                }
                UI.showToast(UI.getText("trash_cleared", "Trash cleared"))
                UI.updateTrashActionVisibility?.()
                refreshCurrentList()
            }
        )
    })
}

const ensureManageAccess = (note) => {
    if (!note) return false
    if (typeof CollaborationService === "undefined" || CollaborationService.canManage(note)) return true
    UI.showToast(UI.getText("share_manage_denied", "Permission denied"))
    return false
}

const getNoteReference = (note, user) => {
    if (typeof CollaborationService !== "undefined") return CollaborationService.getNoteReference(note, user)
    return getRefs().getUserNotesCollection(user).doc(note.id)
}

function openNoteActions(noteId) {
    const note = UI.resolveNoteById(noteId)
    const currentNoteId = StateStore.read().currentNote?.id || ""
    const allowHiddenCurrentNote = !!note && isHiddenLocked(note) && currentNoteId === note.id
    if (!note || (isHiddenLocked(note) && !allowHiddenCurrentNote)) return
    UI.currentNoteActionId = note.id
    UI.renderNoteActions(note.id)
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
            StateActions.setNotes(StateStore.read().notes.filter(item => item.id !== noteId))
            if (StateStore.read().currentNote?.id === noteId) window.SmartNotesEditor?.close?.()
            UI.showToast(UI.getText("note_deleted_permanent", "Deleted permanently"))
            refreshCurrentList()
            return
        }
        await ref.update(window.NoteHelpers.buildNoteUpdatePayload({ trashedAt: firebase.firestore.FieldValue.serverTimestamp() }))
        StateActions.setNotes(StateStore.read().notes.map(item => item.id === noteId ? { ...item, trashedAt: new Date().toISOString() } : item))
        if (StateStore.read().currentNote?.id === noteId) window.SmartNotesEditor?.close?.()
        UI.showToast(UI.getText("note_deleted", "Moved to trash"))
        refreshCurrentList()
    })
}

async function restoreNoteById(noteId) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update(window.NoteHelpers.buildNoteUpdatePayload({ trashedAt: null }))
    StateActions.setNotes(StateStore.read().notes.map(item => item.id === noteId ? { ...item, trashedAt: null } : item))
    UI.showToast(window.AppMessages.getAppMessage(UI, window.AppMessages.APP_MESSAGES.restored))
    refreshCurrentList()
}

async function scheduleReminder(noteId) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note)) return
    const input = document.querySelector(`.note-reminder-input[data-note-id="${encodeURIComponent(noteId)}"]`)
    const value = input ? input.value : ""
    const date = new Date(value)
    if (!value || Number.isNaN(date.getTime())) {
        UI.showToast(UI.getText("reminder_required", "Pick date and time"))
        return
    }
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({ reminderAt: date.toISOString(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    const permissionResult = await window.NotificationService?.ensurePermission?.() || null
    if (permissionResult?.supported && permissionResult.permission === "denied") {
        UI.showToast(UI.getText("notification_permission_denied", "Browser notifications are blocked"))
    }
    UI.showToast(UI.getText("reminder_saved", "Reminder saved"))
    UI.closeModal("note-actions-modal")
}

async function clearReminder(noteId) {
    const user = StateStore.read().user
    const note = getNoteById(noteId)
    if (!db || !user || !note || !ensureManageAccess(note)) return
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update({ reminderAt: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    UI.showToast(UI.getText("reminder_cleared", "Reminder cleared"))
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
    updateSearchQuery(document.getElementById("search-input")?.value || "")
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
    const targetFolder = StateStore.read().folders.find(folder => folder.id === folderId) || null
    if (folderId && !window.Validators.canAssignToFolder(targetFolder)) {
        UI.showToast(window.AppMessages.getAppMessage(UI, window.AppMessages.APP_MESSAGES.moveToTrashedFolderDenied))
        return
    }
    const ref = getNoteReference(note, user)
    if (!ref) return
    await ref.update(window.NoteHelpers.buildNoteUpdatePayload({ folderId: folderId || null }, { updateTimestamp: false }))
    StateActions.setNotes(StateStore.read().notes.map(item => item.id === noteId ? { ...item, folderId: folderId || null } : item))
    refreshCurrentList()
}


async function restoreFolderById(folderId) {
    const user = StateStore.read().user
    if (!db || !user || !folderId) return
    await getRefs().getUserFoldersCollection(user).doc(folderId).update({ trashedAt: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    StateStore.update("folders", StateStore.read().folders.map(folder => folder.id === folderId ? { ...folder, trashedAt: null } : folder))
    UI.showToast(window.AppMessages.getAppMessage(UI, window.AppMessages.APP_MESSAGES.restored))
    refreshCurrentList()
}

async function deleteFolderPermanently(folderId) {
    const user = StateStore.read().user
    if (!db || !user || !folderId) return
    await getRefs().getUserFoldersCollection(user).doc(folderId).delete()
    StateStore.update("folders", StateStore.read().folders.filter(folder => folder.id !== folderId))
    UI.showToast(UI.getText("folder_deleted_permanent", "Folder deleted permanently"))
    refreshCurrentList()
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
window.clearTrashPermanently = clearTrashPermanently
