const FAVORITES_STORAGE_KEY = "favorite-notes"

const readFavoriteIds = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY))
        if (Array.isArray(stored)) return new Set(stored)
    } catch {}
    return new Set()
}

const writeFavoriteIds = (ids) => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids]))
}

const syncFavoritesStorage = (notes) => {
    const ids = new Set()
    notes.forEach(note => {
        if (note.isFavorite) ids.add(note.id)
    })
    writeFavoriteIds(ids)
}

const applyStoredFavorites = (notes) => {
    const stored = readFavoriteIds()
    if (!stored.size) return notes
    return notes.map(note => {
        if (typeof note.isFavorite !== "boolean" && stored.has(note.id)) {
            return { ...note, isFavorite: true }
        }
        return note
    })
}

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
        const isLockedView = StateStore.read().view === "locked"
        const isLockedNote = isHiddenLocked(note)
        const card = el("div", ["note-card"])
        card.draggable = !(isLockedView && isLockedNote)
        card.dataset.noteId = encodeURIComponent(note.id)

        let actions = null
        if (!(isLockedView && isLockedNote)) {
            actions = el("div", ["card-actions"])
            actions.appendChild(createBtn("note-pin", "push_pin", UI.getText("pin_note", "Pin"), note.id))
            const favBtn = createBtn("note-favorite", note.isFavorite ? "star" : "star_border", UI.getText("favorite_note", "Favorite"), note.id)
            favBtn.classList.toggle("favorite-active", !!note.isFavorite)
            actions.appendChild(favBtn)
            actions.appendChild(createBtn("note-menu", "more_horiz", UI.getText("note_actions", "Actions"), note.id))
        }

        const titleText = (isLockedView && isLockedNote) ? UI.getText("lock_center_masked_title", "Protected note") : (note.title || UI.getText("untitled_note", "Untitled"))
        const h3 = el("h3", [], titleText)

        const rawText = (note.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        const contentText = (isLockedView && isLockedNote) ? UI.getText("lock_hidden", "Note hidden") : (rawText || UI.getText("empty_note", "No content"))
        const p = el("p", [], contentText)

        const meta = el("div", ["note-meta"])
        meta.appendChild(createIcon("schedule"))
        const dateSpan = el("span", [], Utils.formatDate(note.updatedAt || note.createdAt || Date.now()))
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
        const isLockedNote = isHiddenLocked(note)

        if (note.title !== data.title || isLockedView) {
            refs.h3.textContent = (isLockedView && isLockedNote) ? UI.getText("lock_center_masked_title", "Protected note") : (note.title || UI.getText("untitled_note", "Untitled"))
        }

        if (note.content !== data.content || isLockedView) {
            const rawText = (note.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
            refs.p.textContent = (isLockedView && isLockedNote) ? UI.getText("lock_hidden", "Note hidden") : (rawText || UI.getText("empty_note", "No content"))
        }

        const t1 = note.updatedAt?.seconds || 0
        const t2 = data.updatedAt?.seconds || 0
        if (t1 !== t2) {
            refs.dateSpan.textContent = Utils.formatDate(note.updatedAt || note.createdAt || Date.now())
        }

        const tagsStr = JSON.stringify(note.tags)
        const prevTags = JSON.stringify(data.tags)
        if (tagsStr !== prevTags || isLockedView) {
            const tags = Array.isArray(note.tags) ? note.tags.slice(0, 3) : []
            refs.tagsSpan.textContent = (isLockedView && isLockedNote) ? "" : (tags.length ? tags.map(t => `#${t}`).join(" ") : "")
        }

        if (note.isPinned !== data.isPinned) {
            card.classList.toggle("pinned", !!note.isPinned)
        }

        if (note.isFavorite !== data.isFavorite) {
            card.classList.toggle("favorite", !!note.isFavorite)
            if (refs.favBtn) refs.favBtn.classList.toggle("favorite-active", !!note.isFavorite)
            if (refs.favIcon) refs.favIcon.textContent = note.isFavorite ? "star" : "star_border"
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
        if (!!b.isPinned !== !!a.isPinned) return a.isPinned ? -1 : 1
        const vA = typeof a[orderKey] === "number" ? a[orderKey] : 0
        const vB = typeof b[orderKey] === "number" ? b[orderKey] : 0
        return vA - vB
    })
    return arr
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
    let view = current.view
    let activeFolderId = current.activeFolderId

    if (view === "folder" && !activeFolderId) {
        StateStore.update("view", "notes")
        view = "notes"
        activeFolderId = null
    }

    let list = current.notes.slice()

    if (view === "locked") {
        list = list.filter(n => isHiddenLocked(n))
    } else {
        list = list.filter(n => !isHiddenLocked(n))
    }

    if (view === "favorites") list = list.filter(n => n.isFavorite && !n.isArchived)
    else if (view === "archive") list = list.filter(n => n.isArchived)
    else if (view === "folder") list = list.filter(n => !n.isArchived && n.folderId === activeFolderId)
    else if (view !== "locked") list = list.filter(n => !n.isArchived)

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
        if (view === "locked") {
            UI.updateEmptyState("lock", UI.getText("lock_center_empty", "No protected notes"))
        } else {
            UI.updateEmptyState("note_add", UI.getText("empty", "Nothing here yet"))
        }
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
    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note || isHiddenLocked(note)) return
    UI.currentNoteActionId = noteId
    UI.renderNoteActions(noteId)
    UI.openModal("note-actions-modal")
}

