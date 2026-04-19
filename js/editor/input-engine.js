"use strict";

import {
    createSelectionHandlers,
    createClipboardHandlers,
    createTagHandlers,
    createEnterHandlers,
    normalizeParagraphModel,
    createEditingHistoryHandlers
} from "./input-handlers.js"

export const createInputEngine = (context) => {
    const { elements, state, queueSnapshot, fileToDataUrl, insertMedia, undo, redo, confirmEquationAtCaret } = context
    const selectionHandlers = createSelectionHandlers({ elements, state })

    const normalizeActivePage = () => {
        const page = selectionHandlers.getActivePage()
        if (!page) return false
        return normalizeParagraphModel(page)
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

    const enterHandlers = createEnterHandlers({
        elements,
        queueSnapshot,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        getActiveBlock: selectionHandlers.getActiveBlock,
        placeCaretAtStart: selectionHandlers.placeCaretAtStart,
        setSelectionRange: selectionHandlers.setSelectionRange
    })

    const tagHandlers = createTagHandlers({ elements, queueSnapshot })
    const editingHistoryHandlers = createEditingHistoryHandlers({ undo, redo })

    const handleInput = () => {
        if (state.isApplyingSnapshot) return
        queueSnapshot()
    }

    const handleKeydown = (event) => {
        if (event.defaultPrevented) return
        if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            enterHandlers.handleEnter(event)
            if (event.defaultPrevented) return
        }
        if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            if (confirmEquationAtCaret?.()) event.preventDefault()
            if (event.defaultPrevented) return
        }
        editingHistoryHandlers.handleKeydown(event)
    }

    const handleBeforeInput = (event) => {
        if (editingHistoryHandlers.handleBeforeInput(event)) return
        enterHandlers.handleBeforeInput(event)
    }

    const handleEvent = (event) => {
        if (!elements.content || !elements.content.contains(event.target) && event.target !== elements.content) return
        if (event.type === "paste") {
            clipboardHandlers.handlePaste(event)
            return
        }
        if (event.type === "copy") {
            clipboardHandlers.handleCopy(event)
            return
        }
        if (event.type === "cut") {
            clipboardHandlers.handleCut(event)
            return
        }
        if (event.type === "beforeinput") {
            handleBeforeInput(event)
            return
        }
        if (event.type === "keydown") {
            handleKeydown(event)
            return
        }
        if (event.type === "input") {
            handleInput(event)
            return
        }
        if (event.type === "keyup" || event.type === "mouseup" || event.type === "touchend") {
            selectionHandlers.storeSelection()
        }
    }

    const attachDelegatedHandlers = (container, signal) => {
        const delegatedEvents = ["paste", "copy", "cut", "beforeinput", "keydown", "input", "keyup", "mouseup", "touchend"]
        delegatedEvents.forEach(type => container.addEventListener(type, handleEvent, { signal }))
    }

    const createMutationObserver = (scheduleSnapshotFrame) => new MutationObserver((mutations) => {
        const hasStructuralChange = mutations.some(mutation => {
            if (mutation.type === "childList") return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0
            if (mutation.type === "attributes") return mutation.attributeName !== "style" || mutation.target.classList?.contains("media-wrapper")
            return false
        })
        if (hasStructuralChange) scheduleSnapshotFrame()
    })

    return {
        ...selectionHandlers,
        ...tagHandlers,
        handlePaste: clipboardHandlers.handlePaste,
        handleCopy: clipboardHandlers.handleCopy,
        handleCut: clipboardHandlers.handleCut,
        handleBeforeInput,
        handleKeydown,
        handleInput,
        attachDelegatedHandlers,
        createMutationObserver
    }
}
