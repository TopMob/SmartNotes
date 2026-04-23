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
    const sharedFeaturesEnabled = window.AppFeatures?.sharedAccess === true && window.AppFeatures?.workspaces === true
    if ((nextView === "shared_access" || nextView === "shared_workspace") && !sharedFeaturesEnabled) {
        const fallbackView = currentState.view === "shared_access" || currentState.view === "shared_workspace" ? "notes" : currentState.view
        if (currentState.view !== fallbackView) {
            StateStore.set(previousState => ({ ...previousState, view: fallbackView, activeFolderId: previousState.view === "folder" ? previousState.activeFolderId : null, activeSharedWorkspaceId: null }))
        }
        return
    }
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
window.deleteFolder = deleteFolder;
window.openNoteActions = openNoteActions;
window.deleteNoteById = deleteNoteById;
window.restoreNoteById = restoreNoteById;
window.scheduleReminder = scheduleReminder;
window.clearReminder = clearReminder;
window.copyNoteTextById = copyNoteTextById;
window.toggleFavorite = toggleFavorite;
window.togglePin = togglePin;
window.toggleArchive = toggleArchive;
window.moveNoteToFolder = moveNoteToFolder;
window.restoreFolderById = restoreFolderById;
window.deleteFolderPermanently = deleteFolderPermanently;
window.clearTrashPermanently = clearTrashPermanently;

"use strict";

