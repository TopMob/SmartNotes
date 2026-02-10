function normalizeVisibleNotes(list, orderKey = "order") {
    if (!Array.isArray(list)) return []
    const arr = list.map(n => {
        const normalized = NoteIO.normalizeNote(n)
        if (n && n.access) normalized.access = n.access
        return normalized
    })
    arr.sort((a, b) => {
        if (!!b.isPinned !== !!a.isPinned) return a.isPinned ? -1 : 1
        const valueA = typeof a[orderKey] === "number" ? a[orderKey] : 0
        const valueB = typeof b[orderKey] === "number" ? b[orderKey] : 0
        return valueA - valueB
    })
    return arr
}

function getTimestampValue(value) {
    if (!value) return 0
    if (typeof value === "number") return value
    if (typeof value === "string") {
        const parsed = Date.parse(value)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    if (value.seconds) return value.seconds * 1000
    if (value.toDate) return value.toDate().getTime()
    return 0
}

function getTextLength(note) {
    const text = `${note.title || ""} ${Utils.stripHtml(note.content || "")}`.trim()
    return text.length
}

function sortVisibleNotes(list, sortMode, scores) {
    const pinned = list.filter(n => !!n.isPinned)
    const unpinned = list.filter(n => !n.isPinned)
    const locale = StateStore.read().config.lang || "ru"
    const compare = (a, b) => {
        if (sortMode === "title") {
            return String(a.title || "").localeCompare(String(b.title || ""), locale, { sensitivity: "base" })
        }
        if (sortMode === "length") {
            return getTextLength(b) - getTextLength(a)
        }
        if (sortMode === "importance") {
            if (!!b.isFavorite !== !!a.isFavorite) return a.isFavorite ? -1 : 1
            return getTimestampValue(b.updatedAt || b.createdAt) - getTimestampValue(a.updatedAt || a.createdAt)
        }
        if (sortMode === "relevance" && scores) {
            return (scores.get(b.id) || 0) - (scores.get(a.id) || 0)
        }
        return getTimestampValue(b.updatedAt || b.createdAt) - getTimestampValue(a.updatedAt || a.createdAt)
    }
    pinned.sort(compare)
    unpinned.sort(compare)
    return [...pinned, ...unpinned]
}

function isHiddenLocked(note) {
    return !!(note && note.lock && note.lock.hidden)
}

function isReminderNote(note) {
    const timestamp = getTimestampValue(note?.reminderAt)
    return timestamp > Date.now()
}

function getLockedNotes() {
    const current = StateStore.read()
    return (current.notes || []).filter(n => isHiddenLocked(n))
}

function filterAndRender(query) {
    const queryValue = String(query || "")
    const current = StateStore.read()

    if (current.searchQuery !== queryValue) {
        StateStore.update("searchQuery", queryValue)
    }

    const q = queryValue.trim()
    let view = current.view
    let activeFolderId = current.activeFolderId

    if (view === "folder" && !activeFolderId) {
        StateStore.update("view", "notes")
        view = "notes"
        activeFolderId = null
    }
    if (view === "hidden") {
        StateStore.update("view", "notes")
        view = "notes"
        activeFolderId = null
    }

    let list = current.notes.slice()
    const notesFilter = current.config.notesFilter || { sort: "manual", folders: [] }
    const selectedFolders = Array.isArray(notesFilter.folders) ? notesFilter.folders : []
    const hiddenFolderIds = new Set(current.folders.filter(folder => folder.isHidden && !folder.trashedAt).map(folder => folder.id))

    if (view === "locked") {
        list = list.filter(n => isHiddenLocked(n))
    } else {
        list = list.filter(n => !isHiddenLocked(n))
    }

    if (view === "reminders") {
        list = list.filter(n => isReminderNote(n) && !n.isArchived && !n.trashedAt)
    }

    if (view === "trash") {
        list = list.filter(n => !!n.trashedAt)
    } else {
        list = list.filter(n => !n.trashedAt)
    }

    if (view === "favorites") list = list.filter(n => n.isFavorite && !n.isArchived)
    else if (view === "archive") list = list.filter(n => n.isArchived)
    else if (view === "folder") list = list.filter(n => !n.isArchived && n.folderId === activeFolderId)
    else if (view !== "locked" && view !== "reminders" && view !== "trash") list = list.filter(n => !n.isArchived)

    if (view !== "folder") {
        list = list.filter(note => !note.folderId || !hiddenFolderIds.has(note.folderId))
    }

    const canUseFolderFilters = view !== "folder" && view !== "folders" && view !== "archive" && view !== "trash"

    if (canUseFolderFilters && selectedFolders.length) {
        list = list.filter(note => {
            if (!note.folderId) return selectedFolders.includes("none")
            return selectedFolders.includes(note.folderId)
        })
    }

    let scores = null
    if (q) {
        try {
            const scored = list.map(n => ({
                n,
                score: SmartSearch.score(q, n.title, n.content, n.tags)
            })).filter(item => item.score >= 0.35)
            scores = new Map(scored.map(item => [item.n.id, item.score]))
            list = scored.map(item => item.n)
        } catch (error) {
            console.error("Search failed", error)
        }
    }

    const sortMode = notesFilter.sort || "updated"
    if (sortMode === "manual") {
        const orderKey = view === "folder" ? "folderOrder" : "order"
        list = normalizeVisibleNotes(list, orderKey)
    } else {
        const mode = sortMode === "relevance" && !scores ? "updated" : sortMode
        list = sortVisibleNotes(list, mode, scores)
    }

    if (view === "folders") {
        UI.renderFolderGrid()
    } else if (view === "hidden_folders") {
        UI.renderHiddenFolders()
    } else if (view === "trash") {
        UI.renderTrash(list)
    } else {
        if (view === "locked") {
            UI.updateEmptyState("lock", UI.getText("lock_center_empty", "No protected notes"))
        } else if (view === "reminders") {
            UI.updateEmptyState("schedule", UI.getText("future_empty", "No reminders"))
        } else if (view === "trash") {
            UI.updateEmptyState("delete", UI.getText("trash_empty", "Trash is empty"))
        } else {
            UI.updateEmptyState("note_add", UI.getText("empty", "Nothing here yet"))
        }
        NotesRenderer.render(list)
    }

    UI.updateViewTitle()
    UI.updatePrimaryActionLabel()
}

function switchView(view, folderId = null) {
    StateStore.set(prev => ({ ...prev, view, activeFolderId: folderId }))

    document.querySelectorAll(".nav-item").forEach(btn => {
        const v = btn.dataset.view
        const f = btn.dataset.folderId

        let isActive = false
        if (v) isActive = (v === view)
        else if (f) isActive = (view === "folder" && f === folderId)

        btn.classList.toggle("active", isActive)
    })

    const searchInput = document.getElementById("search-input")
    filterAndRender(searchInput ? searchInput.value : "")
}
