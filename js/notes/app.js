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
            }, error => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
                console.error("Folders sync error", error)
            })

        const notesUnsub = db.collection("users").doc(user.uid).collection("notes")
            .orderBy("order", "asc")
            .onSnapshot(snap => {
                let notes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                notes = NotesStorage.applyStoredFavorites(notes)
                StateStore.update("notes", notes)
                NotesStorage.syncFavoritesStorage(notes)
                filterAndRender(document.getElementById("search-input")?.value || "")
            }, error => {
                UI.showToast(UI.getText("sync_error", "Sync error"))
                console.error("Notes sync error", error)
            })

        this.unsubscribers = [folderUnsub, notesUnsub]

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
