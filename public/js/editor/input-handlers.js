const INLINE_TAGS = new Set(["a", "span", "strong", "b", "em", "i", "u", "s", "strike", "code", "mark", "small", "sub", "sup"])
const BLOCK_TAGS = new Set(["p", "ul", "ol", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "table"])

const isWhitespaceText = (node) => node?.nodeType === Node.TEXT_NODE && (node.textContent || "").replace(/[\s\u200b\u00a0]+/g, "") === ""

const isMediaWrapper = (node) => node?.nodeType === Node.ELEMENT_NODE
    && node.classList?.contains("media-wrapper")
    && node.getAttribute("contenteditable") === "false"

const isRootBlock = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false
    const tag = String(node.tagName || "").toLowerCase()
    return isMediaWrapper(node) || BLOCK_TAGS.has(tag)
}

const createParagraph = () => {
    const paragraph = document.createElement("p")
    paragraph.appendChild(document.createElement("br"))
    return paragraph
}

const ensureParagraphContent = (paragraph) => {
    if (!paragraph || String(paragraph.tagName || "").toLowerCase() !== "p") return
    const hasMedia = !!paragraph.querySelector("img,audio,video,table,hr,.media-wrapper")
    const text = (paragraph.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
    if (!hasMedia && !text && !paragraph.querySelector("br")) paragraph.appendChild(document.createElement("br"))
    if ((text || hasMedia) && paragraph.childNodes.length > 1) {
        Array.from(paragraph.querySelectorAll("br")).forEach(br => {
            if (br.parentNode === paragraph) br.remove()
        })
    }
}

const wrapInlineToParagraph = (node) => {
    const paragraph = document.createElement("p")
    paragraph.appendChild(node)
    ensureParagraphContent(paragraph)
    return paragraph
}

const transformNodeToRootBlocks = (node) => {
    if (!node) return []
    if (isWhitespaceText(node)) return []
    if (node.nodeType === Node.TEXT_NODE) {
        return [wrapInlineToParagraph(document.createTextNode(node.textContent || ""))]
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return []
    if (isMediaWrapper(node)) return [node]

    const tag = String(node.tagName || "").toLowerCase()

    if (tag === "br") return [createParagraph()]

    if (tag === "div" || tag === "section" || tag === "article" || tag === "main") {
        if (!node.childNodes.length) return [createParagraph()]
        const blocks = []
        let paragraphBuffer = null
        const flushParagraphBuffer = () => {
            if (!paragraphBuffer) return
            ensureParagraphContent(paragraphBuffer)
            blocks.push(paragraphBuffer)
            paragraphBuffer = null
        }
        Array.from(node.childNodes).forEach(child => {
            if (isRootBlock(child)) {
                flushParagraphBuffer()
                blocks.push(...transformNodeToRootBlocks(child))
                return
            }
            if (child.nodeType === Node.ELEMENT_NODE && String(child.tagName || "").toLowerCase() === "br") {
                if (!paragraphBuffer) {
                    blocks.push(createParagraph())
                } else {
                    flushParagraphBuffer()
                }
                return
            }
            if (!paragraphBuffer) paragraphBuffer = document.createElement("p")
            paragraphBuffer.appendChild(child)
        })
        flushParagraphBuffer()
        return blocks.length ? blocks : [createParagraph()]
    }

    if (BLOCK_TAGS.has(tag)) {
        if (tag === "p") ensureParagraphContent(node)
        return [node]
    }

    if (INLINE_TAGS.has(tag) || ["img", "audio", "video", "iframe", "canvas", "svg"].includes(tag)) {
        return [wrapInlineToParagraph(node)]
    }

    const paragraph = document.createElement("p")
    while (node.firstChild) paragraph.appendChild(node.firstChild)
    ensureParagraphContent(paragraph)
    return [paragraph]
}

const normalizeParagraphChildren = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return
    if (String(node.tagName || "").toLowerCase() !== "p") return
    const children = Array.from(node.childNodes)
    children.forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return
        const childTag = String(child.tagName || "").toLowerCase()
        if (childTag === "p") {
            while (child.firstChild) node.insertBefore(child.firstChild, child)
            child.remove()
        }
    })
    ensureParagraphContent(node)
}

