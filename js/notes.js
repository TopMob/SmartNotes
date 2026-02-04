const NotesRenderer = (() => {
    const cardCache = new Map()

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
        const card = el("div", ["note-card"])
        card.draggable = true
        card.dataset.noteId = encodeURIComponent(note.id)

        const actions = el("div", ["card-actions"])
        actions.appendChild(createBtn("note-pin", "push_pin", UI.getText("pin_note", "Pin"), note.id))
        actions.appendChild(createBtn("note-favorite", "star", UI.getText("favorite_note", "Favorite"), note.id))
        actions.appendChild(createBtn("note-menu", "more_horiz", UI.getText("note_actions", "Actions"), note.id))

        const h3 = el("h3", [], note.title || UI.getText("untitled_note", "Untitled"))

        const rawText = (note.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        const p = el("p", [], rawText || UI.getText("empty_note", "No content"))

        const meta = el("div", ["note-meta"])
        meta.appendChild(createIcon("schedule"))
        const dateSpan = el("span", [], Utils.formatDate(note.updatedAt || note.createdAt || Date.now()))
        const tagsSpan = el("span", [])
        tagsSpan.style.marginLeft = "auto"
        tagsSpan.style.opacity = "0.8"
        meta.append(dateSpan, tagsSpan)

        const lockContainer = el("div")
        lockContainer.style.marginTop = "8px"

        card.append(actions, h3, p, meta, lockContainer)

        cardCache.set(note.id, {
            el: card,
            refs: { h3, p, dateSpan, tagsSpan, lockContainer, favIcon: actions.children[1].firstChild },
            data: { ...note }
        })

        return card
    }

    const updateCard = (note) => {
        const cached = cardCache.get(note.id)
        if (!cached) return createCard(note)

        const { el: card, refs, data } = cached

        if (note.title !== data.title) {
            refs.h3.textContent = note.title || UI.getText("untitled_note", "Untitled")
        }

        if (note.content !== data.content) {
            const rawText = (note.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
            refs.p.textContent = rawText || UI.getText("empty_note", "No content")
        }

        const t1 = note.updatedAt?.seconds || 0
        const t2 = data.updatedAt?.seconds || 0
        if (t1 !== t2) {
            refs.dateSpan.textContent = Utils.formatDate(note.updatedAt || note.createdAt || Date.now())
        }

        const tagsStr = JSON.stringify(note.tags)
        const prevTags = JSON.stringify(data.tags)
        if (tagsStr !== prevTags) {
            const tags = Array.isArray(note.tags) ? note.tags.slice(0, 3) : []
            refs.tagsSpan.textContent = tags.length ? tags.map(t => `#${t}`).join(" ") : ""
        }

        if (note.isPinned !== data.isPinned) {
            card.classList.toggle("pinned", !!note.isPinned)
        }

        const lockHash = note.lock?.hash || ""
        const prevHash = data.lock?.hash || ""
        if (lockHash !== prevHash) {
            refs.lockContainer.innerHTML = ""
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

    const render = (list) => {
        const grid = UI.els.grid
        if (!grid) return

        if (!list || !list.length) {
            UI.els.empty.classList.remove("hidden")
            grid.innerHTML = ""
            cardCache.clear()
            return
        }

        UI.els.empty.classList.add("hidden")
        grid.classList.remove("folder-grid")
        UI.visibleNotes = list

        const fragment = document.createDocumentFragment()
        const currentIds = new Set()

        list.forEach(note => {
            currentIds.add(note.id)
            const node = cardCache.has(note.id) ? updateCard(note) : createCard(note)
            fragment.appendChild(node)
        })

        for (const [id] of cardCache) {
            if (!currentIds.has(id)) cardCache.delete(id)
        }

        requestAnimationFrame(() => {
            grid.replaceChildren(fragment)
        })
    }

    return { render }
})()

function normalizeVisibleNotes(list, orderKey = "order") {
    if (!Array.isArray(list)) return []
    const arr = list.map(n => NoteIO.normalizeNote(n))
    arr.sort((a, b) => {
        if (!!b.isPinned !== !!a.isPinned) return b.isPinned ? 1 : -1
        const vA = typeof a[orderKey] === "number" ? a[orderKey] : 0
        const vB = typeof b[orderKey] === "number" ? b[orderKey] : 0
        return vA - vB
    })
    return arr
}

function renderNotes(list) {
    NotesRenderer.render(list)
}

function isHiddenLocked(note) {
    return !!(note && note.lock && note.lock.hidden)
}

function getLockedNotes() {
    const current = StateStore.read()
    return (current.notes || []).filter(n => isHiddenLocked(n))
}

function filterAndRender(query) {
    const queryValue = String(query || "")
    const current = StateStore.read()

    if (current.searchQuery !== queryValue) {
        StateStore.update("searchQuery", queryValue)
    }

    const q = queryValue.trim()
    const view = current.view
    const activeFolderId = current.activeFolderId

    if (view === "folder" && !activeFolderId) {
        StateStore.update("view", "notes")
    }

    let list = current.notes.slice()

    list = list.filter(n => !isHiddenLocked(n))

    if (view === "favorites") list = list.filter(n => n.isFavorite && !n.isArchived)
    else if (view === "archive") list = list.filter(n => n.isArchived)
    else if (view === "folder") list = list.filter(n => !n.isArchived && n.folderId === activeFolderId)
    else list = list.filter(n => !n.isArchived)

    if (q) {
        try {
            const scored = list.map(n => ({
                n,
                score: SmartSearch.score(q, n.title, n.content, n.tags)
            }))
                .filter(item => item.score >= 0.35)
                .sort((a, b) => b.score - a.score)

            list = scored.map(item => item.n)
        } catch (e) {
            console.error("Search failed", e)
        }
    }

    const orderKey = view === "folder" ? "folderOrder" : "order"
    list = normalizeVisibleNotes(list, orderKey)

    if (view === "folders") {
        UI.renderFolderGrid()
    } else {
        NotesRenderer.render(list)
    }

    UI.updateViewTitle()
    UI.updatePrimaryActionLabel()
}

function switchView(view, folderId = null) {
    StateStore.set(prev => ({ ...prev, view, activeFolderId: folderId }))

    document.querySelectorAll(".nav-item").forEach(btn => {
        const v = btn.dataset.view
        const f = btn.dataset.folderId

        let isActive = false
        if (v) isActive = (v === view)
        else if (f) isActive = (view === "folder" && f === folderId)

        btn.classList.toggle("active", isActive)
    })

    const searchInput = document.getElementById("search-input")
    filterAndRender(searchInput ? searchInput.value : "")
}

async function deleteFolder(folderId) {
    if (!folderId) return
    UI.confirm("delete_f", async () => {
        const user = StateStore.read().user
        if (!db || !user) return

        const notes = StateStore.read().notes.filter(n => n.folderId === folderId)
        const batch = db.batch()

        notes.forEach(n => {
            const ref = db.collection("users").doc(user.uid).collection("notes").doc(n.id)
            batch.update(ref, { folderId: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        })

        const folderRef = db.collection("users").doc(user.uid).collection("folders").doc(folderId)
        batch.delete(folderRef)

        await batch.commit()

        if (StateStore.read().activeFolderId === folderId) {
            switchView("notes")
        }
        UI.showToast(UI.getText("folder_deleted", "Folder deleted"))
    })
}

function openNoteActions(noteId) {
    UI.currentNoteActionId = noteId
    UI.openModal("note-actions-modal")
}

async function toggleFavorite(noteId) {
    const user = StateStore.read().user
    if (!db || !user) return

    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note) return
    if (isHiddenLocked(note)) return

    const ref = db.collection("users").doc(user.uid).collection("notes").doc(noteId)
    await ref.update({
        isFavorite: !note.isFavorite
    })
}

async function togglePin(noteId, options = {}) {
    const user = StateStore.read().user
    if (!db || !user) return

    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note) return
    if (isHiddenLocked(note) && !options.allowLocked) return

    const ref = db.collection("users").doc(user.uid).collection("notes").doc(noteId)
    await ref.update({
        isPinned: !note.isPinned
    })

    const card = document.querySelector(`.note-card[data-note-id="${encodeURIComponent(noteId)}"]`)
    if (card) {
        card.classList.add("pinning")
        setTimeout(() => card.classList.remove("pinning"), 520)
    }
}

async function toggleArchive(noteId, archive, options = {}) {
    const user = StateStore.read().user
    if (!db || !user) return

    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note) return
    if (isHiddenLocked(note) && !options.allowLocked) return

    const ref = db.collection("users").doc(user.uid).collection("notes").doc(noteId)
    await ref.update({
        isArchived: !!archive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })

    UI.showToast(archive ? UI.getText("archived", "Archived") : UI.getText("restored", "Restored"))
}

async function moveNoteToFolder(noteId, folderId, options = {}) {
    const user = StateStore.read().user
    if (!db || !user) return
    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note) return
    if (isHiddenLocked(note) && !options.allowLocked) return
    const ref = db.collection("users").doc(user.uid).collection("notes").doc(noteId)
    await ref.update({
        folderId: folderId || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
}

async function initApp() {
    try {
        await DriveService.init()
        ReminderService.init()
        if (typeof Editor !== "undefined") Editor.init()
        UI.init()
        UI.setLang(localStorage.getItem("app-lang") || "ru")

        const user = StateStore.read().user
        if (!db || !user) return

        db.collection("users").doc(user.uid).collection("folders")
            .orderBy("createdAt", "asc")
            .onSnapshot(snap => {
                const folders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                StateStore.update("folders", folders)
                UI.renderFolders()
                if (StateStore.read().view === "folders") {
                    filterAndRender(document.getElementById("search-input")?.value || "")
                }
            })

        db.collection("users").doc(user.uid).collection("notes")
            .orderBy("order", "asc")
            .onSnapshot(snap => {
                const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                StateStore.update("notes", notes)
                filterAndRender(document.getElementById("search-input")?.value || "")
                if (typeof UI.handlePendingShare === "function") UI.handlePendingShare()
            })

        const loader = document.getElementById("app-loader")
        if (loader) loader.classList.add("hidden")

        const search = document.getElementById("search-input")
        if (search) search.value = ""

        switchView("notes")
    } catch (e) {
        console.error("Init Error", e)
    }
}

window.initApp = initApp
window.switchView = switchView
window.filterAndRender = filterAndRender
window.deleteFolder = deleteFolder
window.openNoteActions = openNoteActions
window.toggleFavorite = toggleFavorite
window.togglePin = togglePin
window.toggleArchive = toggleArchive
window.getLockedNotes = getLockedNotes
window.moveNoteToFolder = moveNoteToFolder
