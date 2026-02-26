const STRIP_TAGS = new Set(["strong", "b", "em", "i", "u", "s", "strike", "a", "span", "font"])

const INLINE_FORMATS = {
    bold: { wrapperTagName: "strong", toggleTagNames: ["strong", "b"], fallbackCommand: "bold" },
    italic: { wrapperTagName: "em", toggleTagNames: ["em", "i"], fallbackCommand: "italic" },
    underline: { wrapperTagName: "u", toggleTagNames: ["u"], fallbackCommand: "underline" },
    strike: { wrapperTagName: "s", toggleTagNames: ["s", "strike"], fallbackCommand: "strikeThrough" }
}

const isElementNode = (node) => node?.nodeType === Node.ELEMENT_NODE

const normalizeTagName = (value) => String(value || "").toLowerCase()

const normalizeTagNameList = (tagNames) => {
    if (!Array.isArray(tagNames)) return []
    return [...new Set(tagNames.map(item => normalizeTagName(item)).filter(Boolean))]
}

const getClosestByTagNames = (node, tagNames, root) => {
    const expectedTags = new Set(normalizeTagNameList(tagNames))
    if (!expectedTags.size) return null
    let current = node
    while (current && current !== root) {
        if (isElementNode(current) && expectedTags.has(normalizeTagName(current.tagName))) return current
        current = current.parentNode
    }
    return null
}

