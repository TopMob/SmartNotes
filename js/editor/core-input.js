export const createInputHandlers = (context) => {
    const {
        elements,
        state,
        queueSnapshot,
        fileToDataUrl,
        insertMedia
    } = context

    const removableWrapperTags = new Set(["div", "section", "article", "main"])

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

        Array.from(container.querySelectorAll("p,div")).forEach(block => {
            const hasMedia = !!block.querySelector("img,audio,video,table,hr,br")
            const text = (block.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
            if (!hasMedia && !text) block.remove()
        })

        const wrappers = ["html", "body"]
        wrappers.forEach(selector => {
            const wrapper = container.querySelector(selector)
            if (!wrapper) return
            const fragment = document.createDocumentFragment()
            while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild)
            wrapper.replaceWith(fragment)
        })

        const unwrapSingleWrapper = () => {
            if (container.childNodes.length !== 1) return
            const onlyChild = container.firstChild
            if (!onlyChild || onlyChild.nodeType !== Node.ELEMENT_NODE) return
            const tagName = onlyChild.tagName.toLowerCase()
            if (!removableWrapperTags.has(tagName)) return
            if (onlyChild.attributes.length > 0) return
            const fragment = document.createDocumentFragment()
            while (onlyChild.firstChild) fragment.appendChild(onlyChild.firstChild)
            onlyChild.replaceWith(fragment)
        }

        unwrapSingleWrapper()
        return container.innerHTML
    }

    const resolveExternalMediaMessage = (error, options = {}) => {
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const descriptor = mediaService?.resolveUserFacingError?.(error, options) || (options.attachmentOnly ? { messageKey: "external_attachment_unavailable", fallbackMessage: "Disk is not connected, attachment unavailable" } : { messageKey: "external_storage_unlinked", fallbackMessage: "External storage is not connected" })
        return UI.getText(descriptor.messageKey, descriptor.fallbackMessage)
    }

    const createFragmentFromHtml = (html) => {
        const template = document.createElement("template")
        template.innerHTML = html
        return template.content.cloneNode(true)
    }

    const structuralTags = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre"])

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
                if (!text && !hasMeaningfulChildren && normalizedTag !== "p" && normalizedTag !== "li") return null
                if ((normalizedTag === "p" || normalizedTag === "li") && !text && !hasMeaningfulChildren) {
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
        return output
    }

    const plainTextToFragment = (plainText) => {
        const fragment = document.createDocumentFragment()
        const normalizedText = String(plainText || "").replace(/\r\n?/g, "\n")
        const paragraphs = normalizedText.split("\n")
        paragraphs.forEach((line, index) => {
            if (index > 0) fragment.appendChild(document.createElement("br"))
            fragment.appendChild(document.createTextNode(line))
        })
        return fragment
    }

    const normalizeClipboardPlainText = (value) => {
        const normalized = String(value || "").replace(/\r\n?/g, "\n")
        const rows = normalized.split("\n")
        while (rows.length && rows[0].trim() === "") rows.shift()
        while (rows.length && rows[rows.length - 1].trim() === "") rows.pop()
        const compact = []
        let previousWasEmpty = false
        rows.forEach(row => {
            const isEmpty = row.trim() === ""
            if (isEmpty && previousWasEmpty) return
            compact.push(row)
            previousWasEmpty = isEmpty
        })
        return compact.join("\n")
    }

    const blockLikeTags = new Set(["p", "div", "section", "article", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"])

    const fragmentToPlainText = (fragment) => {
        const output = []
        const append = (value) => {
            if (!value) return
            output.push(value)
        }
        const appendLineBreak = () => {
            if (!output.length) return
            const last = output[output.length - 1]
            if (last === "\n") return
            output.push("\n")
        }
        const visit = (node) => {
            if (!node) return
            if (node.nodeType === Node.TEXT_NODE) {
                append(node.textContent || "")
                return
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return
            const tag = String(node.tagName || "").toLowerCase()
            if (tag === "br") {
                appendLineBreak()
                return
            }
            if (tag === "li") {
                append("• ")
            }
            Array.from(node.childNodes || []).forEach(visit)
            if (blockLikeTags.has(tag)) appendLineBreak()
        }
        Array.from(fragment.childNodes || []).forEach(visit)
        return normalizeClipboardPlainText(output.join(""))
    }

    const insertFragmentAtSelection = (contentNode) => {
        if (!elements.content || !contentNode) return false
        const nodeToAnchor = contentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE
            ? contentNode.lastChild
            : contentNode
        if (!nodeToAnchor) return false
        const range = restoreSelection()
        if (!range) {
            elements.content.appendChild(contentNode)
            storeSelection()
            return true
        }
        range.deleteContents()
        range.insertNode(contentNode)
        range.setStartAfter(nodeToAnchor)
        range.collapse(true)
        const selection = window.getSelection()
        if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
        }
        storeSelection()
        return true
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
        const smartNotesHtml = event.clipboardData?.getData("application/x-smartnotes-html") || ""
        const html = event.clipboardData?.getData("text/html") || ""
        const plainText = normalizeClipboardPlainText(event.clipboardData?.getData("text/plain") || "")
        const sourceHtml = smartNotesHtml || html
        const normalizedHtml = sourceHtml ? normalizePastedHtml(sourceHtml) : ""
        const sanitizedHtml = normalizedHtml ? Utils.sanitizeHtml(normalizedHtml) : ""
        const sanitizedFragment = sanitizedHtml ? sanitizePastedFragment(createFragmentFromHtml(sanitizedHtml)) : null
        let preparedHtml = sanitizedFragment ? (() => {
            const wrap = document.createElement("div")
            wrap.appendChild(sanitizedFragment.cloneNode(true))
            return wrap.innerHTML
        })() : ""
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const hasInlineMedia = /data:(image|audio)\//i.test(preparedHtml)
        if (preparedHtml && hasInlineMedia && !mediaService) {
            UI.showToast(resolveExternalMediaMessage(new Error("external-storage-unlinked"), { attachmentOnly: true }))
            return
        }
        if (preparedHtml && mediaService) {
            try {
                const externalizedResult = await mediaService.externalizeHtmlMedia(preparedHtml, { fileNameBase: "pasted_media" })
                preparedHtml = externalizedResult.html
                if (mediaService.containsInlineMedia?.(preparedHtml)) {
                    throw new Error("external-inline-media-blocked")
                }
            } catch (error) {
                const errorCode = String(error?.message || error?.code || "")
                if (errorCode.includes("external-") || errorCode.startsWith("drive-")) {
                    UI.showToast(resolveExternalMediaMessage(error, { attachmentOnly: true }))
                    return
                }
                throw error
            }
        }
        const hasInsertedContent = preparedHtml
            ? insertFragmentAtSelection(createFragmentFromHtml(preparedHtml))
            : (plainText ? insertFragmentAtSelection(plainTextToFragment(plainText)) : false)
        if (hasInsertedContent) queueSnapshot()
    }

    const handleCopy = (event) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
        const range = getActiveRangeInContent()
        if (!range) return
        const fragment = range.cloneContents()
        const container = document.createElement("div")
        container.appendChild(fragment)
        const plainText = fragmentToPlainText(fragment)
        if (!plainText.trim() && !container.querySelector("img,audio,video,table,hr")) return
        event.preventDefault()
        event.clipboardData?.setData("text/plain", plainText)
        event.clipboardData?.setData("text/html", container.innerHTML)
        event.clipboardData?.setData("application/x-smartnotes-html", container.innerHTML)
    }

    const handleCut = (event) => {
        const range = getActiveRangeInContent()
        if (!range || range.collapsed) return
        handleCopy(event)
        if (!event.defaultPrevented) event.preventDefault()
        range.deleteContents()
        storeSelection()
        queueSnapshot()
    }

    const handleEquationConfirmKeyDown = (event) => {
        if (event.key !== "Enter") return
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
        if (context.confirmEquationAtCaret()) event.preventDefault()
    }

    const focusEditable = (el) => {
        const sel = window.getSelection()
        if (!sel) return
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        elements.content?.focus()
    }

    const storeSelection = () => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        if (!elements.content || !elements.content.contains(range.commonAncestorContainer)) return
        state.savedSelectionRange = range.cloneRange()
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
        const sel = window.getSelection()
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0)
            if (elements.content && elements.content.contains(range.commonAncestorContainer)) return range
        }
        if (state.savedSelectionRange && elements.content && elements.content.contains(state.savedSelectionRange.commonAncestorContainer)) {
            return state.savedSelectionRange
        }
        return null
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
            const len = node.textContent?.length || 0
            if (!startNode && start <= offset + len) {
                startNode = node
                startOffset = Math.max(0, start - offset)
            }
            if (!endNode && end <= offset + len) {
                endNode = node
                endOffset = Math.max(0, end - offset)
            }
            offset += len
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

    const restoreSelection = () => {
        if (!elements.content) return null
        const sel = window.getSelection()
        let range = null
        if (state.savedSelectionRange && elements.content.contains(state.savedSelectionRange.commonAncestorContainer)) {
            range = state.savedSelectionRange
        } else if (sel && sel.rangeCount && elements.content.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            range = sel.getRangeAt(0)
        } else {
            range = document.createRange()
            range.selectNodeContents(elements.content)
            range.collapse(false)
        }
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(range)
        }
        return range
    }

    const insertHtmlAtSelection = (html) => insertFragmentAtSelection(createFragmentFromHtml(html))

    const insertNodeAtSelection = (node) => insertFragmentAtSelection(node)

    const insertHorizontalRule = () => {
        const hr = document.createElement("hr")
        insertNodeAtSelection(hr)
    }

    const extractHashtags = (value) => {
        const res = new Set()
        const text = String(value || "")
        for (const match of text.matchAll(/#([\p{L}\p{N}_-]{2,})/gu)) {
            const tag = match[1]?.trim()
            if (tag) res.add(tag)
        }
        return [...res]
    }

    const collectSuggestedTags = (title, content) => {
        const text = `${title || ""} ${Utils.stripHtml(content || "")}`
        const fromSmart = SmartSearch.suggestTags(title || "", content || "")
        const fromHash = extractHashtags(text)
        return [...new Set([...fromSmart, ...fromHash])]
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
                const b = document.createElement("span")
                b.className = "tag-suggest"
                b.textContent = `#${t}`
                b.dataset.action = "add-tag"
                b.dataset.tag = encodeURIComponent(t)
                wrap.appendChild(b)
            })
            elements.tagsContainer.appendChild(wrap)
        }
    }

    const getActiveBlock = () => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        let node = sel.anchorNode
        if (!node) return null
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
        if (!node || node === elements.content) return null
        if (node.classList?.contains("note-page")) return null
        const block = node.closest("div, p")
        if (block?.classList?.contains("note-page")) return null
        return block
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

    const createEmptyParagraph = () => {
        const paragraph = document.createElement("p")
        paragraph.appendChild(document.createElement("br"))
        return paragraph
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
        if (trailingContent.childNodes.length) {
            nextItem.appendChild(trailingContent)
        }
        ensureEditableListItemContent(listItem)
        ensureEditableListItemContent(nextItem)
        listItem.after(nextItem)
        placeCaretAtStart(nextItem)
        return true
    }

    const handleListEnter = (event) => {
        if (event.key !== "Enter") return
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
        const range = getActiveRangeInContent()
        const listItem = getActiveListItem(range)
        if (!listItem) return
        event.preventDefault()
        const handled = isListItemVisuallyEmpty(listItem)
            ? exitCurrentListItem(listItem)
            : insertListItemBreak(listItem, range)
        if (!handled) return
        queueSnapshot()
    }

    const handleTagLineEnter = (event) => {
        if (event.key !== "Enter") return
        const block = getActiveBlock()
        if (!block || !elements.content.contains(block)) return
        const text = block.textContent.trim()
        if (/^#\S+$/.test(text)) {
            event.preventDefault()
            block.classList.add("tag-line")
        } else {
            block.classList.remove("tag-line")
        }
    }

    return {
        handlePaste,
        handleCopy,
        handleCut,
        handleEquationConfirmKeyDown,
        focusEditable,
        storeSelection,
        restoreSelection,
        getActiveRangeInContent,
        getBlockFromRange,
        getCaretOffsetInBlock,
        createRangeFromOffsets,
        insertHtmlAtSelection,
        insertNodeAtSelection,
        insertHorizontalRule,
        collectSuggestedTags,
        syncAutoTitle,
        addTag,
        removeTag,
        renderTags,
        handleTagLineEnter,
        handleListEnter
    }
}
