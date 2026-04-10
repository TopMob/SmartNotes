export const createSelectionHandlers = (context) => {
    const { elements, state } = context

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

    const getActiveRangeInContent = () => {
        const selection = window.getSelection()
        if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0)
            if (elements.content && elements.content.contains(range.commonAncestorContainer)) return range
        }
        if (state.savedSelectionRange && elements.content && elements.content.contains(state.savedSelectionRange.commonAncestorContainer)) {
            return state.savedSelectionRange
        }
        return null
    }

    const storeSelection = () => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return
        const range = selection.getRangeAt(0)
        if (!elements.content || !elements.content.contains(range.commonAncestorContainer)) return
        state.savedSelectionRange = range.cloneRange()
    }

    const restoreSelection = () => {
        if (!elements.content) return null
        const selection = window.getSelection()
        let range = null
        if (state.savedSelectionRange && elements.content.contains(state.savedSelectionRange.commonAncestorContainer)) {
            range = state.savedSelectionRange
        } else if (selection && selection.rangeCount && elements.content.contains(selection.getRangeAt(0).commonAncestorContainer)) {
            range = selection.getRangeAt(0)
        } else {
            range = document.createRange()
            range.selectNodeContents(elements.content)
            range.collapse(false)
        }
        if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
        }
        return range
    }

    const getCaretOffsetInBlock = (block, range) => {
        const targetRange = range || getActiveRangeInContent()
        if (!targetRange || !targetRange.collapsed) return null
        const nodes = getTextNodes(block)
        let offset = 0
        for (const node of nodes) {
            if (node === targetRange.startContainer) {
                return offset + targetRange.startOffset
            }
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

    const getBlockFromRange = (range) => {
        let node = range.startContainer
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || node === elements.content) return null
        if (node.classList?.contains("note-page")) return null
        const block = node.closest("div, p")
        if (block?.classList?.contains("note-page")) return null
        return block
    }

    const getActiveBlock = () => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return null
        let node = selection.anchorNode
        if (!node) return null
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || node === elements.content) return null
        if (node.classList?.contains("note-page")) return null
        const block = node.closest("div, p")
        if (block?.classList?.contains("note-page")) return null
        return block
    }

    const placeCaretAtStart = (node) => {
        if (!node) return
        const selection = window.getSelection()
        if (!selection) return
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        storeSelection()
    }

    const focusEditable = (node) => {
        const selection = window.getSelection()
        if (!selection) return
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        elements.content?.focus()
    }

    const insertFragmentAtSelection = (contentNode) => {
        if (!elements.content || !contentNode) return false
        const anchorNode = contentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? contentNode.lastChild : contentNode
        if (!anchorNode) return false
        const range = restoreSelection()
        if (!range) {
            elements.content.appendChild(contentNode)
            storeSelection()
            return true
        }
        range.deleteContents()
        range.insertNode(contentNode)
        range.setStartAfter(anchorNode)
        range.collapse(true)
        const selection = window.getSelection()
        if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
        }
        storeSelection()
        return true
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
        placeCaretAtStart,
        insertHtmlAtSelection,
        insertNodeAtSelection,
        insertHorizontalRule
    }
}
