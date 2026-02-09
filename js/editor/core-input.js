const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(item => item.type && item.type.startsWith("image/"))
    if (imageItem) {
        e.preventDefault()
        const file = imageItem.getAsFile()
        if (!file) return
        const url = await fileToDataUrl(file)
        insertMedia(url, "image")
        return
    }

    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    const html = e.clipboardData.getData("text/html")

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

const handleEquationConfirmKeyDown = (e) => {
    if (e.key !== "Enter") return
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
    if (confirmEquationAtCaret()) e.preventDefault()
}

const focusEditable = (el) => {
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    els.content?.focus()
}

const storeSelection = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!els.content || !els.content.contains(range.commonAncestorContainer)) return
    savedRange = range.cloneRange()
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
        if (els.content && els.content.contains(range.commonAncestorContainer)) return range
    }
    if (savedRange && els.content && els.content.contains(savedRange.commonAncestorContainer)) return savedRange
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
    if (!node || node === els.content) return null
    if (node.classList?.contains("note-page")) return null
    const block = node.closest("div, p")
    if (block?.classList?.contains("note-page")) return null
    return block
}

const restoreSelection = () => {
    if (!els.content) return null
    const sel = window.getSelection()
    let range = null
    if (savedRange && els.content.contains(savedRange.commonAncestorContainer)) {
        range = savedRange
    } else if (sel && sel.rangeCount && els.content.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        range = sel.getRangeAt(0)
    } else {
        range = document.createRange()
        range.selectNodeContents(els.content)
        range.collapse(false)
    }
    if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
    }
    return range
}

const insertHtmlAtSelection = (html) => {
    if (!els.content) return
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
        els.content.appendChild(fragment)
    }
    storeSelection()
}

const insertNodeAtSelection = (node) => {
    if (!els.content) return
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
        els.content.appendChild(node)
    }
    storeSelection()
}

const normalizeStrikeTags = () => {
    if (!els.content) return
    els.content.querySelectorAll("strike").forEach(strike => {
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

const getTextFromHtml = (html) => {
    const text = Utils.stripHtml(html || "")
    return text.replace(/\s+/g, " ").trim()
}

const getMediaCountsFromHtml = (html) => {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = html || ""
    return {
        images: wrapper.querySelectorAll("img").length,
        audio: wrapper.querySelectorAll("audio").length
    }
}

const getCountLabel = (count, singleKey, pluralKey) => {
    if (count === 1) return UI.getText(singleKey, singleKey)
    return UI.getText(pluralKey, UI.getText(singleKey, singleKey))
}

const formatMediaSummary = (counts) => {
    const parts = []
    if (counts.images) {
        parts.push(`${counts.images} ${getCountLabel(counts.images, "media_photo", "media_photos")}`)
    }
    if (counts.audio) {
        parts.push(`${counts.audio} ${getCountLabel(counts.audio, "media_audio", "media_audios")}`)
    }
    return parts.join(" · ")
}

const buildAutoTitle = (html) => {
    const text = getTextFromHtml(html)
    if (text) {
        const line = text.split(/\r?\n/).find(l => l.trim()) || text
        const normalized = line.trim()
        return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized
    }
    return formatMediaSummary(getMediaCountsFromHtml(html)) || UI.getText("untitled_note", "Untitled")
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
    if (!els.title || titleTouched) return
    const html = els.content?.innerHTML || ""
    const next = buildAutoTitle(html)
    if (!next) return
    if (els.title.value !== next) els.title.value = next
}

const addTag = (tag) => {
    const t = String(tag || "").trim().replace(/^#+/, "")
    if (!t) return
    const n = StateStore.read().currentNote
    const tags = n.tags ? [...n.tags] : []
    if (tags.some(x => x.toLowerCase() === t.toLowerCase())) return

    tags.push(t)
    StateStore.update("currentNote", { ...n, tags })
    renderTags()
    queueSnapshot()
}

const removeTag = (tag) => {
    const n = StateStore.read().currentNote
    if (!n) return
    const tags = (n.tags || []).filter(x => x.toLowerCase() !== tag.toLowerCase())
    StateStore.update("currentNote", { ...n, tags })
    renderTags()
    queueSnapshot()
}

const renderTags = () => {
    const n = StateStore.read().currentNote
    if (!n || !els.tagsContainer) return
    const tags = n.tags || []

    els.tagsContainer.innerHTML = tags.map(t => `
        <span class="tag-chip" data-action="remove-tag" data-tag="${encodeURIComponent(t)}">
            <i class="material-icons-round" aria-hidden="true">tag</i>
            <span>${Utils.escapeHtml(t)}</span>
        </span>
    `).join("")

    const sugs = collectSuggestedTags(n.title, n.content)
        .filter(x => !tags.some(t => t.toLowerCase() === x.toLowerCase()))
        .slice(0, 5)

    if (sugs.length) {
        const wrap = document.createElement("div")
        wrap.style.cssText = "display:flex; flex-wrap:wrap; gap:8px;"
        sugs.forEach(t => {
            const b = document.createElement("span")
            b.className = "tag-suggest"
            b.textContent = `#${t}`
            b.dataset.action = "add-tag"
            b.dataset.tag = encodeURIComponent(t)
            wrap.appendChild(b)
        })
        els.tagsContainer.appendChild(wrap)
    }
}

const getActiveBlock = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    let node = sel.anchorNode
    if (!node) return null
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    if (!node || node === els.content) return null
    if (node.classList?.contains("note-page")) return null
    const block = node.closest("div, p")
    if (block?.classList?.contains("note-page")) return null
    return block
}

const handleTagLineEnter = (e) => {
    if (e.key !== "Enter") return
    const block = getActiveBlock()
    if (!block || !els.content.contains(block)) return
    const text = block.textContent.trim()
    if (/^#\S+$/.test(text)) {
        e.preventDefault()
        block.classList.add("tag-line")
    } else {
        block.classList.remove("tag-line")
    }
}
