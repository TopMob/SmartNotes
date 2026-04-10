const resolveEditableBlockTag = (node, fallbackTag = "div") => {
    const tagName = String(node?.tagName || "").toLowerCase()
    if (["div", "p", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) return tagName
    return fallbackTag
}

export const createEnterHandlers = (context) => {
    const {
        elements,
        queueSnapshot,
        getActiveRangeInContent,
        getActiveBlock,
        placeCaretAtStart
    } = context

    const createEmptyBlock = (tagName = "div") => {
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
        if (!textContent && !hasMedia && !listItem.querySelector("br")) listItem.appendChild(document.createElement("br"))
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
        const block = createEmptyBlock("div")
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
        if (trailingContent.childNodes.length) nextItem.appendChild(trailingContent)
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

    const insertBlockBreak = (range) => {
        let node = range.startContainer
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || !elements.content.contains(node)) return false
        if (node.closest("li")) return false

        const activeBlock = getActiveBlock()
        if (!activeBlock || !elements.content.contains(activeBlock)) {
            const newBlock = createEmptyBlock("div")
            range.deleteContents()
            range.insertNode(newBlock)
            placeCaretAtStart(newBlock)
            return true
        }

        const nextTagName = resolveEditableBlockTag(activeBlock, "div")
        const splitRange = range.cloneRange()
        splitRange.setEndAfter(activeBlock.lastChild || activeBlock)
        const trailingContent = splitRange.extractContents()
        const nextBlock = createEmptyBlock(nextTagName)
        if (trailingContent.childNodes.length) {
            nextBlock.innerHTML = ""
            nextBlock.appendChild(trailingContent)
        }
        ensureEditableBlockContent(activeBlock)
        ensureEditableBlockContent(nextBlock)
        activeBlock.after(nextBlock)
        placeCaretAtStart(nextBlock)
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
        if (event.inputType !== "insertParagraph") return
        event.preventDefault()
        executeEnter()
    }

    const handleListEnter = (event) => {
        if (event.key !== "Enter") return
        if (event.defaultPrevented) return
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
        event.preventDefault()
        executeEnter()
    }

    return {
        handleBeforeInput,
        handleListEnter
    }
}
