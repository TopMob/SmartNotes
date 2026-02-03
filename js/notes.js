function normalizeVisibleNotes(list, orderKey = "order") {
    const arr = (list || []).filter(Boolean).map(n => NoteIO.normalizeNote(n))
    arr.sort((a, b) => {
        const ap = a.isPinned ? 1 : 0
        const bp = b.isPinned ? 1 : 0
        if (bp !== ap) return bp - ap
        const ao = typeof a[orderKey] === "number" ? a[orderKey] : 0
        const bo = typeof b[orderKey] === "number" ? b[orderKey] : 0
        return ao - bo
    })
    return arr
}

function renderNotes(list) {
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

    grid.innerHTML = list.map(n => {
        const title = n.title ? n.title : UI.getText("untitled_note", "Untitled")
        const preview = Utils.stripHtml(n.content || "").trim() || UI.getText("empty_note", "No content")
        const lockLabel = UI.getText("locked_note", "Locked")
        const lock = n.lock && n.lock.hidden ? `<span class="lock-badge"><i class="material-icons-round" aria-hidden="true" style="font-size:16px">lock</i><span>${Utils.escapeHtml(lockLabel)}</span></span>` : ""
        const pinCls = n.isPinned ? "pinned" : ""
        const tagLine = Array.isArray(n.tags) && n.tags.length ? n.tags.slice(0, 3).map(t => `#${Utils.escapeHtml(String(t))}`).join(" ") : ""
        const date = Utils.formatDate(n.updatedAt || n.createdAt || Date.now())
        const pinLabel = UI.getText("pin_note", "Pin")
        const favLabel = UI.getText("favorite_note", "Favorite")
        const menuLabel = UI.getText("note_actions", "Actions")
        return `
            <div class="note-card ${pinCls}" draggable="true" data-note-id="${encodeURIComponent(n.id)}">
                <div class="card-actions">
                    <button type="button" class="action-btn" aria-label="${Utils.escapeHtml(pinLabel)}" data-action="note-pin" data-note-id="${encodeURIComponent(n.id)}"><i class="material-icons-round" aria-hidden="true">push_pin</i></button>
                    <button type="button" class="action-btn" aria-label="${Utils.escapeHtml(favLabel)}" data-action="note-favorite" data-note-id="${encodeURIComponent(n.id)}"><i class="material-icons-round" aria-hidden="true">star</i></button>
                    <button type="button" class="action-btn" aria-label="${Utils.escapeHtml(menuLabel)}" data-action="note-menu" data-note-id="${encodeURIComponent(n.id)}"><i class="material-icons-round" aria-hidden="true">more_horiz</i></button>
                </div>
                <h3>${Utils.escapeHtml(title)}</h3>
                <p>${Utils.escapeHtml(preview)}</p>
                <div class="note-meta">
                    <i class="material-icons-round" aria-hidden="true">schedule</i>
                    <span>${Utils.escapeHtml(date)}</span>
                    <span style="margin-left:auto; opacity:0.8">${Utils.escapeHtml(tagLine)}</span>
                </div>
                ${lock ? `<div style="margin-top:8px">${lock}</div>` : ""}
            </div>
        `
    }).join("")
}

function filterAndRender(query) {
    const queryValue = String(query || "")
    const current = StateStore.read()
    StateStore.update("searchQuery", queryValue)
    const q = queryValue.trim()
    if (current.view === "folder" && !current.activeFolderId) StateStore.update("view", "notes")
    let list = current.notes.slice()

    const view = StateStore.read().view
    const activeFolderId = StateStore.read().activeFolderId
    if (view === "favorites") list = list.filter(n => !!n.isFavorite && !n.isArchived)
    if (view === "archive") list = list.filter(n => !!n.isArchived)
    if (view === "notes") list = list.filter(n => !n.isArchived)
    if (view === "folder") list = list.filter(n => !n.isArchived && n.folderId === activeFolderId)

    if (q) {
        const scored = list.map(n => {
            const score = SmartSearch.score(q, n.title, n.content, n.tags)
            return { n, score }
        }).filter(x => x.score >= 0.35).sort((a, b) => b.score - a.score)
        list = scored.map(x => x.n)
    }

    const orderKey = view === "folder" ? "folderOrder" : "order"
    list = normalizeVisibleNotes(list, orderKey)
    if (StateStore.read().view === "folders") {
        UI.renderFolderGrid()
        UI.updateViewTitle()
        UI.updatePrimaryActionLabel()
        return
    }
    renderNotes(list)
    UI.updateViewTitle()
    UI.updatePrimaryActionLabel()
}

