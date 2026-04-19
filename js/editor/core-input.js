import { createSelectionHandlers } from "./input/selection.js"
import { createClipboardHandlers } from "./input/clipboard.js"
import { createTagHandlers } from "./input/tags.js"
import { createEnterHandlers } from "./input/enter.js"
import { createEditingHistoryHandlers } from "./input/editing-history.js"
import { normalizeParagraphModel } from "./input/paragraph-model.js"

export const createInputHandlers = (context) => {
    const {
        elements,
        state,
        queueSnapshot,
        fileToDataUrl,
        insertMedia,
        undo,
        redo
    } = context

    const selectionHandlers = createSelectionHandlers({ elements, state })

    const normalizeActivePage = () => {
        const page = selectionHandlers.getActivePage()
        if (!page) return false
        return normalizeParagraphModel(page)
    }

    const normalizeActivePageWithCaretRestore = () => {
        const page = selectionHandlers.getActivePage()
        const range = selectionHandlers.getActiveRangeInContent()
        if (!page || !range || !range.collapsed) return normalizeActivePage()
        const activeBlock = selectionHandlers.getBlockFromRange(range)
        const caretOffset = activeBlock ? selectionHandlers.getCaretOffsetInBlock(activeBlock, range) : null
        const sourceBlocks = selectionHandlers.getEditableBlocks(page)
        const blockIndex = activeBlock ? sourceBlocks.indexOf(activeBlock) : -1
        const changed = normalizeParagraphModel(page)
        if (!changed) return false
        if (blockIndex < 0) {
            selectionHandlers.storeSelection()
            return true
        }
        const normalizedBlocks = selectionHandlers.getEditableBlocks(page)
        const targetBlock = normalizedBlocks[Math.min(blockIndex, normalizedBlocks.length - 1)]
        if (!targetBlock) {
            selectionHandlers.storeSelection()
            return true
        }
        if (!selectionHandlers.placeCaretInBlockAtOffset(targetBlock, caretOffset ?? 0)) {
            selectionHandlers.storeSelection()
        }
        return true
    }

    const handleInput = () => {
        if (state.isApplyingSnapshot) return
        queueSnapshot()
    }

    const clipboardHandlers = createClipboardHandlers({
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

    const editingHistoryHandlers = createEditingHistoryHandlers({
        undo,
        redo
    })

    const enterHandlers = createEnterHandlers({
        elements,
        queueSnapshot,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        getActiveBlock: selectionHandlers.getActiveBlock,
        placeCaretAtStart: selectionHandlers.placeCaretAtStart,
        setSelectionRange: selectionHandlers.setSelectionRange
    })

    const handleEquationConfirmKeyDown = (event) => {
        if (event.key !== "Enter") return
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
        if (context.confirmEquationAtCaret()) event.preventDefault()
    }

    const handleBeforeInput = (event) => {
        if (editingHistoryHandlers.handleBeforeInput(event)) return
        enterHandlers.handleBeforeInput(event)
    }

    return {
        handlePaste: clipboardHandlers.handlePaste,
        handleCopy: clipboardHandlers.handleCopy,
        handleCut: clipboardHandlers.handleCut,
        handleEquationConfirmKeyDown,
        focusEditable: selectionHandlers.focusEditable,
        storeSelection: selectionHandlers.storeSelection,
        restoreSelection: selectionHandlers.restoreSelection,
        getSelectionBookmark: selectionHandlers.getSelectionBookmark,
        restoreSelectionFromBookmark: selectionHandlers.restoreSelectionFromBookmark,
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
        handleBeforeInput,
        handleEnterKeydown: enterHandlers.handleEnter,
        handleHistoryKeydown: editingHistoryHandlers.handleKeydown,
        handleInput
    }
}