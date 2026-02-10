const UI = {
    els: {},
    currentNoteActionId: null,
    draggedNoteId: null,
    dragTargetId: null,
    dragPosition: null,
    draggedFolderId: null,
    visibleNotes: [],
    settingsPage: null,

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
            activeFolderHideButton: document.getElementById("active-folder-hide-button")
        }
        this.bindEvents()
        if (window.matchMedia("(min-width: 1024px)").matches) {
            this.els.sidebar?.classList.add("active")
        }
        this.updateSidebarLayout()
        window.addEventListener("resize", () => this.updateSidebarLayout())
        this.applyAppearanceSettings()
        this.renderFilterMenu()
        this.updatePrimaryActionLabel()
    },

    getText(key, fallback = "") {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        return dict[key] || fallback || key
    },

    setLang(lang) {
        const applied = StateActions.setLanguage(lang)
        localStorage.setItem("app-lang", applied)
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