const getNearestElement = (node) => {
    if (!node) return null
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
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

const isEditableTextBlock = (element, root) => {
    if (!element || !root || element === root) return false
    if (!root.contains(element)) return false
    if (!isElementNode(element)) return false
    if (element.closest("[contenteditable='false']")) return false
    const name = normalizeTagName(element.tagName)
    if (!["div", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"].includes(name)) return false
    return true
}

const getClosestEditableBlock = (node, root) => {
    const element = isElementNode(node) ? node : node?.parentElement
    if (!element) return null
    const block = element.closest("div,p,li,h1,h2,h3,h4,h5,h6,blockquote")
    return isEditableTextBlock(block, root) ? block : null
}

const collectBlocksInRange = (range, root) => {
    if (!range || !root) return []
    const blockSet = new Set()
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let currentNode = walker.nextNode()
    while (currentNode) {
        const intersects = typeof range.intersectsNode === "function"
            ? range.intersectsNode(currentNode)
            : range.compareBoundaryPoints(Range.END_TO_START, currentNode) === -1
        if (intersects && isEditableTextBlock(currentNode, root)) blockSet.add(currentNode)
        currentNode = walker.nextNode()
    }
    const startBlock = getClosestEditableBlock(range.startContainer, root)
    const endBlock = getClosestEditableBlock(range.endContainer, root)
    if (startBlock) blockSet.add(startBlock)
    if (endBlock) blockSet.add(endBlock)
    return [...blockSet]
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
    const selection = window.getSelection()
    if (selection) {
        selection.removeAllRanges()
        selection.addRange(nextRange)
    }
    return wrapper
}

const getTextNodesInRange = (range, root) => {
    if (!range || !root) return []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const textNodes = []
    let currentNode = walker.nextNode()
    while (currentNode) {
        const hasText = (currentNode.textContent || "").trim().length > 0
        if (hasText && range.intersectsNode(currentNode)) textNodes.push(currentNode)
        currentNode = walker.nextNode()
    }
    return textNodes
}

const isRangeFullyWrappedWithTagNames = (range, tagNames, root) => {
    const textNodes = getTextNodesInRange(range, root)
    if (!textNodes.length) return false
    return textNodes.every(node => !!getClosestByTagNames(node, tagNames, root))
}

const removeTagsFromFragment = (fragment, tagNames) => {
    const targetTagNames = new Set(normalizeTagNameList(tagNames))
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT)
    const unwrapTargets = []
    let currentNode = walker.nextNode()
    while (currentNode) {
        if (targetTagNames.has(normalizeTagName(currentNode.tagName))) unwrapTargets.push(currentNode)
        currentNode = walker.nextNode()
    }
    unwrapTargets.forEach(unwrapNode)
}

const insertFragmentAndReselect = (range, fragment) => {
    const firstNode = fragment.firstChild
    const lastNode = fragment.lastChild
    range.deleteContents()
    range.insertNode(fragment)
    const selection = window.getSelection()
    if (!selection) return
    const nextRange = document.createRange()
    if (firstNode && lastNode) {
        nextRange.setStartBefore(firstNode)
        nextRange.setEndAfter(lastNode)
    } else {
        nextRange.setStart(range.endContainer, range.endOffset)
        nextRange.collapse(true)
    }
    selection.removeAllRanges()
    selection.addRange(nextRange)
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

    const toggleInlineFormat = (formatDefinition) => {
        const range = getValidRange()
        const fallbackCommand = formatDefinition?.fallbackCommand

        if (execCommandAdapter.isAvailable && fallbackCommand) {
            const changed = execCommandAdapter.runCommand(fallbackCommand)
            if (changed) {
                finalizeChange()
                return true
            }
        }

        if (!range || range.collapsed) return false

        const root = resolveRoot()
        if (!root) return false

        const toggleTagNames = normalizeTagNameList(formatDefinition?.toggleTagNames)
        const wrapperTagName = normalizeTagName(formatDefinition?.wrapperTagName)
        if (!toggleTagNames.length || !wrapperTagName) return false

        const startElement = getNearestElement(range.startContainer)
        const endElement = getNearestElement(range.endContainer)
        const startTag = getClosestByTagNames(startElement, toggleTagNames, root)
        const endTag = getClosestByTagNames(endElement, toggleTagNames, root)
        const singleWrappedContainer = startTag && startTag === endTag && rangeFullyInsideNode(range, startTag)
        const fullWrappedRange = isRangeFullyWrappedWithTagNames(range, toggleTagNames, root)

        if (singleWrappedContainer || fullWrappedRange) {
            const fragment = range.extractContents()
            removeTagsFromFragment(fragment, toggleTagNames)
            insertFragmentAndReselect(range, fragment)
            finalizeChange()
            return true
        }

        surroundRangeWithTag(range, wrapperTagName)
        finalizeChange()
        return true
    }

    const convertListType = (existingList, nextListTagName) => {
        const replacementList = document.createElement(nextListTagName)
        while (existingList.firstChild) {
            replacementList.appendChild(existingList.firstChild)
        }
        existingList.replaceWith(replacementList)
        return replacementList
    }

    const placeCaretAtEndOfNode = (node) => {
        if (!node) return
        const selection = window.getSelection()
        if (!selection) return
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
    }

    const getListAncestor = (range) => {
        if (!range) return null
        const node = isElementNode(range.startContainer) ? range.startContainer : range.startContainer.parentElement
        const root = resolveRoot()
        const list = node?.closest("ul,ol")
        if (!list || !root || !root.contains(list)) return null
        if (list.closest("[contenteditable='false']")) return null
        return list
    }

    const toggleList = (listTagName) => {
        const fallbackCommand = listTagName === "ol" ? "insertOrderedList" : "insertUnorderedList"
        if (execCommandAdapter.isAvailable && fallbackCommand) {
            const changed = execCommandAdapter.runCommand(fallbackCommand)
            if (changed) {
                finalizeChange()
                return true
            }
        }

        const range = getValidRange()
        if (!range) return false

        const existingList = getListAncestor(range)
        if (existingList) {
            const existingListTagName = normalizeTagName(existingList.tagName)
            if (existingListTagName === listTagName) {
                const fragment = document.createDocumentFragment()
                const paragraphs = []
                Array.from(existingList.children).forEach((item) => {
                    if (normalizeTagName(item.tagName) !== "li") return
                    const paragraph = document.createElement("p")
                    while (item.firstChild) paragraph.appendChild(item.firstChild)
                    paragraphs.push(paragraph)
                    fragment.appendChild(paragraph)
                })
                existingList.replaceWith(fragment)
                placeCaretAtEndOfNode(paragraphs[paragraphs.length - 1] || paragraphs[0] || resolveRoot())
                finalizeChange()
                return true
            }
            const convertedList = convertListType(existingList, listTagName)
            placeCaretAtEndOfNode(convertedList.lastElementChild || convertedList)
            finalizeChange()
            return true
        }

        const root = resolveRoot()
        const blocks = collectBlocksInRange(range, root)
        if (!blocks.length) return false

        const list = document.createElement(listTagName)
        blocks.forEach((block) => {
            const listItem = document.createElement("li")
            while (block.firstChild) listItem.appendChild(block.firstChild)
            list.appendChild(listItem)
        })
        blocks[0].replaceWith(list)
        blocks.slice(1).forEach(block => block.remove())
        placeCaretAtEndOfNode(list.lastElementChild || list)
        finalizeChange()
        return true
    }

    const clearFormatting = () => {
        const range = getValidRange()
        if (execCommandAdapter.isAvailable) {
            const unlinked = execCommandAdapter.runCommand("unlink")
            const removed = execCommandAdapter.runCommand("removeFormat")
            if (unlinked || removed) {
                finalizeChange()
                return true
            }
        }
        if (!range || range.collapsed) return false

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
        const anchor = surroundRangeWithTag(range, "a")
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
        toggleBold: () => toggleInlineFormat(INLINE_FORMATS.bold),
        toggleItalic: () => toggleInlineFormat(INLINE_FORMATS.italic),
        toggleUnderline: () => toggleInlineFormat(INLINE_FORMATS.underline),
        toggleStrike: () => toggleInlineFormat(INLINE_FORMATS.strike),
        toggleBulletedList: () => toggleList("ul"),
        toggleNumberedList: () => toggleList("ol"),
        clearFormatting,
        insertLink,
        alignText
    }
}
