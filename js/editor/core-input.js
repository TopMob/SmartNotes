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

    const createFragmentFromHtml = (html) => {
        const template = document.createElement("template")
        template.innerHTML = html
        return template.content.cloneNode(true)
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
            const url = await fileToDataUrl(file)
            insertMedia(url, "image")
            return
        }

        event.preventDefault()
        const html = event.clipboardData?.getData("text/html") || ""
        const plainText = event.clipboardData?.getData("text/plain") || ""
        const normalizedHtml = html ? normalizePastedHtml(html) : ""
        const sanitizedHtml = normalizedHtml ? Utils.sanitizeHtml(normalizedHtml) : ""
        const hasInsertedContent = sanitizedHtml
            ? insertFragmentAtSelection(createFragmentFromHtml(sanitizedHtml))
            : (plainText ? insertFragmentAtSelection(document.createTextNode(plainText)) : false)
        if (hasInsertedContent) queueSnapshot()
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
        handleTagLineEnter
    }
}
