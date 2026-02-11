const FAVORITES_STORAGE_KEY = "favorite-notes"
const NOTES_FILTER_KEY = "notes-filter"
const NOTES_CACHE_KEY = "notes-cache"

const readFavoriteIds = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY))
        if (Array.isArray(stored)) return new Set(stored)
    } catch {}
    return new Set()
}

const writeFavoriteIds = (ids) => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids]))
}

const syncFavoritesStorage = (notes) => {
    const ids = new Set()
    notes.forEach(note => {
        if (note.isFavorite) ids.add(note.id)
    })
    writeFavoriteIds(ids)
}

const applyStoredFavorites = (notes) => {
    const stored = readFavoriteIds()
    if (!stored.size) return notes
    return notes.map(note => {
        if (typeof note.isFavorite !== "boolean" && stored.has(note.id)) {
            return { ...note, isFavorite: true }
        }
        return note
    })
}

const loadNotesFilter = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(NOTES_FILTER_KEY))
        if (stored && typeof stored === "object") {
            const current = StateStore.read().config.notesFilter || { sort: "manual", folders: [] }
            StateActions.updateConfig({ notesFilter: { ...current, ...stored } })
        }
    } catch {}
}

const readCachedNotes = (uid) => {
    if (!uid) return []
    try {
        const allCaches = JSON.parse(localStorage.getItem(NOTES_CACHE_KEY))
        const userCache = allCaches?.[uid]
        if (Array.isArray(userCache?.notes)) {
            return userCache.notes.map(note => NoteIO.normalizeNote(note))
        }
    } catch {}
    return []
}

const writeCachedNotes = (uid, notes) => {
    if (!uid || !Array.isArray(notes)) return
    try {
        const allCaches = JSON.parse(localStorage.getItem(NOTES_CACHE_KEY)) || {}
        const sanitizedNotes = notes.slice(0, 250).map(note => NoteIO.normalizeNote(note))
        allCaches[uid] = { updatedAt: Date.now(), notes: sanitizedNotes }
        const entries = Object.entries(allCaches)
            .sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
            .slice(0, 5)
        const next = Object.fromEntries(entries)
        localStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(next))
    } catch {}
}

loadNotesFilter()

window.NotesStorage = {
    applyStoredFavorites,
    syncFavoritesStorage,
    loadNotesFilter,
    readCachedNotes,
    writeCachedNotes
}
