const UI = {
    els: {},
    currentNoteActionId: null,
    draggedNoteId: null,
    dragTargetId: null,
    dragPosition: null,
    draggedFolderId: null,
    settingsPage: null,
    eventsBound: false,
    eventListenersController: null,
    resizeListenersController: null,
    toastDeduplication: { lastMessage: "", lastShownAt: 0 },

    init() {
        this.els = {
            sidebar: document.getElementById("sidebar"),
            grid: document.getElementById("notes-container"),
            empty: document.getElementById("empty-state"),
            userMenu: document.getElementById("user-dropdown"),
            confirmModal: document.getElementById("confirm-modal"),
            promptModal: document.getElementById("prompt-modal"),
            fab: document.querySelector(".btn-fab"),
            folderList: document.getElementById("folder-list-root"),
            sidebarOverlay: document.getElementById("sidebar-overlay"),
            filterMenu: document.getElementById("notes-filter-menu"),
            filterButton: document.getElementById("notes-filter-toggle"),
            filterFolders: document.getElementById("notes-folder-filters"),
            filterSort: document.getElementById("notes-sort-select"),
            activeFolderMenu: document.getElementById("active-folder-menu"),
            activeFolderMenuToggle: document.getElementById("active-folder-menu-toggle"),
            activeFolderMenuWrapper: document.getElementById("active-folder-menu-wrapper"),
            activeFolderHideButton: document.getElementById("active-folder-hide-button"),
            adminToolsNavButton: document.getElementById("admin-tools-nav-button")
        }
        this.bindEvents()
        if (window.matchMedia("(min-width: 1024px)").matches) {
            this.els.sidebar?.classList.add("active")
        }
        this.updateSidebarLayout()
        if (this.resizeListenersController) this.resizeListenersController.abort()
        this.resizeListenersController = new AbortController()
        window.addEventListener("resize", () => this.updateSidebarLayout(), { signal: this.resizeListenersController.signal })
        this.applyAppearanceSettings()
        this.renderFilterMenu()
        this.updatePrimaryActionLabel()
        this.applyInputAutocompletePolicy()
    },

    getText(key, fallback = "") {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        return dict[key] || fallback || key
    },

    isAuthAutocompleteAllowed(element) {
        return !!element?.closest?.("#login-screen")
    },

    prepareProtectedInput(element, mode = "text") {
        if (!element) return null
        const normalizedMode = mode === "password" ? "password" : "text"
        element.setAttribute("data-lpignore", "true")
        element.setAttribute("data-1p-ignore", "true")
        element.setAttribute("data-form-type", "other")
        element.setAttribute("autocapitalize", "off")
        element.setAttribute("autocorrect", "off")
        element.setAttribute("spellcheck", "false")
        element.setAttribute("inputmode", "text")
        element.setAttribute("autocomplete", normalizedMode === "password" ? "new-password" : "off")
        element.setAttribute("name", `smartnotes_${normalizedMode}_${Date.now()}`)
        element.readOnly = true
        requestAnimationFrame(() => {
            element.readOnly = false
        })
        return element
    },

    applyInputAutocompletePolicy(root = document) {
        const scope = root && typeof root.querySelectorAll === "function" ? root : document
        scope.querySelectorAll("input, textarea").forEach(element => {
            if (this.isAuthAutocompleteAllowed(element)) return
            const tagName = element.tagName.toLowerCase()
            const inputType = String(element.getAttribute("type") || "text").toLowerCase()
            if (inputType === "hidden") return
            if (tagName === "textarea") {
                this.prepareProtectedInput(element, "text")
                element.setAttribute("autocomplete", "off")
                return
            }
            if (inputType === "password") {
                this.prepareProtectedInput(element, "password")
                return
            }
            if (!["checkbox", "radio", "range", "file", "button", "submit", "color"].includes(inputType)) {
                this.prepareProtectedInput(element, "text")
                element.setAttribute("autocomplete", "off")
            }
        })
    },

    setLang(lang) {
        const applied = StateActions.setLanguage(lang)
        SafeStorage.local.set("app-lang", applied)
        this.applyLangToDom()
        this.updateViewTitle()
        this.updatePrimaryActionLabel()
        ThemeManager.renderPicker()
        this.syncSettingsUI()
        this.renderEditorSettings()
        this.renderFilterMenu()
        this.renderSettingsPage()
    },

    applyLangToDom() {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        document.documentElement.lang = StateStore.read().config.lang === "en" ? "en" : "ru"
        document.querySelectorAll("[data-lang]").forEach(el => {
            const k = el.getAttribute("data-lang")
            if (k && dict[k]) el.textContent = dict[k]
        })
        document.querySelectorAll("[data-lang-placeholder]").forEach(el => {
            const k = el.getAttribute("data-lang-placeholder")
            if (k && dict[k]) el.setAttribute("placeholder", dict[k])
        })
        document.querySelectorAll("[data-lang-aria]").forEach(el => {
            const k = el.getAttribute("data-lang-aria")
            if (k && dict[k]) el.setAttribute("aria-label", dict[k])
        })
    },

    
}