const NotesListEngine = (() => {
    const cardCache = new Map()
    const runtime = {
        source: [],
        renderedCount: 0,
        chunkSize: 48,
        loading: false,
        observer: null,
        sentinel: null,
        grid: null,
        empty: null
    }

    const getIsHiddenLocked = () => (typeof window.isHiddenLocked === "function" ? window.isHiddenLocked : () => false)

    const areTagListsEqual = (firstTags, secondTags) => {
        const left = Array.isArray(firstTags) ? firstTags : []
        const right = Array.isArray(secondTags) ? secondTags : []
        if (left.length !== right.length) return false
        for (let index = 0; index < left.length; index++) {
            if (left[index] !== right[index]) return false
        }
        return true
    }

    const el = (tag, cls = [], text = null) => {
        const node = document.createElement(tag)
        if (cls.length) node.classList.add(...cls)
        if (text !== null) node.textContent = text
        return node
    }

    const createIcon = (name) => {
        const i = el("i", ["material-icons-round"], name)
        i.setAttribute("aria-hidden", "true")
        return i
    }

    const createBtn = (action, icon, label, id) => {
        const btn = el("button", ["action-btn"])
        btn.type = "button"
        btn.setAttribute("aria-label", label)
        btn.dataset.action = action
        btn.dataset.noteId = encodeURIComponent(id)
        btn.appendChild(createIcon(icon))
        return btn
    }

    const createCard = (note) => {
        const isLockedView = StateStore.read().view === "locked"
        const isLockedNote = getIsHiddenLocked()(note)
        const canManage = typeof CollaborationService !== "undefined" ? CollaborationService.canManage(note) : true
        const card = el("div", ["note-card"])
        card.draggable = !(isLockedView && isLockedNote) && canManage
        card.dataset.noteId = encodeURIComponent(note.id)

        let actions = null
        if (!(isLockedView && isLockedNote) && canManage) {
            actions = el("div", ["card-actions"])
            actions.appendChild(createBtn("note-pin", "push_pin", UI.getText("pin_note", "Pin"), note.id))
            const favBtn = createBtn("note-favorite", note.isFavorite ? "star" : "star_border", UI.getText("favorite_note", "Favorite"), note.id)
            favBtn.classList.toggle("favorite-active", !!note.isFavorite)
            actions.appendChild(favBtn)
            actions.appendChild(createBtn("note-menu", "more_horiz", UI.getText("note_actions", "Actions"), note.id))
        }

        const titleText = (isLockedView && isLockedNote) ? UI.getText("lock_center_masked_title", "Protected note") : (note.title || NoteText.buildAutoTitle(note))
        const h3 = el("h3", [], titleText)

        const contentText = (isLockedView && isLockedNote) ? UI.getText("lock_hidden", "Note hidden") : NoteText.buildPreviewText(note)
        const p = el("p", [], contentText)

        const meta = el("div", ["note-meta"])
        meta.appendChild(createIcon("schedule"))
        const dateSpan = el("span", [], Utils.formatDate(note.updatedAt || note.createdAt || Date.now()))

        const contentTypeLabel = note.contentType === "handwriting" ? "✍️" : (String(note.content || "").includes("<audio") ? "🎵" : "")
        if (contentTypeLabel) {
            const contentTypeSpan = el("span", [], contentTypeLabel)
            meta.appendChild(contentTypeSpan)
        }
        const tagsSpan = el("span", [])
        tagsSpan.style.marginLeft = "auto"
        tagsSpan.style.opacity = "0.8"
        const tags = Array.isArray(note.tags) ? note.tags.slice(0, 3) : []
        tagsSpan.textContent = (isLockedView && isLockedNote) ? "" : (tags.length ? tags.map(t => `#${t}`).join(" ") : "")
        meta.append(dateSpan, tagsSpan)

        const lockContainer = el("div")
        lockContainer.style.marginTop = "8px"
        if (note.lock && note.lock.hidden) {
            const badge = el("span", ["lock-badge"])
            const i = createIcon("lock")
            i.style.fontSize = "16px"
            const txt = el("span", [], UI.getText("locked_note", "Locked"))
            badge.append(i, txt)
            lockContainer.appendChild(badge)
        }

        if (actions) card.append(actions)
        card.append(h3, p, meta, lockContainer)
        card.classList.toggle("favorite", !!note.isFavorite)

        const favBtn = actions ? actions.children[1] : null
        const favIcon = favBtn ? favBtn.firstChild : null

        cardCache.set(note.id, {
            el: card,
            refs: { h3, p, dateSpan, tagsSpan, lockContainer, favBtn, favIcon },
            data: { ...note }
        })

        return card
    }

    const updateCard = (note) => {
        const cached = cardCache.get(note.id)
        if (!cached) return createCard(note)

        const { el: card, refs, data } = cached
        const isLockedView = StateStore.read().view === "locked"
        const isLockedNote = getIsHiddenLocked()(note)

        if (note.title !== data.title || note.content !== data.content || isLockedView) {
            refs.h3.textContent = (isLockedView && isLockedNote) ? UI.getText("lock_center_masked_title", "Protected note") : (note.title || NoteText.buildAutoTitle(note))
        }

        if (note.content !== data.content || isLockedView) {
            refs.p.textContent = (isLockedView && isLockedNote) ? UI.getText("lock_hidden", "Note hidden") : NoteText.buildPreviewText(note)
        }

        const t1 = note.updatedAt?.seconds || 0
        const t2 = data.updatedAt?.seconds || 0
        if (t1 !== t2) refs.dateSpan.textContent = Utils.formatDate(note.updatedAt || note.createdAt || Date.now())

        if (!areTagListsEqual(note.tags, data.tags) || isLockedView) {
            const tags = Array.isArray(note.tags) ? note.tags.slice(0, 3) : []
            refs.tagsSpan.textContent = (isLockedView && isLockedNote) ? "" : (tags.length ? tags.map(t => `#${t}`).join(" ") : "")
        }

        if (note.isPinned !== data.isPinned) card.classList.toggle("pinned", !!note.isPinned)

        if (note.isFavorite !== data.isFavorite) {
            card.classList.toggle("favorite", !!note.isFavorite)
            if (refs.favBtn) refs.favBtn.classList.toggle("favorite-active", !!note.isFavorite)
            if (refs.favIcon) refs.favIcon.textContent = note.isFavorite ? "star" : "star_border"
        }

        const lockHash = note.lock?.hash || ""
        const prevHash = data.lock?.hash || ""
        if (lockHash !== prevHash) {
            refs.lockContainer.replaceChildren()
            if (note.lock && note.lock.hidden) {
                const badge = el("span", ["lock-badge"])
                const i = createIcon("lock")
                i.style.fontSize = "16px"
                const txt = el("span", [], UI.getText("locked_note", "Locked"))
                badge.append(i, txt)
                refs.lockContainer.appendChild(badge)
            }
        }

        cached.data = { ...note }
        return card
    }

    const disconnectObserver = () => {
        runtime.observer?.disconnect()
        runtime.observer = null
    }

    const ensureSentinel = () => {
        if (!runtime.grid) return null
        if (runtime.sentinel && runtime.grid.contains(runtime.sentinel)) return runtime.sentinel
        const sentinel = document.createElement("div")
        sentinel.className = "notes-list-sentinel"
        sentinel.style.height = "1px"
        runtime.sentinel = sentinel
        runtime.grid.appendChild(sentinel)
        return sentinel
    }

    const clearGrid = () => {
        if (!runtime.grid) return
        runtime.grid.replaceChildren()
    }

    const cleanupCache = () => {
        const activeIds = new Set(runtime.source.map(note => note.id))
        for (const [id] of cardCache) {
            if (!activeIds.has(id)) cardCache.delete(id)
        }
    }

    const appendNextChunk = () => {
        if (!runtime.grid || runtime.loading) return
        if (runtime.renderedCount >= runtime.source.length) return
        runtime.loading = true

        const fragment = document.createDocumentFragment()
        const start = runtime.renderedCount
        const end = Math.min(runtime.source.length, start + runtime.chunkSize)
        for (let index = start; index < end; index += 1) {
            const note = runtime.source[index]
            const node = cardCache.has(note.id) ? updateCard(note) : createCard(note)
            fragment.appendChild(node)
        }
        runtime.renderedCount = end

        const sentinel = ensureSentinel()
        if (sentinel) {
            runtime.grid.insertBefore(fragment, sentinel)
        } else {
            runtime.grid.appendChild(fragment)
        }
        runtime.loading = false
    }

    const setupObserver = () => {
        disconnectObserver()
        const sentinel = ensureSentinel()
        if (!sentinel || runtime.renderedCount >= runtime.source.length) return
        runtime.observer = new IntersectionObserver((entries) => {
            const isVisible = entries.some(entry => entry.isIntersecting)
            if (!isVisible) return
            appendNextChunk()
            if (runtime.renderedCount >= runtime.source.length) disconnectObserver()
        }, { root: null, threshold: 0.01 })
        runtime.observer.observe(sentinel)
    }

    const render = (list) => {
        runtime.grid = UI.els.grid
        runtime.empty = UI.els.empty
        if (!runtime.grid || !runtime.empty) return

        runtime.source = Array.isArray(list) ? list : []
        runtime.renderedCount = 0
        disconnectObserver()

        if (!runtime.source.length) {
            runtime.empty.classList.remove("hidden")
            clearGrid()
            cardCache.clear()
            return
        }

        runtime.empty.classList.add("hidden")
        UI.resetContentGridLayout?.(runtime.grid)
        runtime.grid.classList.remove("folder-grid")
        clearGrid()
        cleanupCache()
        appendNextChunk()
        setupObserver()
    }

    return { render }
})();

