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

    const getBlockFromNode = (node) => {
        let resolved = node
        if (resolved?.nodeType === Node.TEXT_NODE) resolved = resolved.parentElement
        if (!resolved || resolved === elements.content) return null
        if (resolved.classList?.contains("note-page")) return null
        const block = resolved.closest(blockSelector)
        if (block?.classList?.contains("note-page")) return null
        return block
    }

    const getBlockFromRange = (range) => getBlockFromNode(range?.startContainer)

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

    const getCaretOffsetInBlock = (block, range) => {
        const targetRange = range || getActiveRangeInContent()
        if (!targetRange || !targetRange.collapsed || !block) return null
        const nodes = getTextNodes(block)
        let offset = 0
        for (const node of nodes) {
            if (node === targetRange.startContainer) return offset + targetRange.startOffset
            offset += node.textContent?.length || 0
        }
        return null
    }

    const buildSelectionBookmark = (range) => {
        if (!range || !elements.content) return null
        const page = resolvePageFromNode(range.startContainer)
        if (!page || !elements.content.contains(page)) return null
        const pages = Array.from(elements.content.querySelectorAll(".note-page"))
        const pageIndex = pages.indexOf(page)
        if (pageIndex < 0) return null
        const block = getBlockFromRange(range)
        const blocks = getEditableBlocks(page)
        const blockIndex = block ? blocks.indexOf(block) : -1
        const caretOffset = range.collapsed && block ? (getCaretOffsetInBlock(block, range) ?? 0) : 0
        return {
            pageIndex,
            blockIndex,
            caretOffset,
            collapsed: !!range.collapsed
        }
    }

    const restoreRangeFromBookmark = () => {
        const bookmark = state.savedSelectionBookmark
        if (!bookmark || !elements.content) return null
        const pages = Array.from(elements.content.querySelectorAll(".note-page"))
        const page = pages[bookmark.pageIndex]
        if (!page) return null
        const blocks = getEditableBlocks(page)
        const targetBlock = blocks[Math.max(0, Math.min(bookmark.blockIndex, blocks.length - 1))] || page
        const offset = Math.max(0, Number(bookmark.caretOffset) || 0)
        const offsetRange = createRangeFromOffsets(targetBlock, offset, offset)
        if (offsetRange) return offsetRange
        const fallback = document.createRange()
        fallback.selectNodeContents(targetBlock)
        fallback.collapse(true)
        return fallback
    }

    const resolveSafeRange = (range) => {
        if (!range || !elements.content) return null
        if (elements.content.contains(range.commonAncestorContainer)
            && elements.content.contains(range.startContainer)
            && elements.content.contains(range.endContainer)) return range
        return restoreRangeFromBookmark()
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
        return restoreRangeFromBookmark()
    }

    const setSelectionRange = (range) => {
        if (!range) return false
        const selection = window.getSelection()
        if (!selection) return false
        selection.removeAllRanges()
        selection.addRange(range)
        state.savedSelectionRange = range.cloneRange()
        state.savedSelectionBookmark = buildSelectionBookmark(range)
        return true
    }

    const storeSelection = () => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return
        const range = getActiveRangeInContent()
        if (!range) return
        state.savedSelectionRange = range.cloneRange()
        state.savedSelectionBookmark = buildSelectionBookmark(range)
    }

    const restoreSelection = () => {
        if (!elements.content) return null
        let range = getActiveRangeInContent()
        if (!range) {
            const activePage = elements.content.querySelector(".note-page.is-active") || elements.content.querySelector(".note-page")
            const firstBlock = getEditableBlocks(activePage)[0] || activePage || elements.content
            range = document.createRange()
            range.selectNodeContents(firstBlock)
            range.collapse(true)
        }
        setSelectionRange(range)
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
