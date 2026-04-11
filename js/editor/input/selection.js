export const createSelectionHandlers = (context) => {
    const { elements, state } = context
    const blockSelector = "p,li,blockquote,pre,h1,h2,h3,h4,h5,h6"
    const resolvePageFromNode = (node) => node?.nodeType === Node.ELEMENT_NODE
        ? node.closest(".note-page")
        : node?.parentElement?.closest(".note-page")

    const createFragmentFromHtml = (html) => {
        const template = document.createElement("template")
        template.innerHTML = html
        return template.content.cloneNode(true)
    }

    const getTextNodes = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
        const nodes = []
        let current = walker.nextNode()
        while (current) {
            nodes.push(current)
            current = walker.nextNode()
        }
        return nodes
    }

    const getEditableBlocks = (page) => Array.from(page?.querySelectorAll?.(blockSelector) || [])

    const resolveSafeRange = (range) => {
        if (!range || !elements.content) return null
        if (!elements.content.contains(range.commonAncestorContainer)) return null
        const page = resolvePageFromNode(range.startContainer)
        if (!page || !elements.content.contains(page)) return range
        if (page.contains(range.startContainer) && page.contains(range.endContainer)) return range

        const fallback = document.createRange()
        const firstBlock = getEditableBlocks(page)[0] || page
        fallback.selectNodeContents(firstBlock)
        fallback.collapse(true)
        return fallback
    }

    const getActiveRangeInContent = () => {
        const selection = window.getSelection()
        if (selection && selection.rangeCount) {
            const range = resolveSafeRange(selection.getRangeAt(0))
            if (range) return range
        }
        if (state.savedSelectionRange) {
            const range = resolveSafeRange(state.savedSelectionRange)
            if (range) return range
        }
        return null
    }

    const setSelectionRange = (range) => {
        if (!range) return false
        const selection = window.getSelection()
        if (!selection) return false
        selection.removeAllRanges()
        selection.addRange(range)
        state.savedSelectionRange = range.cloneRange()
        return true
    }

    const storeSelection = () => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return
        const range = getActiveRangeInContent()
        if (!range) return
        state.savedSelectionRange = range.cloneRange()
    }

    const restoreSelection = () => {
        if (!elements.content) return null
        let range = getActiveRangeInContent()
        if (!range) {
            const activePage = elements.content.querySelector(".note-page.is-active") || elements.content.querySelector(".note-page")
            if (activePage) {
                const firstBlock = getEditableBlocks(activePage)[0] || activePage
                range = document.createRange()
                range.selectNodeContents(firstBlock)
                range.collapse(true)
            } else {
                range = document.createRange()
                range.selectNodeContents(elements.content)
                range.collapse(false)
            }
        }
        setSelectionRange(range)
        return range
    }

    const getCaretOffsetInBlock = (block, range) => {
        const targetRange = range || getActiveRangeInContent()
        if (!targetRange || !targetRange.collapsed) return null
        const nodes = getTextNodes(block)
        let offset = 0
        for (const node of nodes) {
            if (node === targetRange.startContainer) return offset + targetRange.startOffset
            offset += node.textContent?.length || 0
        }
        return null
    }

    const createRangeFromOffsets = (root, start, end) => {
        const range = document.createRange()
        const nodes = getTextNodes(root)
        let offset = 0
        let startNode = null
        let startOffset = 0
        let endNode = null
        let endOffset = 0
        for (const node of nodes) {
            const length = node.textContent?.length || 0
            if (!startNode && start <= offset + length) {
                startNode = node
                startOffset = Math.max(0, start - offset)
            }
            if (!endNode && end <= offset + length) {
                endNode = node
                endOffset = Math.max(0, end - offset)
            }
            offset += length
        }
        if (!startNode || !endNode) return null
        range.setStart(startNode, startOffset)
        range.setEnd(endNode, endOffset)
        return range
    }

    const placeCaretInBlockAtOffset = (block, offset) => {
        if (!block) return false
        const textLength = (block.textContent || "").length
        const safeOffset = Math.max(0, Math.min(Number(offset) || 0, textLength))
        const range = createRangeFromOffsets(block, safeOffset, safeOffset)
        if (range) return setSelectionRange(range)
        const fallback = document.createRange()
        fallback.selectNodeContents(block)
        fallback.collapse(true)
        return setSelectionRange(fallback)
    }

    const getBlockFromRange = (range) => {
        let node = range.startContainer
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || node === elements.content) return null
        if (node.classList?.contains("note-page")) return null
        const block = node.closest(blockSelector)
        if (block?.classList?.contains("note-page")) return null
        return block
    }

    const getActiveBlock = () => {
        const range = getActiveRangeInContent()
        if (!range) return null
        return getBlockFromRange(range)
    }

    const getActivePage = () => {
        const range = getActiveRangeInContent()
        if (!range) return null
        const page = resolvePageFromNode(range.startContainer)
        if (!page || !elements.content?.contains(page)) return null
        return page
    }

    const placeCaretAtStart = (node) => {
        if (!node) return
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(true)
        setSelectionRange(range)
    }

    const focusEditable = (node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(true)
        setSelectionRange(range)
        elements.content?.focus()
    }

    const insertFragmentAtSelection = (contentNode) => {
        if (!elements.content || !contentNode) return false
        const range = restoreSelection()
        if (!range) return false
        const anchorNode = contentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? contentNode.lastChild : contentNode
        if (!anchorNode) return false
        range.deleteContents()
        range.insertNode(contentNode)
        range.setStartAfter(anchorNode)
        range.collapse(true)
        return setSelectionRange(range)
    }

    const insertHtmlAtSelection = (html) => insertFragmentAtSelection(createFragmentFromHtml(html))
    const insertNodeAtSelection = (node) => insertFragmentAtSelection(node)

    const insertHorizontalRule = () => {
        const hr = document.createElement("hr")
        insertNodeAtSelection(hr)
    }

    return {
        createFragmentFromHtml,
        insertFragmentAtSelection,
        focusEditable,
        storeSelection,
        restoreSelection,
        getActiveRangeInContent,
        getBlockFromRange,
        getCaretOffsetInBlock,
        createRangeFromOffsets,
        getActiveBlock,
        getActivePage,
        placeCaretAtStart,
        placeCaretInBlockAtOffset,
        getEditableBlocks,
        setSelectionRange,
        insertHtmlAtSelection,
        insertNodeAtSelection,
        insertHorizontalRule
    }
}
