const UI = {
    els: {},
    currentNoteActionId: null,
    draggedNoteId: null,
    dragTargetId: null,
    dragPosition: null,
    visibleNotes: [],
    settingsPage: null,
    authTapLock: 0,
    lastTouchAt: 0,

    init() {
        this.els = {
            sidebar: document.getElementById("sidebar"),
            grid: document.getElementById("notes-container"),
            empty: document.getElementById("empty-state"),
            userMenu: document.getElementById("user-dropdown"),
            confirmModal: document.getElementById("confirm-modal"),
            promptModal: document.getElementById("prompt-modal"),
            fab: document.querySelector(".btn-fab"),
            folderList: document.getElementById("folder-list-root")
        }

        this.bindGlobalEvents()
        this.bindAuthButtons()
        this.bindAuthState()
        this.applyAppearanceSettings()
        this.updatePrimaryActionLabel()
        this.routeShare()
        window.addEventListener("hashchange", () => this.routeShare())
    },

    getText(key, fallback) {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        return dict[key] || fallback || key
    },

    bindGlobalEvents() {
        document.addEventListener("click", e => {
            const el = e.target.closest("[data-action]")
            if (el) this.handleAction(el, e)

            if (this.els.sidebar?.classList.contains("active") && !this.els.sidebar.contains(e.target) && !e.target.closest("#menu-toggle")) {
                this.toggleSidebar(false)
            }

            if (this.els.userMenu?.classList.contains("active") && !e.target.closest(".user-avatar-wrapper")) {
                this.toggleUserMenu(false)
            }

            const overlay = e.target.closest(".modal-overlay")
            if (overlay && e.target === overlay && !overlay.dataset.modalStatic) {
                overlay.classList.remove("active")
            }
        })

        const search = document.getElementById("search-input")
        if (search) {
            search.addEventListener("input", e => {
                filterAndRender(e.target.value)
            })
        }

        this.bindGridEvents()
    },

    bindGridEvents() {
        const grid = this.els.grid
        if (!grid) return

        grid.addEventListener("click", async e => {
            if (e.target.closest(".action-btn")) return
            if (this.els.userMenu?.classList.contains("active")) return
            const card = e.target.closest(".note-card")
            if (!card) return
            const id = decodeURIComponent(card.dataset.noteId || "")
            const note = StateStore.read().notes.find(n => n.id === id)
            if (note) await Editor.openFromList(note)
        })

        grid.addEventListener("dragstart", e => {
            const card = e.target.closest(".note-card")
            if (!card) return
            if (StateStore.read().searchQuery.trim()) {
                e.preventDefault()
                this.showToast(this.getText("reorder_search_disabled"))
                return
            }
            this.draggedNoteId = decodeURIComponent(card.dataset.noteId)
            card.classList.add("dragging")
            e.dataTransfer.effectAllowed = "move"
        })

        grid.addEventListener("dragover", e => {
            if (!this.draggedNoteId) return
            e.preventDefault()
            const card = e.target.closest(".note-card")
            if (!card) return
            const id = decodeURIComponent(card.dataset.noteId)
            if (id === this.draggedNoteId) return
            const rect = card.getBoundingClientRect()
            const before = e.clientY < rect.top + rect.height / 2
            this.dragTargetId = id
            this.dragPosition = before ? "before" : "after"
            this.setDropIndicator(card, this.dragPosition)
            this.autoScroll(e.clientY)
        })

        grid.addEventListener("drop", e => {
            if (!this.draggedNoteId || !this.dragTargetId) return
            e.preventDefault()
            this.reorderNotes(this.draggedNoteId, this.dragTargetId, this.dragPosition)
            this.clearDragIndicators()
        })

        grid.addEventListener("dragend", e => {
            const card = e.target.closest(".note-card")
            if (card) card.classList.remove("dragging")
            this.clearDragIndicators()
            this.draggedNoteId = null
            this.dragTargetId = null
        })
    },

    bindAuthButtons() {
        const btn = document.querySelector("[data-action='login']")
        if (!btn) return

        const handler = e => {
            const now = Date.now()
            if (e.type === "touchend") this.lastTouchAt = now
            if (e.type === "click" && now - this.lastTouchAt < 700) return
            if (now - this.authTapLock < 800) return
            this.authTapLock = now
            e.preventDefault()
            Auth.login()
        }

        btn.addEventListener("pointerup", handler, { passive: false })
        btn.addEventListener("touchend", handler, { passive: false })
        btn.addEventListener("click", handler)
    },

    bindAuthState() {
        if (!window.Auth) return
        Auth.on(user => this.handleAuthState(user))
    },

    handleAuthState(user) {
        StateStore.update("user", user || null)
        if (user) {
            this.applySignedInUI(user)
            if (typeof window.initApp === "function") window.initApp()
        } else {
            this.resetSession()
        }
    },

    applySignedInUI(user) {
        const login = document.getElementById("login-screen")
        const app = document.getElementById("app")
        const photo = document.getElementById("user-photo")
        const name = document.getElementById("user-name")

        if (photo) photo.src = user.photoURL || ""
        if (name) name.textContent = user.displayName || user.email || "User"

        if (login) {
            login.style.opacity = "0"
            setTimeout(() => {
                login.style.display = "none"
                login.classList.remove("active")
            }, 300)
        }

        if (app) {
            app.style.display = "flex"
            requestAnimationFrame(() => {
                app.style.opacity = "1"
                app.classList.add("active")
            })
        }
    },

    resetSession() {
        StateStore.resetSession()
        this.visibleNotes = []
        this.currentNoteActionId = null
        this.draggedNoteId = null
        this.dragTargetId = null
        this.dragPosition = null
        this.closeAllModals()
        this.renderFolders()
        this.updatePrimaryActionLabel()
        this.applySignedOutUI()
        try { Editor.close() } catch {}
    },

    applySignedOutUI() {
        const login = document.getElementById("login-screen")
        const app = document.getElementById("app")

        if (app) {
            app.style.opacity = "0"
            setTimeout(() => {
                app.style.display = "none"
                app.classList.remove("active")
            }, 200)
        }

        if (login) {
            login.style.display = "flex"
            requestAnimationFrame(() => {
                login.classList.add("active")
                login.style.opacity = "1"
            })
        }
    },

    handleAction(el, e) {
        const a = el.dataset.action
        if (!a) return

        switch (a) {
            case "toggle-sidebar":
                this.toggleSidebar()
                break
            case "toggle-user-menu":
                this.toggleUserMenu()
                break
            case "logout":
                Auth.logout()
                break
            case "primary-action":
                this.primaryAction()
                break
            case "open-settings":
                this.openSettings()
                break
            case "settings-back":
                this.backSettingsPage()
                break
            case "open-settings-page":
                this.openSettingsPage(el.dataset.page)
                break
            default:
                break
        }
    },

    toggleSidebar(force) {
        if (!this.els.sidebar) return
        this.els.sidebar.classList.toggle("active", typeof force === "boolean" ? force : !this.els.sidebar.classList.contains("active"))
    },

    toggleUserMenu(force) {
        if (!this.els.userMenu) return
        this.els.userMenu.classList.toggle("active", typeof force === "boolean" ? force : !this.els.userMenu.classList.contains("active"))
    },

    primaryAction() {
        if (StateStore.read().view === "folders") {
            Editor.openFolderCreator()
            return
        }
        Editor.open()
    },

    applyAppearanceSettings() {
        const saved = JSON.parse(localStorage.getItem("app-preferences")) || {}
        StateActions.updateConfig({
            folderViewMode: saved.folderViewMode || StateStore.read().config.folderViewMode,
            reduceMotion: !!saved.reduceMotion
        })
        ThemeManager.revertToLastSaved()
        this.renderFolders()
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return
        const label = StateStore.read().view === "folders"
            ? this.getText("create_folder")
            : this.getText("create_note")
        this.els.fab.setAttribute("aria-label", label)
    },

    renderFolders() {
        const root = this.els.folderList
        if (!root) return
        const hide = StateStore.read().config.folderViewMode === "full"
        root.classList.toggle("hidden", hide)
        if (hide) return
        const { folders, activeFolderId } = StateStore.read()
        root.innerHTML = folders.map(f => `
            <button type="button" class="nav-item ${activeFolderId === f.id ? "active" : ""}" data-action="open-folder" data-folder-id="${f.id}">
                <span>${Utils.escapeHtml(f.name)}</span>
            </button>
        `).join("")
    },

    showToast(msg) {
        const div = document.createElement("div")
        div.className = "toast show"
        div.textContent = msg
        const root = document.getElementById("toast-container")
        if (!root) return
        root.appendChild(div)
        setTimeout(() => {
            div.classList.remove("show")
            setTimeout(() => div.remove(), 300)
        }, 2500)
    },

    closeAllModals() {
        document.querySelectorAll(".modal-overlay.active").forEach(el => el.classList.remove("active"))
    },

    setDropIndicator(card, pos) {
        this.clearDragIndicators()
        card.classList.add(pos === "before" ? "drop-before" : "drop-after")
    },

    clearDragIndicators() {
        this.els.grid?.querySelectorAll(".note-card").forEach(c => {
            c.classList.remove("drop-before", "drop-after")
        })
    },

    autoScroll(y) {
        const c = document.getElementById("notes-content-area")
        if (!c) return
        const r = c.getBoundingClientRect()
        const t = 80
        if (y < r.top + t) c.scrollBy({ top: -12, behavior: "smooth" })
        if (y > r.bottom - t) c.scrollBy({ top: 12, behavior: "smooth" })
    },

    routeShare() {
        const raw = String(location.hash || "")
        const parsed = ShareService.parseHash(raw)
        if (!parsed) return
        StateActions.setPendingShare(parsed)
        history.replaceState({}, "", ShareService.base())
        this.handlePendingShare()
    },

    handlePendingShare() {
        const { pendingShare, notes } = StateStore.read()
        if (!pendingShare || !notes.length) return
        const note = notes.find(n => n.id === pendingShare.noteId)
        if (note) Editor.openFromList(note)
    }
}

window.UI = UI