function switchView(view, folderId = null) {
    StateStore.set(prev => ({ ...prev, view, activeFolderId: folderId }))
    document.querySelectorAll(".nav-item").forEach(btn => {
        const v = btn.dataset.view
        if (!v) return
        btn.classList.toggle("active", v === view)
    })
    filterAndRender(document.getElementById("search-input")?.value || "")
}

async function deleteFolder(folderId) {
    if (!folderId) return
    UI.confirm("delete_f", async () => {
        if (!db || !StateStore.read().user) return
        const notes = StateStore.read().notes.filter(n => n.folderId === folderId)
        const batch = db.batch()
        notes.forEach(n => {
            const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(n.id)
            batch.update(ref, { folderId: null })
        })
        const folderRef = db.collection("users").doc(StateStore.read().user.uid).collection("folders").doc(folderId)
        batch.delete(folderRef)
        await batch.commit()
        if (StateStore.read().activeFolderId === folderId) {
            StateStore.set(prev => ({ ...prev, activeFolderId: null, view: "notes" }))
        }
        UI.showToast(UI.getText("folder_deleted", "Folder deleted"))
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
    await ref.update({ isFavorite: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
}

async function togglePin(noteId) {
    if (!db || !StateStore.read().user) return
    const note = StateStore.read().notes.find(n => n.id === noteId)
    if (!note) return
    const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(noteId)
    const next = !note.isPinned
    await ref.update({ isPinned: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    const card = document.querySelector(`.note-card[data-note-id="${encodeURIComponent(noteId)}"]`)
    if (card) {
        card.classList.add("pinning")
        setTimeout(() => card.classList.remove("pinning"), 520)
    }
}

async function toggleArchive(noteId, archive) {
    if (!db || !StateStore.read().user) return
    const ref = db.collection("users").doc(StateStore.read().user.uid).collection("notes").doc(noteId)
    await ref.update({ isArchived: !!archive, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    UI.showToast(archive ? UI.getText("archived", "Archived") : UI.getText("restored", "Restored"))
}

async function initApp() {
    await DriveService.init()
    ReminderService.init()
    Editor.init()
    UI.init()
    UI.setLang(localStorage.getItem("app-lang") || "ru")

    if (!db || !StateStore.read().user) return

    db.collection("users").doc(StateStore.read().user.uid).collection("folders")
        .orderBy("createdAt", "asc")
        .onSnapshot(snap => {
            StateStore.update("folders", snap.docs.map(d => ({ id: d.id, ...d.data() })))
            UI.renderFolders()
            if (StateStore.read().view === "folders") filterAndRender(document.getElementById("search-input")?.value || "")
        })

    db.collection("users").doc(StateStore.read().user.uid).collection("notes")
        .orderBy("order", "asc")
        .onSnapshot(snap => {
            StateStore.update("notes", snap.docs.map(d => ({ id: d.id, ...d.data() })))
            filterAndRender(document.getElementById("search-input")?.value || "")
            if (typeof UI.handlePendingShare === "function") UI.handlePendingShare()
        })

    const search = document.getElementById("search-input")
    if (search) search.value = ""
    switchView("notes")
}

window.initApp = initApp
window.switchView = switchView
window.filterAndRender = filterAndRender
window.deleteFolder = deleteFolder
window.openNoteActions = openNoteActions
window.toggleFavorite = toggleFavorite
window.togglePin = togglePin
window.toggleArchive = toggleArchive
