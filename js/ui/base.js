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
    inputPolicyObserver: null,
    toastDeduplication: { lastMessage: "", lastShownAt: 0 },
    loadingLocks: new Set(),

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
            clearTrashButton: document.getElementById("clear-trash-button"),
            savedFilterSelect: document.getElementById("notes-saved-filter-select"),
            saveFilterButton: document.getElementById("notes-save-filter-button"),
            deleteFilterButton: document.getElementById("notes-delete-filter-button"),
            tagFilterInput: document.getElementById("notes-tag-filter-input"),
            dateFilterSelect: document.getElementById("notes-date-filter-select"),
            filterFolders: document.getElementById("notes-folder-filters"),
            filterSort: document.getElementById("notes-sort-select"),
            activeFolderMenu: document.getElementById("active-folder-menu"),
            activeFolderMenuToggle: document.getElementById("active-folder-menu-toggle"),
            activeFolderMenuWrapper: document.getElementById("active-folder-menu-wrapper"),
            activeFolderHideButton: document.getElementById("active-folder-hide-button"),
            activeWorkspaceMenu: document.getElementById("active-workspace-menu"),
            activeWorkspaceMenuToggle: document.getElementById("active-workspace-menu-toggle"),
            activeWorkspaceMenuWrapper: document.getElementById("active-workspace-menu-wrapper"),
            workspaceCopyLinkButton: document.getElementById("workspace-copy-link-button"),
            workspaceAddUserButton: document.getElementById("workspace-add-user-button"),
            workspaceRenameButton: document.getElementById("workspace-rename-button"),
            workspaceEditDescriptionButton: document.getElementById("workspace-edit-description-button"),
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

    resolveNoteById(noteId) {
        const targetId = String(noteId || "")
        if (!targetId) return null
        const notes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
        return notes.find(note => String(note?.id || "") === targetId) || null
    },

    isAuthAutocompleteAllowed(element) {
        return false
    },

    applyInputAutocompletePolicy(root = document) {
        const scope = root && typeof root.querySelectorAll === "function" ? root : document
        scope.querySelectorAll("input, textarea").forEach(element => {
            const tagName = element.tagName.toLowerCase()
            const inputType = String(element.getAttribute("type") || "text").toLowerCase()
            if (inputType === "hidden") return
            const closestForm = element.closest("form")
            if (closestForm) closestForm.setAttribute("autocomplete", "off")
            if (!element.dataset.noAutofillName) {
                element.dataset.noAutofillName = `sn_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
            }
            element.setAttribute("data-lpignore", "true")
            element.setAttribute("data-1p-ignore", "true")
            element.setAttribute("data-form-type", "other")
            element.setAttribute("autocorrect", "off")
            element.setAttribute("autocapitalize", "off")
            element.setAttribute("spellcheck", "false")
            element.setAttribute("aria-autocomplete", "none")
            if (tagName === "textarea") {
                element.setAttribute("autocomplete", "new-password")
                element.setAttribute("name", element.dataset.noAutofillName)
                return
            }
            if (inputType === "password") {
                element.setAttribute("autocomplete", "new-password")
                element.setAttribute("name", element.dataset.noAutofillName)
                element.setAttribute("inputmode", "text")
                return
            }
            if (!["checkbox", "radio", "range", "file", "button", "submit", "color"].includes(inputType)) {
                element.setAttribute("autocomplete", "new-password")
                element.setAttribute("name", element.dataset.noAutofillName)
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
