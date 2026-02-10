Object.assign(UI, {
    setDropIndicator(card, position) {
        this.clearDragIndicators()
        card.classList.add(position === "before" ? "drop-before" : "drop-after")
    },

    clearDragIndicators() {
        if (!this.els.grid) return
        this.els.grid.querySelectorAll(".note-card").forEach(card => {
            card.classList.remove("drop-before", "drop-after")
        })
    },

    autoScroll(cursorY) {
        const container = document.getElementById("notes-content-area")
        if (!container) return
        const rect = container.getBoundingClientRect()
        const threshold = 80
        if (cursorY < rect.top + threshold) container.scrollBy({ top: -12, behavior: "smooth" })
        else if (cursorY > rect.bottom - threshold) container.scrollBy({ top: 12, behavior: "smooth" })
    },

    getReorderScope() {
        const { notes, view, activeFolderId } = StateStore.read()
        if (view === "locked" || view === "future") return []
        let list = notes.slice()
        if (view === "favorites") list = list.filter(n => !!n.isFavorite && !n.isArchived)
        if (view === "archive") list = list.filter(n => !!n.isArchived)
        if (view === "notes") list = list.filter(n => !n.isArchived)
        if (view === "folder") list = list.filter(n => !n.isArchived && n.folderId === activeFolderId)
        return list
    },

    reorderNotes(draggedId, targetId, position) {
        if (!db || !StateStore.read().user) return
        if (draggedId === targetId) return
        if (StateStore.read().searchQuery.trim()) {
            this.showToast(this.getText("reorder_search_disabled", "Reordering is disabled while searching"))
            return
        }
        const notesFilter = StateStore.read().config.notesFilter || { sort: "updated" }
        if (notesFilter.sort && notesFilter.sort !== "manual") {
            this.showToast(this.getText("reorder_sort_disabled", "Switch to manual sorting to reorder"))
            return
        }
        const draggedNote = StateStore.read().notes.find(n => n.id === draggedId)
        const targetNote = StateStore.read().notes.find(n => n.id === targetId)
        if (!draggedNote || !targetNote) return
        const { view, activeFolderId } = StateStore.read()
        const isFolderView = view === "folder" && !!activeFolderId
        if (!!draggedNote.isPinned !== !!targetNote.isPinned) {
            this.showToast(this.getText("reorder_pinned_blocked", "Pinned notes reorder separately"))
            return
        }
        const orderKey = isFolderView ? "folderOrder" : "order"
        const groupIds = this.visibleNotes.filter(n => !!n.isPinned === !!draggedNote.isPinned).map(n => n.id)
        const fromIndex = groupIds.indexOf(draggedId)
        const toIndex = groupIds.indexOf(targetId)
        if (fromIndex === -1 || toIndex === -1) return
        groupIds.splice(fromIndex, 1)
        const insertIndex = position === "after" ? toIndex + 1 : toIndex
        groupIds.splice(insertIndex > fromIndex ? insertIndex - 1 : insertIndex, 0, draggedId)

        const previous = groupIds.map(id => {
            const note = StateStore.read().notes.find(n => n.id === id)
            return { id, value: typeof note?.[orderKey] === "number" ? note[orderKey] : 0 }
        })
        const { orderHistory } = StateStore.read()
        const scopeKey = `${view}:${activeFolderId || "all"}:${draggedNote.isPinned ? "pinned" : "unpinned"}`
        const nextHistory = [...orderHistory, { scope: scopeKey, orderKey, items: previous }].slice(-20)
        StateActions.setOrderHistory(nextHistory)

        const updates = groupIds.map((id, index) => ({ id, value: index + 1 }))
        const updatedNotes = StateStore.read().notes.map(note => {
            const update = updates.find(item => item.id === note.id)
            return update ? { ...note, [orderKey]: update.value } : note
        })
        StateActions.setNotes(updatedNotes)

        const batch = db.batch()
        updates.forEach(update => {
            const ref = DataPath.getUserNotesCollection(StateStore.read().user).doc(update.id)
            batch.update(ref, { [orderKey]: update.value })
        })
        batch.commit()
        this.showToast(this.getText("order_updated", "Order updated"), {
            actionLabel: this.getText("undo", "Undo"),
            onAction: () => this.undoOrder()
        })
        filterAndRender(document.getElementById("search-input")?.value || "")
    },

    undoOrder() {
        if (!db || !StateStore.read().user) return
        const last = StateStore.read().orderHistory[StateStore.read().orderHistory.length - 1]
        if (!last) return
        StateActions.setOrderHistory(StateStore.read().orderHistory.slice(0, -1))
        const batch = db.batch()
        const orderKey = last.orderKey || "order"
        const updatedNotes = StateStore.read().notes.map(note => {
            const item = last.items.find(entry => entry.id === note.id)
            return item ? { ...note, [orderKey]: item.value } : note
        })
        StateActions.setNotes(updatedNotes)
        last.items.forEach(item => {
            const ref = DataPath.getUserNotesCollection(StateStore.read().user).doc(item.id)
            batch.update(ref, { [orderKey]: item.value })
        })
        batch.commit()
        filterAndRender(document.getElementById("search-input")?.value || "")
    }
})
