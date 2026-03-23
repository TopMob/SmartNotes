const FAVORITES_STORAGE_KEY = "favorite-notes"
const NOTES_FILTER_KEY = "notes-filter"
const SAVED_NOTES_FILTERS_KEY = "saved-notes-filters"
const NOTES_CACHE_KEY = "notes-cache"

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
        const currentFilter = StateStore.read().config.notesFilter || { sort: "manual", folders: [] }
        StateActions.updateConfig({ notesFilter: { ...currentFilter, ...storedFilter } })
    }
}

const normalizeNotesFilter = (filter) => {
    const source = filter && typeof filter === "object" ? filter : {}
    const allowedSortValues = new Set(["updated", "relevance", "importance", "title", "length", "manual"])
    return {
        sort: allowedSortValues.has(String(source.sort || "")) ? String(source.sort) : "manual",
        folders: Array.isArray(source.folders)
            ? [...new Set(source.folders.map(value => String(value || "").trim()).filter(Boolean))]
            : []
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
