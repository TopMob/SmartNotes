/**
 * notes.js - Production Ready Refactor
 * Implements DOM Diffing/Reconciliation for high performance rendering
 * and strict security via DOM APIs instead of innerHTML.
 */

const NotesRenderer = (() => {
    // Cache for DOM elements to prevent recreation
    const cardCache = new Map()
    
    // Create element helper for safety and brevity
    const el = (tag, classes = [], text = null) => {
        const node = document.createElement(tag)
        if (classes.length) node.className = classes.join(" ")
        if (text !== null) node.textContent = text
        return node
    }

    const createIcon = (iconName) => {
        const i = el("i", ["material-icons-round"], iconName)
        i.setAttribute("aria-hidden", "true")
        return i
    }

    const createButton = (action, icon, label, noteId) => {
        const btn = el("button", ["action-btn"])
        btn.type = "button"
        btn.setAttribute("aria-label", label)
        btn.dataset.action = action
        btn.dataset.noteId = noteId
        btn.appendChild(createIcon(icon))
        return btn
    }

    // Creates a full DOM node for a note card
    const createCard = (note) => {
        const card = el("div", ["note-card"])
        card.draggable = true
        card.dataset.noteId = note.id
        
        // Actions container
        const actions = el("div", ["card-actions"])
        actions.appendChild(createButton("note-pin", "push_pin", UI.getText("pin_note", "Pin"), note.id))
        actions.appendChild(createButton("note-favorite", "star", UI.getText("favorite_note", "Favorite"), note.id))
        actions.appendChild(createButton("note-menu", "more_horiz", UI.getText("note_actions", "Actions"), note.id))
        
        // Content
        const titleText = note.title || UI.getText("untitled_note", "Untitled")
        const h3 = el("h3", [], titleText)
        
        const previewText = Utils.stripHtml(note.content || "").trim() || UI.getText("empty_note", "No content")
        const p = el("p", [], previewText)

        // Meta data
        const meta = el("div", ["note-meta"])
        meta.appendChild(createIcon("schedule"))
        
        const dateSpan = el("span", [], Utils.formatDate(note.updatedAt || note.createdAt || Date.now()))
        meta.appendChild(dateSpan)

        const tagsSpan = el("span", [])
        tagsSpan.style.marginLeft = "auto"
        tagsSpan.style.opacity = "0.8"
        
        // Lock status
        let lockDiv = null
        if (note.lock && note.lock.hidden) {
            lockDiv = el("div")
            lockDiv.style.marginTop = "8px"
            const badge = el("span", ["lock-badge"])
            const lockIcon = createIcon("lock")
            lockIcon.style.fontSize = "16px"
            const label = el("span", [], UI.getText("locked_note", "Locked"))
            badge.append(lockIcon, label)
            lockDiv.appendChild(badge)
        }

        // Assemble
        card.append(actions, h3, p, meta)
        if (lockDiv) card.appendChild(lockDiv)

        // Store references for quick updates
        cardCache.set(note.id, {
            el: card,
            refs: { h3, p, dateSpan, tagsSpan, lockDiv, container: card },
            data: { ...note } // Snapshot of data used to render
        })

        return card
    }

    // Updates an existing card DOM only if data changed
    const updateCard = (note) => {
        const cached = cardCache.get(note.id)
        if (!cached) return createCard(note)

        const { refs, data } = cached
        const { el: cardEl } = cached

        // Check Diff for properties that affect rendering
        const titleChanged = note.title !== data.title
        const contentChanged = note.content !== data.content
        const dateChanged = (note.updatedAt?.seconds || 0) !== (data.updatedAt?.seconds || 0)
        const pinnedChanged = note.isPinned !== data.isPinned
        const tagsChanged = JSON.stringify(note.tags) !== JSON.stringify(data.tags)
        
        if (titleChanged) refs.h3.textContent = note.title || UI.getText("untitled_note", "Untitled")
        
        if (contentChanged) {
            refs.p.textContent = Utils.stripHtml(note.content || "").trim() || UI.getText("empty_note", "No content")
        }
        
        if (dateChanged) {
            refs.dateSpan.textContent = Utils.formatDate(note.updatedAt || note.createdAt || Date.now())
        }

        if (tagsChanged) {
             const tagLine = Array.isArray(note.tags) && note.tags.length 
                ? note.tags.slice(0, 3).map(t => `#${t}`).join(" ") 
                : ""
             refs.tagsSpan.textContent = tagLine
        }

        if (pinnedChanged) {
            if (note.isPinned) cardEl.classList.add("pinned")
            else cardEl.classList.remove("pinned")
        }

        // Handle lock state changes (re-create lock div if needed)
        // Simplified: if lock state changed radically, just return new card
        if (!!note.lock !== !!data.lock) {
            return createCard(note)
        }

        // Update snapshot
        cached.data = { ...note }
        return cardEl
    }

    const render = (list) => {
        const grid = UI.els.grid
        if (!grid) return

        UI.els.grid.classList.remove("folder-grid")
        UI.visibleNotes = list

        if (!list.length) {
            UI.els.empty.classList.remove("hidden")
            grid.innerHTML = ""
            return
        }
        UI.els.empty.classList.add("hidden")

        const fragment = document.createDocumentFragment()
        const currentIds = new Set(list.map(n => n.id))

        // 1. Prepare nodes
        list.forEach(note => {
            let cardNode
            if (cardCache.has(note.id)) {
                cardNode = updateCard(note)
            } else {
                cardNode = createCard(note)
                // Initial render props
                const tagLine = Array.isArray(note.tags) && note.tags.length 
                    ? note.tags.slice(0, 3).map(t => `#${t}`).join(" ") 
                    : ""
                cardNode.querySelector(".note-meta span:last-child").textContent = tagLine
                if (note.isPinned) cardNode.classList.add("pinned")
            }
            fragment.appendChild(cardNode)
        })

        // 2. Cleanup cache for removed notes
        for (const [id] of cardCache) {
            if (!currentIds.has(id)) {
                cardCache.delete(id)
            }
        }

        // 3. Swap DOM (Reconciliation)
        // Instead of grid.innerHTML = "", we reuse nodes to keep state/animations if possible,
        // but since sorting might change order, replaceChildren is the most robust native method.
        grid.replaceChildren(fragment)
    }

    const clearCache = () => cardCache.clear()

    return { render, clearCache }
})()