export const normalizeParagraphModel = (container) => {
    if (!container) return false
    const sourceNodes = Array.from(container.childNodes || [])
    const normalized = []

    sourceNodes.forEach(node => {
        normalized.push(...transformNodeToRootBlocks(node))
    })

    if (!normalized.length) normalized.push(createParagraph())

    normalized.forEach(node => normalizeParagraphChildren(node))

    const sameLength = normalized.length === sourceNodes.length
    const sameOrder = sameLength && normalized.every((node, index) => node === sourceNodes[index])
    if (sameOrder) return false

    const fragment = document.createDocumentFragment()
    normalized.forEach(node => fragment.appendChild(node))
    container.replaceChildren(fragment)
    return true
}

export const normalizeFragmentParagraphModel = (fragment) => {
    if (!fragment) return fragment
    const container = document.createElement("div")
    container.appendChild(fragment.cloneNode(true))
    normalizeParagraphModel(container)
    const output = document.createDocumentFragment()
    while (container.firstChild) output.appendChild(container.firstChild)
    return output
}

export const createSelectionHandlers = (context) => {
    const { elements, state } = context
    const blockSelector = "p,li,blockquote,pre,h1,h2,h3,h4,h5,h6"
    const rootBlockSelector = "p,ul,ol,li,blockquote,pre,h1,h2,h3,h4,h5,h6,hr,table,.media-wrapper"
    
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

    const hasRootBlocksInNode = (node) => {
        if (!node) return false
        if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(rootBlockSelector)) return true
        if (node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE && node.nodeType !== Node.ELEMENT_NODE) return false
        return Array.from(node.childNodes || []).some(child => child?.nodeType === Node.ELEMENT_NODE && child.matches?.(rootBlockSelector))
    }

    const isEffectivelyEmptyBlock = (block) => {
        if (!block || block.nodeType !== Node.ELEMENT_NODE) return true
        const text = (block.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
        if (text) return false
        return !block.querySelector("img,audio,video,table,hr,.media-wrapper")
    }

    const getInsertedNodes = (node) => node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE
        ? Array.from(node.childNodes)
        : (node ? [node] : [])

    const createCollapsedRangeAfterNode = (parent, node) => {
        const range = document.createRange()
        if (node?.parentNode) {
            range.setStartAfter(node)
            range.collapse(true)
            return range
        }
        if (parent?.childNodes?.length) {
            range.selectNodeContents(parent)
            range.collapse(false)
            return range
        }
        range.selectNodeContents(elements.content)
        range.collapse(false)
        return range
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

    const getCaretOffsetInBlock = (block, range) => {
        const targetRange = range || getActiveRangeInContent()
        if (!targetRange || !targetRange.collapsed || !block) return null
        if (!block.contains(targetRange.startContainer) && targetRange.startContainer !== block) return null

        const nodes = getTextNodes(block)
        let offset = 0
        for (const node of nodes) {
            if (node === targetRange.startContainer) return offset + targetRange.startOffset
            offset += node.textContent?.length || 0
        }

        try {
            const preCaretRange = document.createRange()
            preCaretRange.selectNodeContents(block)
            preCaretRange.setEnd(targetRange.startContainer, targetRange.startOffset)
            return preCaretRange.toString().length
        } catch {
            return null
        }
    }

    const cloneSelectionBookmark = (bookmark) => bookmark
        ? {
            pageIndex: Number(bookmark.pageIndex) || 0,
            blockIndex: Number(bookmark.blockIndex) || 0,
            caretOffset: Math.max(0, Number(bookmark.caretOffset) || 0),
            collapsed: bookmark.collapsed !== false
        }
        : null

    const ensureCaretBlock = (page) => {
        if (!page) return null
        const blocks = getEditableBlocks(page)
        if (blocks.length) return blocks[0]
        const paragraph = document.createElement("p")
        paragraph.appendChild(document.createElement("br"))
        page.appendChild(paragraph)
        return paragraph
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
        const resolvedBlockIndex = block ? blocks.indexOf(block) : -1
        const blockIndex = resolvedBlockIndex >= 0 ? resolvedBlockIndex : (blocks.length ? 0 : -1)
        const caretOffset = range.collapsed && block ? (getCaretOffsetInBlock(block, range) ?? 0) : 0
        return {
            pageIndex,
            blockIndex,
            caretOffset,
            collapsed: !!range.collapsed
        }
    }

    const restoreRangeFromBookmark = (bookmarkValue = state.savedSelectionBookmark) => {
        const bookmark = cloneSelectionBookmark(bookmarkValue)
        if (!bookmark || !elements.content) return null
        const pages = Array.from(elements.content.querySelectorAll(".note-page"))
        const page = pages[bookmark.pageIndex]
        if (!page) return null
        const blocks = getEditableBlocks(page)
        const targetBlock = blocks.length
            ? (blocks[Math.max(0, Math.min(bookmark.blockIndex, blocks.length - 1))] || blocks[0])
            : ensureCaretBlock(page)
        const offset = Math.max(0, Number(bookmark.caretOffset) || 0)
        const offsetRange = createRangeFromOffsets(targetBlock, offset, offset)
        if (offsetRange) return offsetRange
        const fallback = document.createRange()
        fallback.selectNodeContents(targetBlock)
        fallback.collapse(true)
        return fallback
    }

    const normalizeRangeToEditableRange = (range) => {
        if (!range || !elements.content) return null
        const directBlock = getBlockFromRange(range)
        if (directBlock) return range
        const page = resolvePageFromNode(range.startContainer)
            || (range.startContainer?.nodeType === Node.ELEMENT_NODE ? range.startContainer.closest?.(".note-page") : null)
            || elements.content.querySelector(".note-page.is-active")
            || elements.content.querySelector(".note-page")
        if (!page || !elements.content.contains(page)) return null
        const blocks = getEditableBlocks(page)
        const hasBlocks = blocks.length > 0
        const offset = Number(range.startOffset) || 0
        const targetBlock = hasBlocks
            ? blocks[Math.max(0, Math.min(offset, blocks.length - 1))] || blocks[0]
            : ensureCaretBlock(page)
        if (!targetBlock) return null
        const normalizedRange = document.createRange()
        normalizedRange.selectNodeContents(targetBlock)
        normalizedRange.collapse(true)
        return normalizedRange
    }

    const resolveSafeRange = (range) => {
        if (!range || !elements.content) return null
        const isSafe = elements.content.contains(range.commonAncestorContainer) || elements.content === range.commonAncestorContainer
        if (isSafe) {
            if (range.collapsed && (range.startContainer === elements.content || range.startContainer.classList?.contains("note-page"))) {
                return normalizeRangeToEditableRange(range)
            }
            return range
        }
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
        const nextRange = resolveSafeRange(range)
        if (!nextRange) return false
        const selection = window.getSelection()
        if (!selection) return false
        selection.removeAllRanges()
        selection.addRange(nextRange)
        state.savedSelectionRange = nextRange.cloneRange()
        state.savedSelectionBookmark = buildSelectionBookmark(nextRange)
        return true
    }

    const storeSelection = () => {
        if (state.isApplyingSnapshot) return
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
            const firstBlock = ensureCaretBlock(activePage) || elements.content
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
        
        const blockInsertion = hasRootBlocksInNode(contentNode)
        let activeBlock = blockInsertion ? getBlockFromRange(range) : null
        
        if (!range.collapsed) {
            range.deleteContents()
        }
        
        if (activeBlock && !elements.content.contains(activeBlock)) {
            activeBlock = null
        }

        const insertedNodes = contentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE
            ? Array.from(contentNode.childNodes)
            : [contentNode]

        if (insertedNodes.length === 0) return false

        const lastInserted = insertedNodes[insertedNodes.length - 1]

        const activeBlockTag = String(activeBlock?.tagName || "").toLowerCase()
        const canSplitActiveBlock = !!activeBlock && activeBlockTag === "p"

        if (blockInsertion && canSplitActiveBlock) {
            const targetBlock = activeBlock
            if (targetBlock && targetBlock.parentNode) {
                const parent = targetBlock.parentNode
                const insertionPoint = targetBlock.nextSibling
                const wasEmptyBlock = isEffectivelyEmptyBlock(targetBlock)
                
                const trailingRange = document.createRange()
                trailingRange.selectNodeContents(targetBlock)
                trailingRange.setStart(range.startContainer, range.startOffset)
                const trailingContent = trailingRange.extractContents()

                if (wasEmptyBlock) targetBlock.remove()

                parent.insertBefore(contentNode, insertionPoint)

                if (!wasEmptyBlock && trailingContent.childNodes.length) {
                    const trailingBlock = document.createElement(activeBlockTag || "p")
                    trailingBlock.appendChild(trailingContent)
                    if (lastInserted?.parentNode === parent) {
                        parent.insertBefore(trailingBlock, lastInserted.nextSibling)
                    } else {
                        parent.insertBefore(trailingBlock, insertionPoint)
                    }
                }

                const selectionRange = document.createRange()
                if (lastInserted.nodeType === Node.ELEMENT_NODE) {
                    selectionRange.selectNodeContents(lastInserted)
                    selectionRange.collapse(false)
                } else {
                    selectionRange.setStartAfter(lastInserted)
                    selectionRange.collapse(true)
                }
                return setSelectionRange(selectionRange)
            }
        }

        range.insertNode(contentNode)

        const newRange = document.createRange()
        if (lastInserted.nodeType === Node.ELEMENT_NODE) {
            newRange.selectNodeContents(lastInserted)
            newRange.collapse(false)
        } else {
            newRange.setStartAfter(lastInserted)
            newRange.collapse(true)
        }

        return setSelectionRange(newRange)
    }

    const insertHtmlAtSelection = (html) => insertFragmentAtSelection(createFragmentFromHtml(html))
    const insertNodeAtSelection = (node) => insertFragmentAtSelection(node)

    const insertHorizontalRule = () => {
        const hr = document.createElement("hr")
        insertNodeAtSelection(hr)
    }

    const getSelectionBookmark = () => {
        const range = getActiveRangeInContent()
        const bookmark = range ? buildSelectionBookmark(range) : state.savedSelectionBookmark
        return cloneSelectionBookmark(bookmark)
    }

    const restoreSelectionFromBookmark = (bookmark) => {
        if (!bookmark) return false
        const range = restoreRangeFromBookmark(bookmark)
        if (!range) return false
        return setSelectionRange(range)
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
        getSelectionBookmark,
        restoreSelectionFromBookmark,
        insertHtmlAtSelection,
        insertNodeAtSelection,
        insertHorizontalRule
    }
}

const resolveEditableBlockTag = (node, fallbackTag = "p") => {
    const tagName = String(node?.tagName || "").toLowerCase()
    if (["p", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) return tagName
    return fallbackTag
}

export const createEnterHandlers = (context) => {
    const {
        elements,
        queueSnapshot,
        getActiveRangeInContent,
        getActiveBlock,
        placeCaretAtStart,
        setSelectionRange
    } = context

    const createEmptyBlock = (tagName = "p") => {
        const block = document.createElement(resolveEditableBlockTag({ tagName }))
        block.appendChild(document.createElement("br"))
        return block
    }

    const ensureEditableBlockContent = (block) => {
        if (!block) return
        const hasMedia = !!block.querySelector("img,audio,video,table,hr,.media-wrapper,.audio-block")
        const textContent = (block.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
        if (!hasMedia && !textContent && !block.querySelector("br")) {
            block.appendChild(document.createElement("br"))
        }
    }

    const getActiveListItem = (range) => {
        const targetRange = range || getActiveRangeInContent()
        if (!targetRange || !targetRange.collapsed) return null
        let node = targetRange.startContainer
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        const listItem = node?.closest("li")
        if (!listItem || !elements.content?.contains(listItem)) return null
        return listItem
    }

    const ensureEditableListItemContent = (listItem) => {
        if (!listItem) return
        const textContent = (listItem.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
        const hasMedia = !!listItem.querySelector("img,audio,video,table,hr")
        if (!textContent && !hasMedia && !listItem.querySelector("br")) {
            listItem.appendChild(document.createElement("br"))
        }
    }

    const isListItemVisuallyEmpty = (listItem) => {
        if (!listItem) return false
        if (listItem.querySelector("img,audio,video,table,hr")) return false
        const nestedList = listItem.querySelector("ul,ol")
        if (nestedList && nestedList.parentElement === listItem) return false
        return !(listItem.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
    }

    const splitListForExit = (listItem) => {
        const list = listItem?.parentElement
        if (!list || !/^(UL|OL)$/.test(list.tagName)) return null
        const trailingList = list.cloneNode(false)
        let sibling = listItem.nextElementSibling
        while (sibling) {
            const nextSibling = sibling.nextElementSibling
            trailingList.appendChild(sibling)
            sibling = nextSibling
        }
        listItem.remove()
        return {
            list,
            trailingList,
            hasLeadingItems: list.children.length > 0,
            hasTrailingItems: trailingList.children.length > 0
        }
    }

    const exitCurrentListItem = (listItem) => {
        const splitResult = splitListForExit(listItem)
        if (!splitResult) return false
        const block = createEmptyBlock("p")
        if (splitResult.hasLeadingItems) {
            splitResult.list.after(block)
            if (splitResult.hasTrailingItems) block.after(splitResult.trailingList)
        } else if (splitResult.hasTrailingItems) {
            splitResult.list.replaceWith(block)
            block.after(splitResult.trailingList)
        } else {
            splitResult.list.replaceWith(block)
        }
        placeCaretAtStart(block)
        return true
    }

    const insertListItemBreak = (listItem, range) => {
        if (!listItem || !range) return false
        const splitRange = range.cloneRange()
        splitRange.setEndAfter(listItem.lastChild || listItem)
        const trailingContent = splitRange.extractContents()
        const nextItem = document.createElement("li")
        if (trailingContent.childNodes.length) {
            nextItem.appendChild(trailingContent)
        }
        ensureEditableListItemContent(listItem)
        ensureEditableListItemContent(nextItem)
        listItem.after(nextItem)
        placeCaretAtStart(nextItem)
        return true
    }

    const applyTagLineMode = () => {
        const block = getActiveBlock()
        if (!block || !elements.content.contains(block)) return
        const text = block.textContent.trim()
        if (/^#\S+$/.test(text)) block.classList.add("tag-line")
        else block.classList.remove("tag-line")
    }

    const setCaretAtBlockStart = (block) => {
        if (!block) return false
        const range = document.createRange()
        range.selectNodeContents(block)
        range.collapse(true)
        if (typeof setSelectionRange === "function") {
            setSelectionRange(range)
            return true
        }
        placeCaretAtStart(block)
        return true
    }

    const extractTrailingContent = (block, range) => {
        const trailingRange = document.createRange()
        trailingRange.selectNodeContents(block)
        trailingRange.setStart(range.startContainer, range.startOffset)
        return trailingRange.extractContents()
    }

    const getNextTagName = (activeBlock, hasTrailingContent) => {
        const currentTag = resolveEditableBlockTag(activeBlock, "p")
        if (/^h[1-6]$/.test(currentTag) && !hasTrailingContent) {
            return "p"
        }
        return currentTag
    }

    const insertBlockBreak = (range) => {
        let node = range.startContainer
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || !elements.content.contains(node)) return false
        if (node.closest("li")) return false

        const activeBlock = getActiveBlock()
        if (!activeBlock || !elements.content.contains(activeBlock)) {
            const newBlock = createEmptyBlock("p")
            range.deleteContents()
            range.insertNode(newBlock)
            placeCaretAtStart(newBlock)
            return true
        }

        const trailingContent = extractTrailingContent(activeBlock, range)
        const trailingText = (trailingContent.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
        const hasTrailingMedia = !!trailingContent.querySelector("img,audio,video,table,hr")
        const hasRealContent = !!trailingText || hasTrailingMedia

        const nextTagName = getNextTagName(activeBlock, hasRealContent)
        const nextBlock = createEmptyBlock(nextTagName)

        if (trailingContent.childNodes.length) {
            while (nextBlock.firstChild) nextBlock.removeChild(nextBlock.firstChild)
            nextBlock.appendChild(trailingContent)
        }

        ensureEditableBlockContent(activeBlock)
        ensureEditableBlockContent(nextBlock)
        activeBlock.after(nextBlock)
        setCaretAtBlockStart(nextBlock)
        return true
    }

    const executeEnter = () => {
        const range = getActiveRangeInContent()
        if (!range || !range.collapsed) return false
        const listItem = getActiveListItem(range)
        const handled = listItem
            ? (isListItemVisuallyEmpty(listItem) ? exitCurrentListItem(listItem) : insertListItemBreak(listItem, range))
            : insertBlockBreak(range)
        
        if (!handled) return false
        applyTagLineMode()
        queueSnapshot()
        return true
    }

    const handleBeforeInput = (event) => {
        if (event.defaultPrevented) return
        if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") {
            event.preventDefault()
            executeEnter()
        }
    }

    const handleEnter = (event) => {
        if (event.key !== "Enter") return
        if (event.defaultPrevented) return
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
        event.preventDefault()
        executeEnter()
    }

    return {
        handleBeforeInput,
        handleEnter,
        handleListEnter: handleEnter
    }
}

export const createTagHandlers = (context) => {
    const { elements, queueSnapshot } = context

    const extractHashtags = (value) => {
        const output = new Set()
        const text = String(value || "")
        for (const match of text.matchAll(/#([\p{L}\p{N}_-]{2,})/gu)) {
            const tag = match[1]?.trim()
            if (tag) output.add(tag)
        }
        return [...output]
    }

    const collectSuggestedTags = (title, content) => {
        const text = `${title || ""} ${Utils.stripHtml(content || "")}`
        const smartTags = SmartSearch.suggestTags(title || "", content || "")
        const hashTags = extractHashtags(text)
        return [...new Set([...smartTags, ...hashTags])]
    }

    const syncAutoTitle = () => {
        if (!elements.title) return
        elements.title.classList.toggle("title-has-value", !!elements.title.value.trim())
    }

    const updateCurrentNoteTags = (nextTags) => {
        const currentState = StateStore.read()
        const currentNote = currentState.currentNote
        if (!currentNote) return
        const normalizedTags = [...new Set((Array.isArray(nextTags) ? nextTags : []).map(value => String(value || "").trim()).filter(Boolean))]
        const updatedNote = { ...currentNote, tags: normalizedTags }
        StateStore.set(previousState => ({
            ...previousState,
            currentNote: updatedNote,
            notes: previousState.notes.map(noteItem => noteItem.id === updatedNote.id ? { ...noteItem, tags: [...normalizedTags] } : noteItem),
            editorDirty: true
        }))
        renderTags()
        queueSnapshot()
    }

    const addTag = (tag) => {
        const normalizedTag = String(tag || "").trim().replace(/^#+/, "")
        if (!normalizedTag) return
        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        const currentTags = Array.isArray(currentNote.tags) ? [...currentNote.tags] : []
        if (currentTags.some(existingTag => existingTag.toLowerCase() === normalizedTag.toLowerCase())) return
        currentTags.push(normalizedTag)
        updateCurrentNoteTags(currentTags)
    }

    const removeTag = (tag) => {
        const normalizedTag = String(tag || "").trim().toLowerCase()
        if (!normalizedTag) return
        const currentNote = StateStore.read().currentNote
        if (!currentNote) return
        const currentTags = Array.isArray(currentNote.tags) ? currentNote.tags : []
        const filteredTags = currentTags.filter(existingTag => String(existingTag || "").trim().toLowerCase() !== normalizedTag)
        updateCurrentNoteTags(filteredTags)
    }

    const renderTags = () => {
        const note = StateStore.read().currentNote
        if (!note || !elements.tagsContainer) return
        const tags = note.tags || []

        elements.tagsContainer.innerHTML = tags.map(t => `
            <span class="tag-chip" data-action="remove-tag" data-tag="${encodeURIComponent(t)}">
                <i class="material-icons-round" aria-hidden="true">tag</i>
                <span>${Utils.escapeHtml(t)}</span>
            </span>
        `).join("")

        const suggestions = collectSuggestedTags(note.title, note.content)
            .filter(x => !tags.some(t => t.toLowerCase() === x.toLowerCase()))
            .slice(0, 5)

        if (suggestions.length) {
            const wrap = document.createElement("div")
            wrap.style.cssText = "display:flex; flex-wrap:wrap; gap:8px;"
            suggestions.forEach(t => {
                const button = document.createElement("span")
                button.className = "tag-suggest"
                button.textContent = `#${t}`
                button.dataset.action = "add-tag"
                button.dataset.tag = encodeURIComponent(t)
                wrap.appendChild(button)
            })
            elements.tagsContainer.appendChild(wrap)
        }
    }

    return {
        collectSuggestedTags,
        syncAutoTitle,
        addTag,
        removeTag,
        renderTags
    }
}


export const createClipboardHandlers = (context) => {
    const {
        queueSnapshot,
        fileToDataUrl,
        insertMedia,
        insertFragmentAtSelection,
        createFragmentFromHtml,
        getActiveRangeInContent,
        restoreSelection,
        storeSelection,
        normalizeActivePage
    } = context

    const removableWrapperTags = new Set(["div", "section", "article", "main"])
    const structuralTags = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre", "hr", "table", "tbody", "thead", "tr", "td", "th"])

    const resolveExternalMediaMessage = (error, options = {}) => {
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const descriptor = mediaService?.resolveUserFacingError?.(error, options) || (options.attachmentOnly
            ? { messageKey: "external_attachment_unavailable", fallbackMessage: "Disk is not connected, attachment unavailable" }
            : { messageKey: "external_storage_unlinked", fallbackMessage: "External storage is not connected" })
        return UI.getText(descriptor.messageKey, descriptor.fallbackMessage)
    }

    const stripOfficeNamespaces = (value) => String(value || "")
        .replace(/<\/?(?:o|v|w|m):[^>]*>/gi, "")
        .replace(/\s+xmlns(?::\w+)?="[^"]*"/gi, "")

    const normalizePastedHtml = (html) => {
        const container = document.createElement("div")
        container.innerHTML = stripOfficeNamespaces(html)

        Array.from(container.querySelectorAll("meta,link,style,script,title,xml")).forEach(node => node.remove())

        Array.from(container.querySelectorAll("span")).forEach(span => {
            const text = span.textContent || ""
            if (span.attributes.length === 0 && !text.includes("\u00a0")) {
                while (span.firstChild) span.parentNode?.insertBefore(span.firstChild, span)
                span.remove()
            }
        })

        ;["html", "body"].forEach(selector => {
            const wrapper = container.querySelector(selector)
            if (!wrapper) return
            const fragment = document.createDocumentFragment()
            while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild)
            wrapper.replaceWith(fragment)
        })

        if (container.childNodes.length === 1) {
            const onlyChild = container.firstChild
            if (onlyChild?.nodeType === Node.ELEMENT_NODE) {
                const tagName = onlyChild.tagName.toLowerCase()
                if (removableWrapperTags.has(tagName) && onlyChild.attributes.length === 0) {
                    const fragment = document.createDocumentFragment()
                    while (onlyChild.firstChild) fragment.appendChild(onlyChild.firstChild)
                    onlyChild.replaceWith(fragment)
                }
            }
        }

        return container.innerHTML
    }

    const sanitizePastedFragment = (fragment) => {
        const sanitizeNode = (node) => {
            if (!node) return null
            if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "")
            if (node.nodeType !== Node.ELEMENT_NODE) return null

            const sourceTag = String(node.tagName || "").toLowerCase()
            if (sourceTag === "br") return document.createElement("br")
            if (sourceTag === "hr") return document.createElement("hr")

            const normalizedTag = sourceTag === "div" ? "p" : sourceTag
            const keepTag = structuralTags.has(normalizedTag) ? normalizedTag : null
            const container = keepTag ? document.createElement(keepTag) : document.createDocumentFragment()

            if (keepTag === "a") {
                const href = String(node.getAttribute("href") || "").trim()
                if (/^(https?:|mailto:|tel:)/i.test(href)) {
                    container.setAttribute("href", href)
                    container.setAttribute("target", "_blank")
                    container.setAttribute("rel", "noopener noreferrer")
                }
            }

            Array.from(node.childNodes || []).forEach(child => {
                const sanitizedChild = sanitizeNode(child)
                if (sanitizedChild) container.appendChild(sanitizedChild)
            })

            if (keepTag && normalizedTag !== "br") {
                const text = (container.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
                const hasMeaningfulChildren = !!container.querySelector("img,audio,video,table,hr,br,li,ul,ol")
                if (!text && !hasMeaningfulChildren && !["p", "li", "td", "th"].includes(normalizedTag)) return null
                if (["p", "li"].includes(normalizedTag) && !text && !hasMeaningfulChildren) {
                    container.appendChild(document.createElement("br"))
                }
            }
            return container
        }

        const output = document.createDocumentFragment()
        Array.from(fragment.childNodes || []).forEach(child => {
            const sanitizedNode = sanitizeNode(child)
            if (sanitizedNode) output.appendChild(sanitizedNode)
        })
        return normalizeFragmentParagraphModel(output)
    }

    const normalizeClipboardPlainText = (value) => String(value || "")
        .replace(/\r\n?/g, "\n")
        .replace(/\u200b/g, "")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")

    const fragmentToPlainText = (node) => {
        if (!node) return ""
        const container = document.createElement("div")
        container.appendChild(node.cloneNode(true))
        const blocks = Array.from(container.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote"))
        if (!blocks.length) return normalizeClipboardPlainText(container.textContent || "")
        const lines = blocks.map(block => String(block.textContent || "").replace(/\u200b/g, "").trim())
        while (lines.length && lines[0] === "") lines.shift()
        while (lines.length && lines[lines.length - 1] === "") lines.pop()
        return lines.join("\n")
    }

    const hasRichContentWithoutText = (container) => !!container?.querySelector?.("img,audio,video,table,hr")

    const plainTextToFragment = (plainText) => {
        const fragment = document.createDocumentFragment()
        const normalizedText = String(plainText || "").replace(/\r\n?/g, "\n")
        const rows = normalizedText.split("\n")
        rows.forEach(line => {
            const paragraph = document.createElement("p")
            if (line) paragraph.textContent = line
            else paragraph.appendChild(document.createElement("br"))
            fragment.appendChild(paragraph)
        })
        return fragment
    }

    const hasRenderableNodes = (fragment) => {
        if (!fragment) return false
        const text = (fragment.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
        if (text) return true
        if (fragment.querySelector && fragment.querySelector("br,hr,p,li,ul,ol,h1,h2,h3,h4,h5,h6,blockquote,table")) return true
        return false
    }

    const handlePaste = async (event) => {
        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find(item => item.type && item.type.startsWith("image/"))
        if (imageItem) {
            event.preventDefault()
            const file = imageItem.getAsFile()
            if (!file) return
            try {
                const url = await fileToDataUrl(file)
                insertMedia(url, "image")
            } catch (error) {
                const errorCode = String(error?.message || error?.code || "")
                if (errorCode.includes("external-") || errorCode.startsWith("drive-")) {
                    UI.showToast(resolveExternalMediaMessage(error, { attachmentOnly: true }))
                    return
                }
                throw error
            }
            return
        }

        event.preventDefault()
        const ownHtml = event.clipboardData?.getData("application/x-smartnotes-html") || ""
        const html = ownHtml || event.clipboardData?.getData("text/html") || ""
        const plainText = normalizeClipboardPlainText(event.clipboardData?.getData("text/plain") || "")

        if (html) {
            const normalizedHtml = normalizePastedHtml(html)
            const sanitizedHtml = normalizedHtml ? Utils.sanitizeHtml(normalizedHtml) : ""
            if (sanitizedHtml) {
                const fragment = sanitizePastedFragment(createFragmentFromHtml(sanitizedHtml))
                if (hasRenderableNodes(fragment) && insertFragmentAtSelection(fragment)) {
                    normalizeActivePage()
                    queueSnapshot()
                    return
                }
            }
        }

        if (insertFragmentAtSelection(plainTextToFragment(plainText))) {
            normalizeActivePage()
            queueSnapshot()
        }
    }

    const handleCopy = (event) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
        const range = getActiveRangeInContent()
        if (!range) return
        const fragment = range.cloneContents()
        const container = document.createElement("div")
        container.appendChild(fragment)
        const plainText = fragmentToPlainText(container)
        if (!plainText.trim() && !hasRichContentWithoutText(container)) return
        event.preventDefault()
        event.clipboardData?.setData("text/plain", plainText)
        event.clipboardData?.setData("text/html", container.innerHTML)
        event.clipboardData?.setData("application/x-smartnotes-html", container.innerHTML)
    }

    const handleCut = (event) => {
        const range = restoreSelection() || getActiveRangeInContent()
        if (!range || range.collapsed) return
        handleCopy(event)
        if (!event.defaultPrevented) event.preventDefault()
        range.deleteContents()
        normalizeActivePage()
        storeSelection()
        queueSnapshot()
    }

    return {
        handlePaste,
        handleCopy,
        handleCut,
        normalizeClipboardPlainText,
        fragmentToPlainText
    }
}

export const createEditingHistoryHandlers = (context) => {
    const { undo, redo } = context

    const handleBeforeInput = (event) => {
        if (event.defaultPrevented) return false
        const inputType = String(event.inputType || "")
        if (inputType === "historyUndo") {
            event.preventDefault()
            undo()
            return true
        }
        if (inputType === "historyRedo") {
            event.preventDefault()
            redo()
            return true
        }
        return false
    }

    const handleKeydown = (event) => {
        if (event.defaultPrevented || event.altKey) return false
        if (!event.ctrlKey && !event.metaKey) return false
        const key = String(event.key || "").toLowerCase()
        if (key === "z") {
            event.preventDefault()
            if (event.shiftKey) redo()
            else undo()
            return true
        }
        if (key === "y") {
            event.preventDefault()
            redo()
            return true
        }
        return false
    }

    return {
        handleBeforeInput,
        handleKeydown
    }
}