async function toggleFavorite(noteId) {
    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note) return
    if (isHiddenLocked(note)) return

    const nextValue = !note.isFavorite
    const nextNotes = StateStore.read().notes.map(n => n.id === noteId ? { ...n, isFavorite: nextValue } : n)
    StateActions.setNotes(nextNotes)
    syncFavoritesStorage(nextNotes)
    filterAndRender(document.getElementById("search-input")?.value || "")

    const user = StateStore.read().user
    if (!db || !user) return

    const ref = db.collection("users").doc(user.uid).collection("notes").doc(noteId)
    try {
        await ref.update({
            isFavorite: nextValue
        })
    } catch (e) {
        const revertedNotes = StateStore.read().notes.map(n => n.id === noteId ? { ...n, isFavorite: note.isFavorite } : n)
        StateActions.setNotes(revertedNotes)
        syncFavoritesStorage(revertedNotes)
        filterAndRender(document.getElementById("search-input")?.value || "")
        UI.showToast(UI.getText("favorite_failed", "Unable to update favorite"))
        console.error("Favorite update failed", e)
    }
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

const AppLifecycle = {
    initialized: false,
    activeUid: null,
    unsubscribers: [],

    async initializeOnce() {
        if (this.initialized) return
        this.initialized = true
        await DriveService.init()
        ReminderService.init()
        if (typeof Editor !== "undefined") Editor.init()
        UI.init()
        UI.setLang(localStorage.getItem("app-lang") || "ru")
    },

    clearSubscriptions() {
        this.unsubscribers.forEach(unsub => {
            if (typeof unsub === "function") unsub()
        })
        this.unsubscribers = []
    },

    stopUserSession() {
        this.activeUid = null
        this.clearSubscriptions()
        if (typeof SyncService !== "undefined" && SyncService.stop) SyncService.stop()
    },

    async startUserSession(user) {
        if (!db || !user) return

        await this.initializeOnce()

        if (this.activeUid === user.uid) return
        this.stopUserSession()
        this.activeUid = user.uid

        const folderUnsub = db.collection("users").doc(user.uid).collection("folders")
            .orderBy("createdAt", "asc")
            .onSnapshot(snap => {
                const folders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                StateStore.update("folders", folders)
                UI.renderFolders()
                if (StateStore.read().view === "folders") {
                    filterAndRender(document.getElementById("search-input")?.value || "")
                }
            }, err => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
                console.error("Folders sync error", err)
            })

        const notesUnsub = db.collection("users").doc(user.uid).collection("notes")
            .orderBy("order", "asc")
            .onSnapshot(snap => {
                let notes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                notes = applyStoredFavorites(notes)
                StateStore.update("notes", notes)
                syncFavoritesStorage(notes)
                filterAndRender(document.getElementById("search-input")?.value || "")
                if (typeof UI.handlePendingShare === "function") UI.handlePendingShare()
            }, err => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
                console.error("Notes sync error", err)
            })

        this.unsubscribers = [folderUnsub, notesUnsub]

        if (typeof SyncService !== "undefined" && SyncService.start) {
            SyncService.start(user)
        }

        const loader = document.getElementById("app-loader")
        if (loader) loader.classList.add("hidden")

        const search = document.getElementById("search-input")
        if (search) search.value = ""

        switchView("notes")
    }
}

async function initApp() {
    const user = StateStore.read().user
    if (!user) return
    await AppLifecycle.startUserSession(user)
}

window.initApp = initApp
window.startUserSession = (user) => AppLifecycle.startUserSession(user)
window.stopUserSession = () => AppLifecycle.stopUserSession()
window.switchView = switchView
window.filterAndRender = filterAndRender
window.deleteFolder = deleteFolder
window.openNoteActions = openNoteActions
window.toggleFavorite = toggleFavorite
window.togglePin = togglePin
window.toggleArchive = toggleArchive
window.getLockedNotes = getLockedNotes
window.moveNoteToFolder = moveNoteToFolder
