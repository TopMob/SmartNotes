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