// --- Core Logic ---

function normalizeVisibleNotes(list, orderKey = "order") {
    const arr = (list || []).filter(Boolean).map(n => NoteIO.normalizeNote(n))
    arr.sort((a, b) => {
        const ap = a.isPinned ? 1 : 0
        const bp = b.isPinned ? 1 : 0
        if (bp !== ap) return bp - ap
        
        const ao = typeof a[orderKey] === "number" ? a[orderKey] : 0
        const bo = typeof b[orderKey] === "number" ? b[orderKey] : 0
        return ao - bo // Ascending order
    })
    return arr
}

function filterAndRender(query) {
    const queryValue = String(query || "")
    const current = StateStore.read()
    
    // Optimistic update for search query input
    if (current.searchQuery !== queryValue) {
        StateStore.update("searchQuery", queryValue)
    }
    
    const q = queryValue.trim()
    
    // Auto-switch from folder view if searching globally
    if (current.view === "folder" && !current.activeFolderId) {
        StateStore.update("view", "notes")
    }

    let list = current.notes.slice()
    const view = StateStore.read().view
    const activeFolderId = StateStore.read().activeFolderId

    // View Filtering
    switch (view) {
        case "favorites":
            list = list.filter(n => !!n.isFavorite && !n.isArchived)
            break
        case "archive":
            list = list.filter(n => !!n.isArchived)
            break
        case "folder":
            list = list.filter(n => !n.isArchived && n.folderId === activeFolderId)
            break
        default: // "notes"
            list = list.filter(n => !n.isArchived)
            break
    }

    // Search Filtering
    if (q) {
        const scored = list.map(n => {
            const score = SmartSearch.score(q, n.title, n.content, n.tags)
            return { n, score }
        }).filter(x => x.score >= 0.35).sort((a, b) => b.score - a.score)
        list = scored.map(x => x.n)
    }

    const orderKey = view === "folder" ? "folderOrder" : "order"
    list = normalizeVisibleNotes(list, orderKey)

    // Render Dispatch
    if (StateStore.read().view === "folders") {
        UI.renderFolderGrid()
    } else {
        requestAnimationFrame(() => NotesRenderer.render(list))
    }

    // UI Updates
    UI.updateViewTitle()
    UI.updatePrimaryActionLabel()
}

