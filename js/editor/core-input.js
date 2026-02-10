export const createInputHandlers = (context) => {
    const {
        elements,
        state,
        queueSnapshot,
        fileToDataUrl,
        insertMedia
    } = context

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
        const text = event.clipboardData.getData("text/plain")
        const html = event.clipboardData.getData("text/html")

        let safeContent = text
        if (html) {
            const div = document.createElement("div")
            div.innerHTML = html
            div.querySelectorAll("*").forEach(el => {
                el.removeAttribute("style")
                el.removeAttribute("class")
                if (el.tagName === "IMG") el.remove()
            })
            safeContent = div.innerHTML
        }

        document.execCommand("insertHTML", false, safeContent || text)
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

    const insertHtmlAtSelection = (html) => {
        if (!elements.content) return
        const range = restoreSelection()
        const container = document.createElement("div")
        container.innerHTML = html
        const fragment = document.createDocumentFragment()
        while (container.firstChild) fragment.appendChild(container.firstChild)
        if (range) {
            range.deleteContents()
            range.insertNode(fragment)
            range.collapse(false)
            const sel = window.getSelection()
            if (sel) {
                sel.removeAllRanges()
                sel.addRange(range)
            }
        } else {
            elements.content.appendChild(fragment)
        }
        storeSelection()
    }

    const insertNodeAtSelection = (node) => {
        if (!elements.content) return
        const range = restoreSelection()
        if (range) {
            range.deleteContents()
            range.insertNode(node)
            range.setStartAfter(node)
            range.collapse(true)
            const sel = window.getSelection()
            if (sel) {
                sel.removeAllRanges()
                sel.addRange(range)
            }
        } else {
            elements.content.appendChild(node)
        }
        storeSelection()
    }

    const normalizeStrikeTags = () => {
        if (!elements.content) return
        elements.content.querySelectorAll("strike").forEach(strike => {
            const replacement = document.createElement("s")
            while (strike.firstChild) replacement.appendChild(strike.firstChild)
            strike.replaceWith(replacement)
        })
    }

    const toggleStrikeThrough = () => {
        document.execCommand("strikeThrough")
        normalizeStrikeTags()
    }

    const insertHorizontalRule = () => {
        const hr = document.createElement("hr")
        insertNodeAtSelection(hr)
    }

    const wrapSelectionWithNode = (node) => {
        const range = getActiveRangeInContent()
        if (!range || range.collapsed) return null
        const content = range.extractContents()
        node.appendChild(content)
        range.insertNode(node)
        const nextRange = document.createRange()
        nextRange.selectNodeContents(node)
        nextRange.collapse(false)
        const sel = window.getSelection()
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(nextRange)
        }
        storeSelection()
        return node
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

    const addTag = (tag) => {
        const normalizedTag = String(tag || "").trim().replace(/^#+/, "")
        if (!normalizedTag) return
        const note = StateStore.read().currentNote
        const tags = note.tags ? [...note.tags] : []
        if (tags.some(x => x.toLowerCase() === normalizedTag.toLowerCase())) return

        tags.push(normalizedTag)
        StateStore.update("currentNote", { ...note, tags })
        renderTags()
        queueSnapshot()
    }

    const removeTag = (tag) => {
        const note = StateStore.read().currentNote
        if (!note) return
        const tags = (note.tags || []).filter(x => x.toLowerCase() !== tag.toLowerCase())
        StateStore.update("currentNote", { ...note, tags })
        renderTags()
        queueSnapshot()
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
        getActiveRangeInContent,
        getBlockFromRange,
        getCaretOffsetInBlock,
        createRangeFromOffsets,
        insertHtmlAtSelection,
        insertNodeAtSelection,
        toggleStrikeThrough,
        insertHorizontalRule,
        wrapSelectionWithNode,
        collectSuggestedTags,
        syncAutoTitle,
        addTag,
        removeTag,
        renderTags,
        handleTagLineEnter
    }
}
