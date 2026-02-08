Object.assign(UI, {
    savePreferences() {
        const prefs = {
            folderViewMode: StateStore.read().config.folderViewMode,
            reduceMotion: StateStore.read().config.reduceMotion
        }
        localStorage.setItem("app-preferences", JSON.stringify(prefs))
    },

    closeAllModals() {
        document.querySelectorAll(".modal-overlay.active").forEach(el => el.classList.remove("active"))
    }
})
