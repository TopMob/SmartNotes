const STRIP_TAGS = new Set(["strong", "b", "em", "i", "u", "s", "strike", "a", "span", "font"])

const isElementNode = (node) => node?.nodeType === Node.ELEMENT_NODE

const normalizeTagName = (value) => String(value || "").toLowerCase()

const getClosestByTag = (node, tagName, root) => {
    let current = node
    const expectedTag = normalizeTagName(tagName)
    while (current && current !== root) {
        if (isElementNode(current) && normalizeTagName(current.tagName) === expectedTag) return current
        current = current.parentNode
    }
    return null
}

const rangeFullyInsideNode = (range, element) => {
    if (!range || !element) return false
    const startsInside = element.contains(range.startContainer)
    const endsInside = element.contains(range.endContainer)
    return startsInside && endsInside
}

const unwrapNode = (node) => {
    const parent = node?.parentNode
    if (!parent) return
    while (node.firstChild) {
        parent.insertBefore(node.firstChild, node)
    }
    node.remove()
}

const collectBlocksInRange = (range, root) => {
    if (!range || !root) return []
    const blockSet = new Set()
    const blockSelectors = "div,p,li,h1,h2,h3,h4,h5,h6,blockquote"
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let currentNode = walker.nextNode()
    while (currentNode) {
        const intersects = typeof range.intersectsNode === "function"
            ? range.intersectsNode(currentNode)
            : range.compareBoundaryPoints(Range.END_TO_START, currentNode) === -1
        if (intersects && currentNode.matches(blockSelectors)) blockSet.add(currentNode)
        currentNode = walker.nextNode()
    }
    const startBlock = isElementNode(range.startContainer)
        ? range.startContainer.closest(blockSelectors)
        : range.startContainer.parentElement?.closest(blockSelectors)
    const endBlock = isElementNode(range.endContainer)
        ? range.endContainer.closest(blockSelectors)
        : range.endContainer.parentElement?.closest(blockSelectors)
    if (startBlock && root.contains(startBlock)) blockSet.add(startBlock)
    if (endBlock && root.contains(endBlock)) blockSet.add(endBlock)
    return [...blockSet].filter(item => item && item !== root)
}

const surroundRangeWithTag = (range, tagName) => {
    const wrapper = document.createElement(tagName)
    try {
        range.surroundContents(wrapper)
    } catch {
        const fragment = range.extractContents()
        wrapper.appendChild(fragment)
        range.insertNode(wrapper)
    }
    const nextRange = document.createRange()
    nextRange.selectNodeContents(wrapper)
    nextRange.collapse(false)
    const selection = window.getSelection()
    if (selection) {
        selection.removeAllRanges()
        selection.addRange(nextRange)
    }
}

const removeInlineTagsFromFragment = (fragment) => {
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT)
    const unwrapTargets = []
    let currentNode = walker.nextNode()
    while (currentNode) {
        if (STRIP_TAGS.has(normalizeTagName(currentNode.tagName))) unwrapTargets.push(currentNode)
        currentNode = walker.nextNode()
    }
    unwrapTargets.forEach(unwrapNode)
}

const insertFragmentAndMoveCaret = (range, fragment) => {
    const lastNode = fragment.lastChild
    range.deleteContents()
    range.insertNode(fragment)
    const selection = window.getSelection()
    if (!selection) return
    const nextRange = document.createRange()
    if (lastNode) {
        nextRange.setStartAfter(lastNode)
    } else {
        nextRange.setStart(range.endContainer, range.endOffset)
    }
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)
}

const createExecCommandAdapter = (options = {}) => {
    const fallbackEnabled = options.enableFallback !== false
    const canUseExecCommand = fallbackEnabled && typeof document.execCommand === "function"
    const runCommand = (command, value = null) => {
        if (!canUseExecCommand) return false
        try {
            return document.execCommand(command, false, value)
        } catch {
            return false
        }
    }
    return {
        isAvailable: canUseExecCommand,
        runCommand
    }
}

