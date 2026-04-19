"use strict";

const NotesListEngine = (() => {
    const cardCache = new Map()
    const runtime = {
        source: [],
        renderedCount: 0,
        chunkSize: 48,
        loading: false,
        observer: null,
        sentinel: null,
        grid: null,
        empty: null
    }

    const getIsHiddenLocked = () => (typeof window.isHiddenLocked === "function" ? window.isHiddenLocked : () => false)

    const areTagListsEqual = (firstTags, secondTags) => {
        const left = Array.isArray(firstTags) ? firstTags : []
        const right = Array.isArray(secondTags) ? secondTags : []
        if (left.length !== right.length) return false
        for (let index = 0; index < left.length; index++) {
            if (left[index] !== right[index]) return false
        }
        return true
    }

    const el = (tag, cls = [], text = null) => {
        const node = document.createElement(tag)
        if (cls.length) node.classList.add(...cls)
        if (text !== null) node.textContent = text
        return node
    }

    const createIcon = (name) => {
        const i = el("i", ["material-icons-round"], name)
        i.setAttribute("aria-hidden", "true")
        return i
    }

    const createBtn = (action, icon, label, id) => {
        const btn = el("button", ["action-btn"])
        btn.type = "button"
        btn.setAttribute("aria-label", label)
        btn.dataset.action = action
        btn.dataset.noteId = encodeURIComponent(id)
        btn.appendChild(createIcon(icon))
        return btn
    }

    const createCard = (note) => {
        const isLockedView = StateStore.read().view === "locked"
        const isLockedNote = getIsHiddenLocked()(note)
        const canManage = typeof CollaborationService !== "undefined" ? CollaborationService.canManage(note) : true
        const card = el("div", ["note-card"])
        card.draggable = !(isLockedView && isLockedNote) && canManage
        card.dataset.noteId = encodeURIComponent(note.id)

        let actions = null
        if (!(isLockedView && isLockedNote) && canManage) {
            actions = el("div", ["card-actions"])
            actions.appendChild(createBtn("note-pin", "push_pin", UI.getText("pin_note", "Pin"), note.id))
            const favBtn = createBtn("note-favorite", note.isFavorite ? "star" : "star_border", UI.getText("favorite_note", "Favorite"), note.id)
            favBtn.classList.toggle("favorite-active", !!note.isFavorite)
            actions.appendChild(favBtn)
            actions.appendChild(createBtn("note-menu", "more_horiz", UI.getText("note_actions", "Actions"), note.id))
        }

        const titleText = (isLockedView && isLockedNote) ? UI.getText("lock_center_masked_title", "Protected note") : (note.title || NoteText.buildAutoTitle(note))
        const h3 = el("h3", [], titleText)

        const contentText = (isLockedView && isLockedNote) ? UI.getText("lock_hidden", "Note hidden") : NoteText.buildPreviewText(note)
        const p = el("p", [], contentText)

        const meta = el("div", ["note-meta"])
        meta.appendChild(createIcon("schedule"))
        const dateSpan = el("span", [], Utils.formatDate(note.updatedAt || note.createdAt || Date.now()))

        const contentTypeLabel = note.contentType === "handwriting" ? "✍️" : (String(note.content || "").includes("<audio") ? "🎵" : "")
        if (contentTypeLabel) {
            const contentTypeSpan = el("span", [], contentTypeLabel)
            meta.appendChild(contentTypeSpan)
        }
        const tagsSpan = el("span", [])
        tagsSpan.style.marginLeft = "auto"
        tagsSpan.style.opacity = "0.8"
        const tags = Array.isArray(note.tags) ? note.tags.slice(0, 3) : []
        tagsSpan.textContent = (isLockedView && isLockedNote) ? "" : (tags.length ? tags.map(t => `#${t}`).join(" ") : "")
        meta.append(dateSpan, tagsSpan)

        const lockContainer = el("div")
        lockContainer.style.marginTop = "8px"
        if (note.lock && note.lock.hidden) {
            const badge = el("span", ["lock-badge"])
            const i = createIcon("lock")
            i.style.fontSize = "16px"
            const txt = el("span", [], UI.getText("locked_note", "Locked"))
            badge.append(i, txt)
            lockContainer.appendChild(badge)
        }

        if (actions) card.append(actions)
        card.append(h3, p, meta, lockContainer)
        card.classList.toggle("favorite", !!note.isFavorite)

        const favBtn = actions ? actions.children[1] : null
        const favIcon = favBtn ? favBtn.firstChild : null

        cardCache.set(note.id, {
            el: card,
            refs: { h3, p, dateSpan, tagsSpan, lockContainer, favBtn, favIcon },
            data: { ...note }
        })

        return card
    }

    const updateCard = (note) => {
        const cached = cardCache.get(note.id)
        if (!cached) return createCard(note)

        const { el: card, refs, data } = cached
        const isLockedView = StateStore.read().view === "locked"
        const isLockedNote = getIsHiddenLocked()(note)

        if (note.title !== data.title || note.content !== data.content || isLockedView) {
            refs.h3.textContent = (isLockedView && isLockedNote) ? UI.getText("lock_center_masked_title", "Protected note") : (note.title || NoteText.buildAutoTitle(note))
        }

        if (note.content !== data.content || isLockedView) {
            refs.p.textContent = (isLockedView && isLockedNote) ? UI.getText("lock_hidden", "Note hidden") : NoteText.buildPreviewText(note)
        }

        const t1 = note.updatedAt?.seconds || 0
        const t2 = data.updatedAt?.seconds || 0
        if (t1 !== t2) refs.dateSpan.textContent = Utils.formatDate(note.updatedAt || note.createdAt || Date.now())

        if (!areTagListsEqual(note.tags, data.tags) || isLockedView) {
            const tags = Array.isArray(note.tags) ? note.tags.slice(0, 3) : []
            refs.tagsSpan.textContent = (isLockedView && isLockedNote) ? "" : (tags.length ? tags.map(t => `#${t}`).join(" ") : "")
        }

        if (note.isPinned !== data.isPinned) card.classList.toggle("pinned", !!note.isPinned)

        if (note.isFavorite !== data.isFavorite) {
            card.classList.toggle("favorite", !!note.isFavorite)
            if (refs.favBtn) refs.favBtn.classList.toggle("favorite-active", !!note.isFavorite)
            if (refs.favIcon) refs.favIcon.textContent = note.isFavorite ? "star" : "star_border"
        }

        const lockHash = note.lock?.hash || ""
        const prevHash = data.lock?.hash || ""
        if (lockHash !== prevHash) {
            refs.lockContainer.replaceChildren()
            if (note.lock && note.lock.hidden) {
                const badge = el("span", ["lock-badge"])
                const i = createIcon("lock")
                i.style.fontSize = "16px"
                const txt = el("span", [], UI.getText("locked_note", "Locked"))
                badge.append(i, txt)
                refs.lockContainer.appendChild(badge)
            }
        }

        cached.data = { ...note }
        return card
    }

    const disconnectObserver = () => {
        runtime.observer?.disconnect()
        runtime.observer = null
    }

    const ensureSentinel = () => {
        if (!runtime.grid) return null
        if (runtime.sentinel && runtime.grid.contains(runtime.sentinel)) return runtime.sentinel
        const sentinel = document.createElement("div")
        sentinel.className = "notes-list-sentinel"
        sentinel.style.height = "1px"
        runtime.sentinel = sentinel
        runtime.grid.appendChild(sentinel)
        return sentinel
    }

    const clearGrid = () => {
        if (!runtime.grid) return
        runtime.grid.replaceChildren()
    }

    const cleanupCache = () => {
        const activeIds = new Set(runtime.source.map(note => note.id))
        for (const [id] of cardCache) {
            if (!activeIds.has(id)) cardCache.delete(id)
        }
    }

    const appendNextChunk = () => {
        if (!runtime.grid || runtime.loading) return
        if (runtime.renderedCount >= runtime.source.length) return
        runtime.loading = true

        const fragment = document.createDocumentFragment()
        const start = runtime.renderedCount
        const end = Math.min(runtime.source.length, start + runtime.chunkSize)
        for (let index = start; index < end; index += 1) {
            const note = runtime.source[index]
            const node = cardCache.has(note.id) ? updateCard(note) : createCard(note)
            fragment.appendChild(node)
        }
        runtime.renderedCount = end

        const sentinel = ensureSentinel()
        if (sentinel) {
            runtime.grid.insertBefore(fragment, sentinel)
        } else {
            runtime.grid.appendChild(fragment)
        }
        runtime.loading = false
    }

    const setupObserver = () => {
        disconnectObserver()
        const sentinel = ensureSentinel()
        if (!sentinel || runtime.renderedCount >= runtime.source.length) return
        runtime.observer = new IntersectionObserver((entries) => {
            const isVisible = entries.some(entry => entry.isIntersecting)
            if (!isVisible) return
            appendNextChunk()
            if (runtime.renderedCount >= runtime.source.length) disconnectObserver()
        }, { root: null, threshold: 0.01 })
        runtime.observer.observe(sentinel)
    }

    const render = (list) => {
        runtime.grid = UI.els.grid
        runtime.empty = UI.els.empty
        if (!runtime.grid || !runtime.empty) return

        runtime.source = Array.isArray(list) ? list : []
        runtime.renderedCount = 0
        disconnectObserver()

        if (!runtime.source.length) {
            runtime.empty.classList.remove("hidden")
            clearGrid()
            cardCache.clear()
            return
        }

        runtime.empty.classList.add("hidden")
        runtime.grid.classList.remove("folder-grid")
        clearGrid()
        cleanupCache()
        appendNextChunk()
        setupObserver()
    }

    return { render }
})()

window.NotesRenderer = NotesListEngine