function switchView(view, folderId = null) {
    const prevFolder = StateStore.read().activeFolderId
    StateStore.set(prev => ({ ...prev, view, activeFolderId: folderId }))
    
    // DOM Updates for Nav
    document.querySelectorAll(".nav-item").forEach(btn => {
        const v = btn.dataset.view
        if (v) btn.classList.toggle("active", v === view)
        
        // Handle folder activation visual state
        const fId = btn.dataset.folderId
        if (fId) btn.classList.toggle("active", fId === folderId)
    })
    
    // Reset scroll if changing context
    if (view !== "notes" || folderId !== prevFolder) {
         const container = document.getElementById("notes-content-area")
         if (container) container.scrollTop = 0
    }

    filterAndRender(document.getElementById("search-input")?.value || "")
}

// --- Actions ---

async function deleteFolder(folderId) {
    if (!folderId) return
    UI.confirm("delete_f", async () => {
        if (!db || !StateStore.read().user) return
        
        const notes = StateStore.read().notes.filter(n => n.folderId === folderId)
        const batch = db.batch()
        
        // Unlink notes from folder instead of deleting them
        notes.forEach(n => {
            const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(n.id)
            batch.update(ref, { folderId: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        })
        
        const folderRef = db.collection("users").doc(StateStore.read().user.uid).collection("folders").doc(folderId)
        batch.delete(folderRef)
        
        try {
            await batch.commit()
            if (StateStore.read().activeFolderId === folderId) {
                switchView("notes")
            }
            UI.showToast(UI.getText("folder_deleted", "Folder deleted"))
        } catch (e) {
            console.error(e)
            UI.showToast("Error deleting folder")
        }
    })
}

function openNoteActions(noteId) {
    UI.currentNoteActionId = noteId
    UI.openModal("note-actions-modal")
}

async function toggleFavorite(noteId) {
    if (!db || !StateStore.read().user) return
    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note) return
    
    const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(noteId)
    const next = !note.isFavorite
    
    // Optimistic UI update handled by listener, but we can animate button here if needed
    try {
        await ref.update({ isFavorite: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    } catch (e) {
        console.error("Toggle fav failed", e)
    }
}

async function togglePin(noteId) {
    if (!db || !StateStore.read().user) return
    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note) return
    
    const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(noteId)
    const next = !note.isPinned
    
    try {
        await ref.update({ isPinned: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        
        // Add visual feedback
        const card = document.querySelector(`.note-card[data-note-id="${encodeURIComponent(noteId)}"]`)
        if (card) {
            card.classList.add("pinning")
            setTimeout(() => card.classList.remove("pinning"), 500)
        }
    } catch (e) {
        console.error("Toggle pin failed", e)
    }
}

async function toggleArchive(noteId, archive) {
    if (!db || !StateStore.read().user) return
    const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(noteId)
    
    try {
        await ref.update({ isArchived: !!archive, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        UI.showToast(archive ? UI.getText("archived", "Archived") : UI.getText("restored", "Restored"))
    } catch (e) {
        UI.showToast("Error updating archive status")
    }
}

// --- Initialization ---

async function initApp() {
    try {
        await DriveService.init()
        ReminderService.init()
        if (typeof Editor !== "undefined") Editor.init()
        UI.init()
        UI.setLang(localStorage.getItem("app-lang") || "ru")

        if (!db || !StateStore.read().user) return

        // Folders Listener
        db.collection("users").doc(StateStore.read().user.uid).collection("folders")
            .orderBy("createdAt", "asc")
            .onSnapshot(snap => {
                const folders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                StateStore.update("folders", folders)
                UI.renderFolders()
                // Re-render if we are in folders view to update counts/grid
                if (StateStore.read().view === "folders") {
                    filterAndRender(document.getElementById("search-input")?.value || "")
                }
            })

        // Notes Listener
        db.collection("users").doc(StateStore.read().user.uid).collection("notes")
            .orderBy("order", "asc")
            .onSnapshot(snap => {
                const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                StateStore.update("notes", notes)
                filterAndRender(document.getElementById("search-input")?.value || "")
                if (typeof UI.handlePendingShare === "function") UI.handlePendingShare()
            })

        const search = document.getElementById("search-input")
        if (search) search.value = ""
        
        // Initial View
        switchView("notes")
        
        // Remove loader
        const loader = document.getElementById("app-loader")
        if (loader) loader.classList.add("hidden")
            
    } catch (e) {
        console.error("App Init Failed:", e)
        UI.showToast("Failed to initialize app")
    }
}

// Expose global functions for UI actions
window.initApp = initApp
window.switchView = switchView
window.filterAndRender = filterAndRender
window.deleteFolder = deleteFolder
window.openNoteActions = openNoteActions
window.toggleFavorite = toggleFavorite
window.togglePin = togglePin
window.toggleArchive = toggleArchive
