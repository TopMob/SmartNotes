export const createLinkHandlers = (context) => {
    const { getActiveRangeInContent, openFromList, getEditorCommands } = context

    const normalizeUrl = (value) => {
        const url = String(value || "").trim()
        if (!url) return ""
        if (/^https?:\/\//i.test(url)) return url
        if (/^mailto:/i.test(url)) return url
        if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) return `https://${url}`
        return url
    }

    const applyLink = (value) => {
        const url = normalizeUrl(value)
        if (!url) return
        const range = getActiveRangeInContent()
        if (!range || range.collapsed) {
            UI.showToast(UI.getText("link_selection_required", "Select text to link"))
            return
        }
        getEditorCommands()?.insertLink(url)
    }

    const openNoteById = (noteId) => {
        const note = StateStore.read().notes.find(item => item.id === noteId)
        if (!note) {
            UI.showToast(UI.getText("note_link_not_found", "Note not found"))
            return
        }
        openFromList(note)
    }

    return {
        applyLink,
        openNoteById
    }
}
