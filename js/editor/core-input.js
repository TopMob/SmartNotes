import { createSelectionHandlers } from "./input/selection.js"
import { createClipboardHandlers } from "./input/clipboard.js"
import { createTagHandlers } from "./input/tags.js"
import { createEnterHandlers } from "./input/enter.js"

export const createInputHandlers = (context) => {
    const {
        elements,
        state,
        queueSnapshot,
        fileToDataUrl,
        insertMedia
    } = context

    const selectionHandlers = createSelectionHandlers({ elements, state })

    const clipboardHandlers = createClipboardHandlers({
        elements,
        queueSnapshot,
        fileToDataUrl,
        insertMedia,
        insertFragmentAtSelection: selectionHandlers.insertFragmentAtSelection,
        createFragmentFromHtml: selectionHandlers.createFragmentFromHtml,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        restoreSelection: selectionHandlers.restoreSelection,
        storeSelection: selectionHandlers.storeSelection
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
        placeCaretAtStart: selectionHandlers.placeCaretAtStart
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
        handleEnterKeydown: enterHandlers.handleListEnter
    }
}
