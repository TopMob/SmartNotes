export const createEnterHandlers = (context) => {
    const {
        elements,
        queueSnapshot,
        getActiveRangeInContent,
        getActiveBlock,
        placeCaretAtStart
    } = context

    const createEmptyParagraph = () => {
        const paragraph = document.createElement("p")
        paragraph.appendChild(document.createElement("br"))
        return paragraph
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
        const paragraph = createEmptyParagraph()
        if (splitResult.hasLeadingItems) {
            splitResult.list.after(paragraph)
            if (splitResult.hasTrailingItems) paragraph.after(splitResult.trailingList)
        } else if (splitResult.hasTrailingItems) {
            splitResult.list.replaceWith(paragraph)
            paragraph.after(splitResult.trailingList)
        } else {
            splitResult.list.replaceWith(paragraph)
        }
        placeCaretAtStart(paragraph)
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

    const insertParagraphBreak = (range) => {
        let node = range.startContainer
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || !elements.content.contains(node)) return false
        if (node.closest("li")) return false

        const activeBlock = getActiveBlock()
        if (!activeBlock || !elements.content.contains(activeBlock)) {
            const newParagraph = createEmptyParagraph()
            range.deleteContents()
            range.insertNode(newParagraph)
            placeCaretAtStart(newParagraph)
            return true
        }

        const splitRange = range.cloneRange()
        splitRange.setEndAfter(activeBlock.lastChild || activeBlock)
        const trailingContent = splitRange.extractContents()
        const nextParagraph = createEmptyParagraph()
        if (trailingContent.childNodes.length) {
            nextParagraph.innerHTML = ""
            nextParagraph.appendChild(trailingContent)
        }
        ensureEditableBlockContent(activeBlock)
        ensureEditableBlockContent(nextParagraph)
        activeBlock.after(nextParagraph)
        placeCaretAtStart(nextParagraph)
        return true
    }

    const executeEnter = () => {
        const range = getActiveRangeInContent()
        if (!range || !range.collapsed) return false
        const listItem = getActiveListItem(range)
        const handled = listItem
            ? (isListItemVisuallyEmpty(listItem) ? exitCurrentListItem(listItem) : insertListItemBreak(listItem, range))
            : insertParagraphBreak(range)
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
