const FAVORITES_STORAGE_KEY = "favorite-notes"
const NOTES_FILTER_KEY = "notes-filter"

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

loadNotesFilter()

window.NotesStorage = {
    applyStoredFavorites,
    syncFavoritesStorage,
    loadNotesFilter
}