export const createEditorCommands = (context) => {
    const { getRoot, getActiveRangeInContent, storeSelection, queueSnapshot, fallback } = context
    const execCommandAdapter = createExecCommandAdapter(fallback)

    const resolveRoot = () => getRoot?.() || null

    const getValidRange = () => {
        const root = resolveRoot()
        const range = getActiveRangeInContent()
        if (!range || !root || !root.contains(range.commonAncestorContainer)) return null
        return range
    }

    const finalizeChange = () => {
        storeSelection()
        queueSnapshot()
        resolveRoot()?.focus()
    }

    const toggleInlineFormat = (tagName, fallbackCommand) => {
        const range = getValidRange()
        if (!range || range.collapsed) {
            if (execCommandAdapter.isAvailable && fallbackCommand) {
                const changed = execCommandAdapter.runCommand(fallbackCommand)
                if (changed) finalizeChange()
            }
            return false
        }

        const root = resolveRoot()
        const startTag = getClosestByTag(range.startContainer, tagName, root)
        const endTag = getClosestByTag(range.endContainer, tagName, root)
        const commonTag = startTag && startTag === endTag && rangeFullyInsideNode(range, startTag) ? startTag : null

        if (commonTag) {
            unwrapNode(commonTag)
            finalizeChange()
            return true
        }

        surroundRangeWithTag(range, tagName)
        finalizeChange()
        return true
    }

    const getListAncestor = (range) => {
        if (!range) return null
        const node = isElementNode(range.startContainer) ? range.startContainer : range.startContainer.parentElement
        const root = resolveRoot()
        const list = node?.closest("ul,ol")
        return list && root && root.contains(list) ? list : null
    }

    const toggleList = (listTagName, fallbackCommand) => {
        const range = getValidRange()
        if (!range) return false

        const existingList = getListAncestor(range)
        if (existingList && normalizeTagName(existingList.tagName) === listTagName) {
            const fragment = document.createDocumentFragment()
            Array.from(existingList.children).forEach((item) => {
                if (normalizeTagName(item.tagName) !== "li") return
                const paragraph = document.createElement("p")
                while (item.firstChild) paragraph.appendChild(item.firstChild)
                fragment.appendChild(paragraph)
            })
            existingList.replaceWith(fragment)
            finalizeChange()
            return true
        }

        const blocks = collectBlocksInRange(range, resolveRoot())
        if (!blocks.length) {
            if (execCommandAdapter.isAvailable && fallbackCommand) {
                const changed = execCommandAdapter.runCommand(fallbackCommand)
                if (changed) finalizeChange()
                return changed
            }
            return false
        }

        const list = document.createElement(listTagName)
        blocks.forEach((block) => {
            const listItem = document.createElement("li")
            while (block.firstChild) listItem.appendChild(block.firstChild)
            list.appendChild(listItem)
        })
        blocks[0].replaceWith(list)
        blocks.slice(1).forEach(block => block.remove())
        finalizeChange()
        return true
    }

    const clearFormatting = () => {
        const range = getValidRange()
        if (!range || range.collapsed) {
            if (execCommandAdapter.isAvailable) {
                const changed = execCommandAdapter.runCommand("removeFormat")
                if (changed) finalizeChange()
                return changed
            }
            return false
        }

        const fragment = range.extractContents()
        removeInlineTagsFromFragment(fragment)
        insertFragmentAndMoveCaret(range, fragment)
        finalizeChange()
        return true
    }

    const insertLink = (value, options = {}) => {
        const url = String(value || "").trim()
        if (!url) return false
        const range = getValidRange()
        if (!range || range.collapsed) {
            if (execCommandAdapter.isAvailable) {
                const changed = execCommandAdapter.runCommand("createLink", url)
                if (changed) finalizeChange()
                return changed
            }
            return false
        }
        surroundRangeWithTag(range, "a")
        const selection = window.getSelection()
        const anchor = selection?.anchorNode?.parentElement?.closest("a")
        if (anchor) {
            if (options.noteId) {
                anchor.removeAttribute("href")
                anchor.dataset.noteId = options.noteId
            } else {
                anchor.href = url
                delete anchor.dataset.noteId
            }
        }
        finalizeChange()
        return true
    }

    const alignText = (side) => {
        const normalizedSide = side === "left" || side === "right" || side === "center" ? side : "left"
        const range = getValidRange()
        if (!range) {
            if (execCommandAdapter.isAvailable) {
                const command = normalizedSide === "center" ? "justifyCenter" : normalizedSide === "right" ? "justifyRight" : "justifyLeft"
                const changed = execCommandAdapter.runCommand(command)
                if (changed) finalizeChange()
                return changed
            }
            return false
        }
        const blocks = collectBlocksInRange(range, resolveRoot())
        if (!blocks.length) return false
        blocks.forEach(block => {
            block.style.textAlign = normalizedSide === "left" ? "" : normalizedSide
        })
        finalizeChange()
        return true
    }

    return {
        toggleBold: () => toggleInlineFormat("strong", "bold"),
        toggleItalic: () => toggleInlineFormat("em", "italic"),
        toggleUnderline: () => toggleInlineFormat("u", "underline"),
        toggleStrike: () => toggleInlineFormat("s", "strikeThrough"),
        toggleBulletedList: () => toggleList("ul", "insertUnorderedList"),
        toggleNumberedList: () => toggleList("ol", "insertOrderedList"),
        clearFormatting,
        insertLink,
        alignText
    }
}
