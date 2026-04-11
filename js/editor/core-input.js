import { createSelectionHandlers } from "./input/selection.js"
import { createClipboardHandlers } from "./input/clipboard.js"
import { createTagHandlers } from "./input/tags.js"
import { createEnterHandlers } from "./input/enter.js"
import { normalizeParagraphModel } from "./input/paragraph-model.js"

export const createInputHandlers = (context) => {
    const {
        elements,
        state,
        queueSnapshot,
        fileToDataUrl,
        insertMedia
    } = context

    const selectionHandlers = createSelectionHandlers({ elements, state })
    const normalizeActivePage = () => {
        const page = selectionHandlers.getActivePage()
        if (!page) return false
        return normalizeParagraphModel(page)
    }

    const handleInput = () => {
        if (normalizeActivePage()) selectionHandlers.storeSelection()
        queueSnapshot()
    }

    const clipboardHandlers = createClipboardHandlers({
        elements,
        queueSnapshot,
        fileToDataUrl,
        insertMedia,
        insertFragmentAtSelection: selectionHandlers.insertFragmentAtSelection,
        createFragmentFromHtml: selectionHandlers.createFragmentFromHtml,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        getActivePage: selectionHandlers.getActivePage,
        restoreSelection: selectionHandlers.restoreSelection,
        storeSelection: selectionHandlers.storeSelection,
        normalizeActivePage
    })

    const tagHandlers = createTagHandlers({
        elements,
        queueSnapshot
    })

    const enterHandlers = createEnterHandlers({
        elements,
        queueSnapshot,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        getActiveBlock: selectionHandlers.getActiveBlock,
        placeCaretAtStart: selectionHandlers.placeCaretAtStart,
        normalizeActivePage
    })

    const handleEquationConfirmKeyDown = (event) => {
        if (event.key !== "Enter") return
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
        if (context.confirmEquationAtCaret()) event.preventDefault()
    }

    return {
        handlePaste: clipboardHandlers.handlePaste,
        handleCopy: clipboardHandlers.handleCopy,
        handleCut: clipboardHandlers.handleCut,
        handleEquationConfirmKeyDown,
        focusEditable: selectionHandlers.focusEditable,
        storeSelection: selectionHandlers.storeSelection,
        restoreSelection: selectionHandlers.restoreSelection,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        getBlockFromRange: selectionHandlers.getBlockFromRange,
        getCaretOffsetInBlock: selectionHandlers.getCaretOffsetInBlock,
        createRangeFromOffsets: selectionHandlers.createRangeFromOffsets,
        insertHtmlAtSelection: selectionHandlers.insertHtmlAtSelection,
        insertNodeAtSelection: selectionHandlers.insertNodeAtSelection,
        insertHorizontalRule: selectionHandlers.insertHorizontalRule,
        collectSuggestedTags: tagHandlers.collectSuggestedTags,
        syncAutoTitle: tagHandlers.syncAutoTitle,
        addTag: tagHandlers.addTag,
        removeTag: tagHandlers.removeTag,
        renderTags: tagHandlers.renderTags,
        handleBeforeInput: enterHandlers.handleBeforeInput,
        handleEnterKeydown: enterHandlers.handleListEnter,
        handleInput
    }
}
