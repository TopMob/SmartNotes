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

export const createMathHandlers = (context) => {
    const {
        elements,
        state,
        getActiveRangeInContent,
        getBlockFromRange,
        getCaretOffsetInBlock,
        createRangeFromOffsets,
        getPages,
        queueSnapshot
    } = context

    const confirmEquationAtCaret = () => {
        const range = getActiveRangeInContent()
        if (!range || !range.collapsed) return false
        const target = getBlockFromRange(range) || getPages()[state.pageIndex] || elements.content
        if (!target) return false
        const caretOffset = getCaretOffsetInBlock(target, range)
        if (caretOffset === null) return false
        const fullText = target.textContent || ""
        const expressionData = window.Calculator?.findExpressionAroundCaret?.(fullText, caretOffset)
        if (!expressionData) return false
        const result = window.Calculator?.evaluateExpression?.(expressionData.expression)
        if (!Number.isFinite(result)) return false
        const replaceRange = createRangeFromOffsets(target, expressionData.start, expressionData.end)
        if (!replaceRange) return false
        replaceRange.deleteContents()
        const formatted = window.Calculator?.formatResult?.(result) ?? String(result)
        replaceRange.insertNode(document.createTextNode(formatted))
        replaceRange.collapse(false)
        const sel = window.getSelection()
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(replaceRange)
        }
        queueSnapshot()
        return true
    }

    const confirmEquation = () => {
        confirmEquationAtCaret()
    }

    return { confirmEquationAtCaret, confirmEquation }
}
