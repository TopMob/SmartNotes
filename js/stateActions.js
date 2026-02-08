const StateActions = {
    setLanguage(lang) {
        const next = lang === "en" ? "en" : "ru"
        StateStore.updateConfig({ lang: next })
        return next
    },
    setTempRating(val) {
        StateStore.update("tempRating", val)
    },
    setSearchQuery(query) {
        StateStore.update("searchQuery", String(query || ""))
    },
    setView(view, folderId = null) {
        StateStore.set(prev => ({ ...prev, view, activeFolderId: folderId }))
    },
    setNotes(notes) {
        StateStore.update("notes", notes)
    },
    setFolders(folders) {
        StateStore.update("folders", folders)
    },
    setCurrentNote(note) {
        StateStore.update("currentNote", note)
    },
    setEditorDirty(flag) {
        StateStore.update("editorDirty", !!flag)
    },
    updateConfig(values) {
        StateStore.updateConfig(values)
    },
    setOrderHistory(history) {
        StateStore.update("orderHistory", history)
    },
    setUser(user) {
        StateStore.update("user", user || null)
    },
    resetSession() {
        StateStore.resetSession()
    }
}

window.StateActions = StateActions
