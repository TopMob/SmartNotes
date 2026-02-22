const NotesQueryService = (() => {
    function normalizeVisibleNotes(list, orderKey = "order") {
        if (!Array.isArray(list)) return []
        const normalizedNotes = list.map(note => {
            const normalizedNote = NoteIO.normalizeNote(note)
            if (note && note.access) normalizedNote.access = note.access
            return normalizedNote
        })
        normalizedNotes.sort((firstNote, secondNote) => {
            if (!!secondNote.isPinned !== !!firstNote.isPinned) return firstNote.isPinned ? -1 : 1
            const firstValue = typeof firstNote[orderKey] === "number" ? firstNote[orderKey] : 0
            const secondValue = typeof secondNote[orderKey] === "number" ? secondNote[orderKey] : 0
            return firstValue - secondValue
        })
        return normalizedNotes
    }

    function getTimestampValue(value) {
        if (!value) return 0
        if (typeof value === "number") return value
        if (typeof value === "string") {
            const parsedDate = Date.parse(value)
            return Number.isNaN(parsedDate) ? 0 : parsedDate
        }
        if (value.seconds) return value.seconds * 1000
        if (value.toDate) return value.toDate().getTime()
        return 0
    }

    function getTextLength(note) {
        const noteText = `${note.title || ""} ${Utils.stripHtml(note.content || "")}`.trim()
        return noteText.length
    }

    function sortVisibleNotes(list, sortMode, scores, languageCode) {
        const pinnedNotes = list.filter(note => !!note.isPinned)
        const unpinnedNotes = list.filter(note => !note.isPinned)
        const compareNotes = (firstNote, secondNote) => {
            if (sortMode === "title") {
                return String(firstNote.title || "").localeCompare(String(secondNote.title || ""), languageCode, { sensitivity: "base" })
            }
            if (sortMode === "length") {
                return getTextLength(secondNote) - getTextLength(firstNote)
            }
            if (sortMode === "importance") {
                if (!!secondNote.isFavorite !== !!firstNote.isFavorite) return firstNote.isFavorite ? -1 : 1
                return getTimestampValue(secondNote.updatedAt || secondNote.createdAt) - getTimestampValue(firstNote.updatedAt || firstNote.createdAt)
            }
            if (sortMode === "relevance") {
                const firstRelevance = scores
                    ? (scores.get(firstNote.id) || 0)
                    : (Number.isFinite(Number(firstNote.relevance)) ? Number(firstNote.relevance) : (Number(firstNote.aiRelevance) || 0))
                const secondRelevance = scores
                    ? (scores.get(secondNote.id) || 0)
                    : (Number.isFinite(Number(secondNote.relevance)) ? Number(secondNote.relevance) : (Number(secondNote.aiRelevance) || 0))
                if (secondRelevance !== firstRelevance) return secondRelevance - firstRelevance
                return getTimestampValue(secondNote.updatedAt || secondNote.createdAt) - getTimestampValue(firstNote.updatedAt || firstNote.createdAt)
            }
            return getTimestampValue(secondNote.updatedAt || secondNote.createdAt) - getTimestampValue(firstNote.updatedAt || firstNote.createdAt)
        }
        pinnedNotes.sort(compareNotes)
        unpinnedNotes.sort(compareNotes)
        return [...pinnedNotes, ...unpinnedNotes]
    }

    function isHiddenLocked(note) {
        return !!(note && note.lock && note.lock.hidden)
    }

    function isReminderNote(note) {
        return getTimestampValue(note?.reminderAt) > Date.now()
    }

    function filterByView(notes, stateSnapshot) {
        const view = stateSnapshot.view
        const activeFolderId = stateSnapshot.activeFolderId
        const hiddenFolderIdentifiers = new Set(
            (stateSnapshot.folders || [])
                .filter(folder => folder.isHidden && !folder.trashedAt)
                .map(folder => folder.id)
        )

        let filteredNotes = Array.isArray(notes) ? notes.slice() : []
        if (view === "locked") {
            filteredNotes = filteredNotes.filter(isHiddenLocked)
        } else {
            filteredNotes = filteredNotes.filter(note => !isHiddenLocked(note))
        }

        if (view === "reminders") filteredNotes = filteredNotes.filter(note => isReminderNote(note) && !note.isArchived && !note.trashedAt)
        if (view === "trash") filteredNotes = filteredNotes.filter(note => !!note.trashedAt)
        else filteredNotes = filteredNotes.filter(note => !note.trashedAt)

        if (view === "favorites") filteredNotes = filteredNotes.filter(note => note.isFavorite && !note.isArchived)
        else if (view === "archive") filteredNotes = filteredNotes.filter(note => note.isArchived)
        else if (view === "folder") filteredNotes = filteredNotes.filter(note => note.folderId === activeFolderId)
        else if (view !== "locked" && view !== "reminders" && view !== "trash") filteredNotes = filteredNotes.filter(note => !note.isArchived)

        if (view !== "folder") {
            filteredNotes = filteredNotes.filter(note => !note.folderId || !hiddenFolderIdentifiers.has(note.folderId))
        }

        const configuredFilter = stateSnapshot.config?.notesFilter || { sort: "manual", folders: [] }
        const selectedFolders = Array.isArray(configuredFilter.folders) ? configuredFilter.folders : []
        const canUseFolderFilters = view !== "folder" && view !== "folders" && view !== "archive" && view !== "trash"

        if (canUseFolderFilters && selectedFolders.length) {
            filteredNotes = filteredNotes.filter(note => {
                if (!note.folderId) return selectedFolders.includes("none")
                return selectedFolders.includes(note.folderId)
            })
        }

        return filteredNotes
    }

    function applySearch(notes, query) {
        const normalizedQuery = String(query || "").trim()
        if (!normalizedQuery) return { notes, scores: null }
        try {
            const scoredNotes = notes.map(note => ({
                note,
                score: SmartSearch.score(normalizedQuery, note.title, note.content, note.tags, note.aiTags, note.hiddenTags)
            })).filter(item => item.score >= 0.35)
            return {
                notes: scoredNotes.map(item => item.note),
                scores: new Map(scoredNotes.map(item => [item.note.id, item.score]))
            }
        } catch (error) {
            console.error("Search failed", error)
            return { notes, scores: null }
        }
    }

    function execute(stateSnapshot, query) {
        const filteredByView = filterByView(stateSnapshot.notes || [], stateSnapshot)
        const searchResult = applySearch(filteredByView, query)
        const configuredSortMode = stateSnapshot.config?.notesFilter?.sort || "updated"
        const useRelevanceSorting = String(query || "").trim() && configuredSortMode !== "manual"
        const sortMode = useRelevanceSorting ? "relevance" : configuredSortMode
        const sortedNotes = sortMode === "manual"
            ? normalizeVisibleNotes(searchResult.notes, stateSnapshot.view === "folder" ? "folderOrder" : "order")
            : sortVisibleNotes(searchResult.notes, sortMode, sortMode === "relevance" ? searchResult.scores : null, stateSnapshot.config?.lang || "ru")
        return {
            view: stateSnapshot.view,
            notes: sortedNotes
        }
    }

    return {
        execute
    }
})()
