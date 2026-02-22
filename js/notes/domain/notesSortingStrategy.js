const NotesSortingStrategy = (() => {
    function normalizeDateValue(value) {
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
    function sortOwnedNotes(notes, languageCode = "ru") {
        return [...notes].sort((firstNote, secondNote) => {
            const firstOrder = Number.isFinite(firstNote?.order) ? firstNote.order : Number.POSITIVE_INFINITY
            const secondOrder = Number.isFinite(secondNote?.order) ? secondNote.order : Number.POSITIVE_INFINITY
            if (firstOrder !== secondOrder) return firstOrder - secondOrder
            const firstCreatedAt = normalizeDateValue(firstNote?.createdAt)
            const secondCreatedAt = normalizeDateValue(secondNote?.createdAt)
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            const firstUpdatedAt = normalizeDateValue(firstNote?.updatedAt)
            const secondUpdatedAt = normalizeDateValue(secondNote?.updatedAt)
            if (firstUpdatedAt !== secondUpdatedAt) return secondUpdatedAt - firstUpdatedAt
            return String(firstNote?.id || "").localeCompare(String(secondNote?.id || ""), languageCode)
        })
    }
    return { sortOwnedNotes }
})()