window.NotesRenderer = NotesListEngine;

const ColorPalette = (() => {
    const instances = new Map()
    let activePicker = null

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

    const normalizeHex = (value) => {
        const raw = String(value || "").trim()
        if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw
        if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`
        return "#000000"
    }

    const rgbToHex = (r, g, b) => {
        const toHex = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    const hexToRgb = (hex) => {
        const safe = normalizeHex(hex)
        const num = parseInt(safe.slice(1), 16)
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
    }

    const rgbToHsv = (r, g, b) => {
        const rr = r / 255
        const gg = g / 255
        const bb = b / 255
        const max = Math.max(rr, gg, bb)
        const min = Math.min(rr, gg, bb)
        const delta = max - min
        let hue = 0
        if (delta !== 0) {
            if (max === rr) hue = ((gg - bb) / delta) % 6
            else if (max === gg) hue = (bb - rr) / delta + 2
            else hue = (rr - gg) / delta + 4
        }
        hue = Math.round(hue * 60)
        if (hue < 0) hue += 360
        const sat = max === 0 ? 0 : delta / max
        const val = max
        return { h: hue, s: sat, v: val }
    }

    const hsvToRgb = (h, s, v) => {
        const c = v * s
        const hh = h / 60
        const x = c * (1 - Math.abs((hh % 2) - 1))
        let r = 0
        let g = 0
        let b = 0
        if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0]
        else if (hh >= 1 && hh < 2) [r, g, b] = [x, c, 0]
        else if (hh >= 2 && hh < 3) [r, g, b] = [0, c, x]
        else if (hh >= 3 && hh < 4) [r, g, b] = [0, x, c]
        else if (hh >= 4 && hh < 5) [r, g, b] = [x, 0, c]
        else if (hh >= 5 && hh <= 6) [r, g, b] = [c, 0, x]
        const m = v - c
        return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
    }

    const setPickerOpen = (picker, isOpen) => {
        picker.classList.toggle("is-open", isOpen)
        const trigger = picker.querySelector("[data-color-trigger]")
        if (trigger) trigger.setAttribute("aria-expanded", String(isOpen))
        if (isOpen) {
            activePicker = picker
            const state = instances.get(picker)
            if (state) schedulePanelPosition(state)
        } else if (activePicker === picker) activePicker = null
    }

    const schedulePanelPosition = (state) => {
        if (!state) return
        if (state.positionFrame) return
        state.positionFrame = requestAnimationFrame(() => {
            state.positionFrame = null
            if (state.picker?.classList.contains("is-open")) positionPanel(state)
        })
    }

    const getBoundsContainer = (picker) => {
        return picker.closest("#settings-content")
            || picker.closest(".modal-card")
            || picker.closest(".editor-toolbar")
            || picker.closest(".note-content-wrapper")
            || picker.closest(".note-editor")
            || document.body
    }

    const resolveContainerRect = (container) => {
        if (container && container !== document.body) return container.getBoundingClientRect()
        return {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight,
            width: window.innerWidth,
            height: window.innerHeight
        }
    }

    const positionPanel = (state) => {
        if (!state.panel || !state.picker) return
        const padding = 8
        state.panel.style.left = "0"
        state.panel.style.right = "auto"
        state.panel.style.top = "calc(100% + 10px)"
        state.panel.style.bottom = "auto"
        const pickerRect = state.picker.getBoundingClientRect()
        const panelRect = state.panel.getBoundingClientRect()
        const containerRect = resolveContainerRect(state.container)
        const containerLeft = containerRect.left + padding
        const containerRight = containerRect.right - padding
        const containerWidth = Math.max(0, containerRight - containerLeft)
        const pickerOffset = pickerRect.left - containerRect.left
        const centeredInPicker = (pickerRect.width - panelRect.width) / 2
        const centeredInContainer = (containerRect.width - panelRect.width) / 2 - pickerOffset
        let left = state.container?.id === "settings-content" ? centeredInContainer : centeredInPicker
        if (panelRect.width > containerWidth && containerWidth > 0) {
            left = centeredInContainer
        }
        const expectedRight = pickerRect.left + left + panelRect.width
        if (expectedRight > containerRight) {
            left -= expectedRight - containerRight
        }
        const expectedLeft = pickerRect.left + left
        if (expectedLeft < containerLeft) {
            left += containerLeft - expectedLeft
        }
        let top = pickerRect.height + 10
        const expectedBottom = pickerRect.top + top + panelRect.height
        if (expectedBottom > window.innerHeight - padding) {
            const spaceAbove = pickerRect.top - panelRect.height - 10
            top = spaceAbove >= padding ? -panelRect.height - 10 : Math.max(padding - pickerRect.top, top)
        }
        state.panel.style.left = `${left}px`
        state.panel.style.top = `${top}px`
    }

    const updateUi = (state) => {
        const { picker, hue, sat, val } = state
        const rgb = hsvToRgb(hue, sat, val)
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
        picker.style.setProperty("--picker-hue", `${hue}deg`)
        if (state.swatch) state.swatch.style.background = hex
        if (state.hexInput && state.hexInput.value.toLowerCase() !== hex.toLowerCase()) {
            state.hexInput.value = hex.toUpperCase()
        }
        if (state.svHandle) {
            state.svHandle.style.left = `${sat * 100}%`
            state.svHandle.style.top = `${(1 - val) * 100}%`
        }
        if (state.hueHandle) {
            state.hueHandle.style.left = `${(hue / 360) * 100}%`
        }
        if (state.input && state.input.value.toLowerCase() !== hex.toLowerCase()) {
            state.input.value = hex.toUpperCase()
        }
        return hex
    }

    const emitNow = (state, hex) => {
        if (!state.input) return
        state.input.value = hex.toUpperCase()
        state.input.setAttribute("value", hex.toUpperCase())
        const event = new Event("input", { bubbles: true })
        state.input.dispatchEvent(event)
        state.lastEmittedHex = hex
        state.lastEmittedAt = Date.now()
    }

    const emitChange = (state, hex, options = {}) => {
        if (!state.input) return
        const force = !!options.force
        const now = Date.now()
        const interval = 48
        if (force) {
            if (state.pendingEmitTimer) {
                clearTimeout(state.pendingEmitTimer)
                state.pendingEmitTimer = null
            }
            emitNow(state, hex)
            return
        }
        if (!state.lastEmittedAt || now - state.lastEmittedAt >= interval) {
            emitNow(state, hex)
            return
        }
        state.pendingHex = hex
        if (state.pendingEmitTimer) return
        const remaining = interval - (now - state.lastEmittedAt)
        state.pendingEmitTimer = setTimeout(() => {
            state.pendingEmitTimer = null
            if (!state.pendingHex) return
            const nextHex = state.pendingHex
            state.pendingHex = ""
            emitNow(state, nextHex)
        }, remaining)
    }

    const setColorFromHex = (state, hex, notify = true) => {
        const rgb = hexToRgb(hex)
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
        const nextHue = hsv.s === 0 ? state.hue : hsv.h
        const nextSaturation = hsv.v === 0 ? state.sat : hsv.s
        state.hue = Number.isFinite(nextHue) ? nextHue : 0
        state.sat = Number.isFinite(nextSaturation) ? nextSaturation : 1
        state.val = Number.isFinite(hsv.v) ? hsv.v : 1
        const updatedHex = updateUi(state)
        if (notify) emitChange(state, updatedHex)
    }

    const handleSvPointer = (state, event) => {
        if (!state.sv) return
        const rect = state.sv.getBoundingClientRect()
        const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
        const y = clamp((event.clientY - rect.top) / rect.height, 0, 1)
        state.sat = x
        state.val = 1 - y
        const hex = updateUi(state)
        emitChange(state, hex)
    }

    const handleHuePointer = (state, event) => {
        if (!state.hueElement) return
        const rect = state.hueElement.getBoundingClientRect()
        const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
        state.hue = Math.round(x * 360)
        const hex = updateUi(state)
        emitChange(state, hex)
    }

    const trackPointer = (pointerId, moveHandler, upHandler) => {
        const onMove = (event) => {
            if (event.pointerId !== pointerId) return
            if (event.buttons === 0 && event.pointerType === "mouse") return
            event.preventDefault()
            moveHandler(event)
        }
        const onUp = (event) => {
            if (event.pointerId !== pointerId) return
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            if (typeof upHandler === "function") upHandler(event)
        }
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
    }

    const suspendCanvasPointerEvents = (pointerId) => {
        const canvas = typeof EditorDrawing === "undefined" ? null : EditorDrawing.state?.canvas
        if (!canvas) return () => {}
        const previousPointerEvents = canvas.style.pointerEvents
        canvas.style.pointerEvents = "none"
        const restore = (event) => {
            if (event.pointerId !== pointerId) return
            window.removeEventListener("pointerup", restore)
            window.removeEventListener("pointercancel", restore)
            if (canvas.isConnected) canvas.style.pointerEvents = previousPointerEvents
        }
        window.addEventListener("pointerup", restore)
        window.addEventListener("pointercancel", restore)
        return restore
    }

    const bindPicker = (picker) => {
        if (instances.has(picker)) return
        const input = picker.querySelector("[data-color-input]")
        const trigger = picker.querySelector("[data-color-trigger]")
        const panel = picker.querySelector("[data-color-panel]")
        const sv = picker.querySelector("[data-color-sv]")
        const svHandle = picker.querySelector("[data-color-sv-handle]")
        const hueElement = picker.querySelector("[data-color-hue]")
        const hueHandle = picker.querySelector("[data-color-hue-handle]")
        const hexInput = picker.querySelector("[data-color-hex]")
        const swatch = picker.querySelector("[data-color-swatch]")

        const initial = normalizeHex(input?.value || picker.dataset.colorValue || "#111111")
        const state = {
            picker,
            input,
            panel,
            sv,
            svHandle,
            hueElement,
            hueHandle,
            hexInput,
            swatch,
            container: getBoundsContainer(picker),
            hue: 0,
            sat: 1,
            val: 1,
            lastEmittedAt: 0,
            lastEmittedHex: "",
            pendingHex: "",
            pendingEmitTimer: null
        }
        setColorFromHex(state, initial, false)
        if (input) input.value = initial.toUpperCase()
        if (hexInput) hexInput.value = initial.toUpperCase()

        if (trigger) {
            trigger.addEventListener("click", (event) => {
                event.preventDefault()
                event.stopPropagation()
                const next = !picker.classList.contains("is-open")
                if (activePicker && activePicker !== picker) setPickerOpen(activePicker, false)
                setPickerOpen(picker, next)
            })
        }

        if (sv) {
            sv.addEventListener("pointerdown", (event) => {
                event.preventDefault()
                event.stopPropagation()
                suspendCanvasPointerEvents(event.pointerId)
                sv.setPointerCapture?.(event.pointerId)
                handleSvPointer(state, event)
                trackPointer(event.pointerId, (moveEvent) => handleSvPointer(state, moveEvent), () => emitChange(state, updateUi(state), { force: true }))
            })
        }

        if (hueElement) {
            hueElement.addEventListener("pointerdown", (event) => {
                event.preventDefault()
                event.stopPropagation()
                suspendCanvasPointerEvents(event.pointerId)
                hueElement.setPointerCapture?.(event.pointerId)
                handleHuePointer(state, event)
                trackPointer(event.pointerId, (moveEvent) => handleHuePointer(state, moveEvent), () => emitChange(state, updateUi(state), { force: true }))
            })
        }

        if (hexInput) {
            hexInput.addEventListener("input", (event) => {
                const rawValue = String(event.target.value || "").trim()
                if (/^#?[0-9a-fA-F]{0,6}$/.test(rawValue)) return
                event.target.value = normalizeHex(rawValue).toUpperCase()
            })
            hexInput.addEventListener("blur", (event) => {
                const next = normalizeHex(event.target.value)
                event.target.value = next.toUpperCase()
                setColorFromHex(state, next)
            })
            hexInput.addEventListener("keydown", (event) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                const next = normalizeHex(event.target.value)
                event.target.value = next.toUpperCase()
                setColorFromHex(state, next, true)
            })
        }

        if (input) {
            input.addEventListener("input", (event) => {
                const next = normalizeHex(event.target.value)
                setColorFromHex(state, next, false)
            })
        }

        if (panel) {
            panel.addEventListener("pointerdown", (event) => event.stopPropagation())
        }

        if (typeof ResizeObserver !== "undefined") {
            const resizeObserver = new ResizeObserver(() => {
                schedulePanelPosition(state)
            })
            if (state.panel) resizeObserver.observe(state.panel)
            if (state.container) resizeObserver.observe(state.container)
            state.resizeObserver = resizeObserver
        }

        instances.set(picker, state)
    }

    const init = (root = document) => {
        root.querySelectorAll("[data-color-picker]").forEach(bindPicker)
    }

    const syncInput = (input) => {
        if (!input) return
        const picker = input.closest("[data-color-picker]")
        if (!picker) return
        const state = instances.get(picker)
        if (!state) return
        const next = normalizeHex(input.value)
        setColorFromHex(state, next, false)
    }

    document.addEventListener("pointerdown", (event) => {
        if (!activePicker) return
        if (activePicker.contains(event.target)) return
        setPickerOpen(activePicker, false)
    })

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init())
    } else {
        init()
    }

    return { init, syncInput }
})();

window.ColorPalette = ColorPalette;
