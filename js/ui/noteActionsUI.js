const NoteActionsUI = (() => {
    const decodeNoteId = (value) => decodeURIComponent(String(value || ""))

    const openActionsModal = (ui, noteId, options = {}) => {
        const normalizedNoteId = decodeNoteId(noteId)
        if (!normalizedNoteId) return true
        ui.openNoteActionsFlow(normalizedNoteId, options)
        return true
    }

    const handlers = {
        "editor-note-actions": ({ ui, event }) => {
            event?.preventDefault?.()
            event?.stopPropagation?.()
            const noteId = StateStore.read().currentNote?.id
            if (!noteId) return true
            ui.openNoteActionsFlow(noteId)
            return true
        },
        "note-pin": ({ element }) => {
            togglePin(decodeNoteId(element.dataset.noteId || ""))
            return true
        },
        "note-favorite": ({ element }) => {
            toggleFavorite(decodeNoteId(element.dataset.noteId || ""))
            return true
        },
        "note-menu": ({ ui, element, event }) => {
            event?.preventDefault?.()
            event?.stopPropagation?.()
            return openActionsModal(ui, element.dataset.noteId || "")
        },
        "lock-note-menu": ({ ui, element, event }) => {
            event?.preventDefault?.()
            event?.stopPropagation?.()
            return openActionsModal(ui, element.dataset.noteId || "", { allowLocked: true })
        },
        "note-delete": ({ element }) => {
            deleteNoteById(decodeNoteId(element.dataset.noteId || ""))
            return true
        },
        "note-copy-text": ({ element }) => {
            copyNoteTextById(decodeNoteId(element.dataset.noteId || ""))
            return true
        },
        "note-reminder-set": ({ element }) => {
            scheduleReminder(decodeNoteId(element.dataset.noteId || ""))
            return true
        },
        "note-reminder-clear": ({ element }) => {
            clearReminder(decodeNoteId(element.dataset.noteId || ""))
            return true
        },
        "note-restore": ({ element }) => {
            restoreNoteById(decodeNoteId(element.dataset.noteId || ""))
            return true
        },
        "note-move-folder": ({ ui, element }) => {
            ui.moveSelectedNoteToFolder(decodeNoteId(element.dataset.noteId || ""))
            return true
        },
        "lock-pin": ({ ui, element }) => {
            ui.toggleLockPin(element.dataset.noteId || "")
            return true
        },
        "lock-archive": ({ ui, element }) => {
            ui.toggleLockArchive(element.dataset.noteId || "")
            return true
        },
        "lock-unhide": ({ ui, element }) => {
            ui.unlockLockedNote(element.dataset.noteId || "")
            return true
        },
        "lock-remove": ({ ui, element }) => {
            ui.removeLockPermanently(element.dataset.noteId || "")
            return true
        },
        "lock-move-folder": ({ ui, element }) => {
            ui.moveLockNoteToFolder(element.dataset.noteId || "")
            return true
        }
    }

    const handle = ({ action, ui, element, event }) => {
        const handler = handlers[action]
        if (!handler) return false
        return handler({ ui, element, event, action })
    }

    return { handle }
})()

window.NoteActionsUI = NoteActionsUI
