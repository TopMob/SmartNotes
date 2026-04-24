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
        this.applyFeatureAvailability()
        this.renderFilterMenu()
        this.updatePrimaryActionLabel()
        this.applyInputAutocompletePolicy()
    },

    getText(key, fallback = "") {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        return dict[key] || fallback || key
    },

    isFeatureEnabled(featureKey = "") {
        const normalizedFeatureKey = String(featureKey || "").trim()
        if (!normalizedFeatureKey) return false
        return window.AppFeatures?.[normalizedFeatureKey] === true
    },

    showFeatureDisabledToast(featureKey = "") {
        const normalizedFeatureKey = String(featureKey || "").trim()
        const fallbackByFeature = {
            workspaces: "Совместные папки временно отключены",
            googleDrive: "Google Drive временно отключён",
            feedback: "Обратная связь временно отключена",
            poll: "Опрос временно отключён"
        }
        const fallbackMessage = fallbackByFeature[normalizedFeatureKey] || "Функция временно отключена"
        this.showToast(this.getText(`feature_${normalizedFeatureKey}_disabled`, fallbackMessage))
    },

    applyFeatureAvailability() {
        const feedbackEnabled = this.isFeatureEnabled("feedback") || this.isFeatureEnabled("poll")
        const driveEnabled = this.isFeatureEnabled("googleDrive")

        document.querySelectorAll('[data-modal="feedback-menu-modal"]').forEach(element => {
            element.classList.toggle("hidden", !feedbackEnabled)
            if ("disabled" in element) element.disabled = !feedbackEnabled
            element.setAttribute("aria-hidden", feedbackEnabled ? "false" : "true")
        })

        document.querySelectorAll('[data-action="settings-backup-all-notes"], [data-action="settings-backup-folder"]').forEach(element => {
            element.classList.toggle("hidden", !driveEnabled)
            if ("disabled" in element) element.disabled = !driveEnabled
            element.setAttribute("aria-hidden", driveEnabled ? "false" : "true")
        })
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

Object.assign(UI, {
    bindEvents() {
        if (this.eventListenersController) return
        this.eventsBound = true
        this.eventListenersController = new AbortController()
        const listenersSignal = this.eventListenersController.signal

        document.addEventListener("click", (event) => {
            const actionElement = event.target.closest("[data-action]")
            if (actionElement) {
                this.handleAction(actionElement, event)
            }

            const isDesktop = window.matchMedia("(min-width: 1024px)").matches
            if (!isDesktop && this.els.sidebar?.classList.contains("active") && this.els.sidebar && !this.els.sidebar.contains(event.target) && !event.target.closest("#menu-toggle")) {
                this.toggleSidebar(false)
            }
            if (this.els.userMenu?.classList.contains("active") && !event.target.closest(".user-avatar-wrapper")) {
                this.toggleUserMenu(false)
            }
            if (this.els.filterMenu?.classList.contains("active") && !event.target.closest("#notes-filter-menu") && !event.target.closest("#notes-filter-toggle")) {
                this.toggleFilterMenu(false)
            }
            if (this.els.activeFolderMenu?.classList.contains("active") && !event.target.closest("#active-folder-menu-wrapper")) {
                this.toggleActiveFolderMenu(false)
            }
            if (this.els.activeWorkspaceMenu?.classList.contains("active") && !event.target.closest("#active-workspace-menu-wrapper")) {
                this.toggleActiveWorkspaceMenu(false)
            }

            const overlayElement = event.target.closest(".modal-overlay")
            if (overlayElement && event.target === overlayElement && !overlayElement.dataset.modalStatic) {
                if (overlayElement.id === "settings-modal") {
                    this.requestCloseSettingsModal()
                } else {
                    this.closeModal(overlayElement.id)
                }
            }
        }, { signal: listenersSignal })

        this.els.sidebarOverlay?.addEventListener("click", () => this.toggleSidebar(false), { signal: listenersSignal })

        if (this.els.folderList) {
            this.els.folderList.addEventListener("dragstart", event => {
                const folderElement = event.target.closest("[data-folder-draggable='true']")
                if (!folderElement) return
                this.draggedFolderId = folderElement.dataset.folderId
            }, { signal: listenersSignal })
            this.els.folderList.addEventListener("dragover", event => {
                if (!this.draggedFolderId) return
                const targetElement = event.target.closest("[data-folder-draggable='true']")
                if (!targetElement || targetElement.dataset.folderId === this.draggedFolderId) return
                event.preventDefault()
            }, { signal: listenersSignal })
            this.els.folderList.addEventListener("drop", event => {
                if (!this.draggedFolderId) return
                const targetElement = event.target.closest("[data-folder-draggable='true']")
                if (!targetElement) return
                event.preventDefault()
                this.reorderFolders(this.draggedFolderId, targetElement.dataset.folderId)
                this.draggedFolderId = null
            }, { signal: listenersSignal })
            this.els.folderList.addEventListener("dragend", () => {
                this.draggedFolderId = null
            }, { signal: listenersSignal })
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.els.sidebar?.classList.contains("active")) {
                this.toggleSidebar(false)
            }
        }, { signal: listenersSignal })

        if (window.history?.pushState) {
            window.history.pushState({ appNavigationGuard: true }, "")
            window.addEventListener("popstate", () => {
                const isMobileViewport = window.matchMedia("(max-width: 1023px)").matches
                if (!isMobileViewport) return
                const handled = this.handleMobileBackNavigation()
                if (handled) {
                    window.history.pushState({ appNavigationGuard: true }, "")
                }
            }, { signal: listenersSignal })
        }

        document.querySelectorAll(".star").forEach(starElement => {
            starElement.addEventListener("click", () => {
                const selectedRating = parseInt(starElement.dataset.val, 10)
                StateActions.setTempRating(selectedRating)
                document.querySelectorAll(".star").forEach(iteratedStarElement => {
                    const starValue = parseInt(iteratedStarElement.dataset.val, 10)
                    iteratedStarElement.textContent = starValue <= selectedRating ? "star" : "star_border"
                    iteratedStarElement.classList.toggle("active", starValue <= selectedRating)
                })
            }, { signal: listenersSignal })
        })

        const promptInputElement = document.getElementById("prompt-input")
        if (promptInputElement) {
            promptInputElement.addEventListener("keydown", event => {
                if (event.key === "Enter") document.getElementById("prompt-ok")?.click()
            }, { signal: listenersSignal })
        }

        const searchInputElement = document.getElementById("search-input")
        if (searchInputElement) {
            searchInputElement.addEventListener("input", event => {
                const nextQueryValue = typeof event.target?.value === "string" ? event.target.value : ""
                updateSearchQuery(nextQueryValue)
            }, { signal: listenersSignal })
        }

        this.els.filterSort?.addEventListener("change", event => {
            const safeSortValue = window.DomSecurity.sanitizeInputValue(event.target?.value, "updated")
            this.updateFilterConfig({ sort: safeSortValue })
        }, { signal: listenersSignal })

        this.els.tagFilterInput?.addEventListener("change", event => {
            const selectedTags = this.readTagFilterSelection(event.target?.value)
            this.updateFilterConfig({ tags: selectedTags })
        }, { signal: listenersSignal })

        this.els.dateFilterSelect?.addEventListener("change", event => {
            this.updateFilterConfig({ updatedWindowDays: Number(event.target?.value || 0) })
        }, { signal: listenersSignal })

        this.els.filterFolders?.addEventListener("change", event => {
            const checkboxInput = event.target.closest("input[type='checkbox']")
            if (!checkboxInput) return
            const selectedFolders = this.readFolderFilterSelection()
            this.updateFilterConfig({ folders: selectedFolders })
        }, { signal: listenersSignal })

        this.els.savedFilterSelect?.addEventListener("change", event => {
            const savedFilterId = String(event.target?.value || "")
            if (!savedFilterId) return
            this.applySavedFilter(savedFilterId)
        }, { signal: listenersSignal })

        this.els.saveFilterButton?.addEventListener("click", () => {
            this.saveCurrentFilterPreset()
        }, { signal: listenersSignal })

        this.els.deleteFilterButton?.addEventListener("click", () => {
            const savedFilterId = String(this.els.savedFilterSelect?.value || "")
            if (!savedFilterId) return
            this.deleteSavedFilter(savedFilterId)
        }, { signal: listenersSignal })

        this.els.grid?.addEventListener("click", async event => {
            const actionElement = event.target.closest("[data-action], button, a, input, select, textarea, label")
            if (actionElement) return
            if (this.els.userMenu?.classList.contains("active")) return
            const noteCardElement = event.target.closest(".note-card")
            if (!noteCardElement) return
            const noteIdentifier = noteCardElement.dataset.noteId ? decodeURIComponent(noteCardElement.dataset.noteId) : ""
            if (!noteIdentifier) return
            const note = StateStore.read().notes.find(noteEntry => noteEntry.id === noteIdentifier)
            if (!note) return
            await window.SmartNotesEditor?.openFromList?.(note)
        }, { signal: listenersSignal })

        this.els.grid?.addEventListener("dragstart", event => {
            const noteCardElement = event.target.closest(".note-card")
            if (!noteCardElement) return
            if (StateStore.read().searchQuery.trim()) {
                event.preventDefault()
                this.showToast(this.getText("reorder_search_disabled", "Reordering is disabled while searching"))
                return
            }
            const encodedNoteIdentifier = noteCardElement.dataset.noteId || ""
            if (!encodedNoteIdentifier) return
            this.draggedNoteId = decodeURIComponent(encodedNoteIdentifier)
            noteCardElement.classList.add("dragging")
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", this.draggedNoteId)
            }
        }, { signal: listenersSignal })

        this.els.grid?.addEventListener("dragover", event => {
            if (!this.draggedNoteId) return
            event.preventDefault()
            const noteCardElement = event.target.closest(".note-card")
            if (!noteCardElement) return
            const encodedTargetIdentifier = noteCardElement.dataset.noteId || ""
            if (!encodedTargetIdentifier) return
            const targetIdentifier = decodeURIComponent(encodedTargetIdentifier)
            if (!targetIdentifier || targetIdentifier === this.draggedNoteId) return
            const cardRect = noteCardElement.getBoundingClientRect()
            const shouldInsertBefore = event.clientY < cardRect.top + cardRect.height / 2
            this.dragTargetId = targetIdentifier
            this.dragPosition = shouldInsertBefore ? "before" : "after"
            this.setDropIndicator(noteCardElement, this.dragPosition)
            this.autoScroll(event.clientY)
        }, { signal: listenersSignal })

        this.els.grid?.addEventListener("drop", event => {
            if (!this.draggedNoteId || !this.dragTargetId) return
            event.preventDefault()
            this.reorderNotes(this.draggedNoteId, this.dragTargetId, this.dragPosition)
            this.clearDragIndicators()
        }, { signal: listenersSignal })

        this.els.grid?.addEventListener("dragend", event => {
            const noteCardElement = event.target.closest(".note-card")
            if (noteCardElement) noteCardElement.classList.remove("dragging")
            this.clearDragIndicators()
            this.draggedNoteId = null
        }, { signal: listenersSignal })

        const noteImportInputElement = document.getElementById("note-import")
        if (noteImportInputElement) {
            noteImportInputElement.addEventListener("change", event => this.handleNoteImport(event), { signal: listenersSignal })
        }
    },

    readFolderFilterSelection() {
        const selected = []
        this.els.filterFolders?.querySelectorAll("input[type='checkbox']").forEach(input => {
            const safeInputValue = window.DomSecurity.sanitizeIdentifier(input.value)
            if (input.checked && safeInputValue) selected.push(safeInputValue)
        })
        return selected
    },

    readTagFilterSelection(rawValue = "") {
        return String(rawValue || "")
            .split(",")
            .map(value => String(value || "").trim())
            .filter(Boolean)
    },

    updateFilterConfig(next) {
        const current = StateStore.read().config.notesFilter || { sort: "manual", folders: [], tags: [], updatedWindowDays: 0 }
        const updated = window.NotesStorage?.normalizeNotesFilter
            ? window.NotesStorage.normalizeNotesFilter({ ...current, ...next })
            : { ...current, ...next }
        StateActions.updateConfig({ notesFilter: updated })
        SafeStorage.local.setJson("notes-filter", updated)
        updateSearchQuery(document.getElementById("search-input")?.value || "")
        this.renderFilterMenu()
    },

    getSavedFilterOptions() {
        return window.NotesStorage?.readSavedNotesFilters?.() || []
    },

    renderSavedFiltersMenu() {
        const savedFilterSelect = this.els.savedFilterSelect
        const deleteFilterButton = this.els.deleteFilterButton
        if (!savedFilterSelect || !deleteFilterButton) return
        const savedFilters = this.getSavedFilterOptions()
        const currentValue = String(savedFilterSelect.value || "")
        const fragment = document.createDocumentFragment()
        const emptyOption = document.createElement("option")
        emptyOption.value = ""
        emptyOption.textContent = this.getText("saved_filters_none", "No saved filter")
        fragment.append(emptyOption)
        savedFilters.forEach(savedFilter => {
            const option = document.createElement("option")
            option.value = savedFilter.id
            option.textContent = savedFilter.name
            fragment.append(option)
        })
        savedFilterSelect.replaceChildren(fragment)
        const hasCurrentValue = savedFilters.some(savedFilter => savedFilter.id === currentValue)
        savedFilterSelect.value = hasCurrentValue ? currentValue : ""
        deleteFilterButton.disabled = !savedFilterSelect.value
    },

    saveCurrentFilterPreset() {
        const currentFilter = window.NotesStorage?.normalizeNotesFilter
            ? window.NotesStorage.normalizeNotesFilter(StateStore.read().config.notesFilter || {})
            : (StateStore.read().config.notesFilter || { sort: "manual", folders: [] })
        this.showPrompt(
            this.getText("save_filter_prompt_title", "Filter name"),
            this.getText("save_filter_prompt_placeholder", "For example: Work"),
            (value) => {
                const filterName = String(value || "").trim()
                if (!filterName) return
                const savedFilters = this.getSavedFilterOptions()
                const existingFilter = savedFilters.find(item => item.name.toLocaleLowerCase() === filterName.toLocaleLowerCase())
                const nextFilter = {
                    id: existingFilter?.id || `filter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                    name: filterName,
                    sort: currentFilter.sort,
                    folders: currentFilter.folders,
                    tags: currentFilter.tags,
                    updatedWindowDays: currentFilter.updatedWindowDays,
                    createdAt: existingFilter?.createdAt || Date.now()
                }
                const nextSavedFilters = existingFilter
                    ? savedFilters.map(item => item.id === existingFilter.id ? nextFilter : item)
                    : [...savedFilters, nextFilter]
                window.NotesStorage?.writeSavedNotesFilters?.(nextSavedFilters)
                this.renderSavedFiltersMenu()
                if (this.els.savedFilterSelect) this.els.savedFilterSelect.value = nextFilter.id
                if (this.els.deleteFilterButton) this.els.deleteFilterButton.disabled = false
                this.showToast(this.getText("saved_filter_saved", "Filter saved"))
            }
        )
    },

    applySavedFilter(savedFilterId) {
        const savedFilter = this.getSavedFilterOptions().find(item => item.id === String(savedFilterId || ""))
        if (!savedFilter) {
            this.showToast(this.getText("saved_filter_missing", "Saved filter not found"))
            this.renderSavedFiltersMenu()
            return
        }
        this.updateFilterConfig({
            sort: savedFilter.sort,
            folders: savedFilter.folders,
            tags: savedFilter.tags,
            updatedWindowDays: savedFilter.updatedWindowDays
        })
        if (this.els.savedFilterSelect) this.els.savedFilterSelect.value = savedFilter.id
        if (this.els.deleteFilterButton) this.els.deleteFilterButton.disabled = false
    },

    deleteSavedFilter(savedFilterId) {
        const normalizedSavedFilterId = String(savedFilterId || "")
        const savedFilters = this.getSavedFilterOptions()
        const hasSavedFilter = savedFilters.some(item => item.id === normalizedSavedFilterId)
        if (!hasSavedFilter) {
            this.showToast(this.getText("saved_filter_missing", "Saved filter not found"))
            this.renderSavedFiltersMenu()
            return
        }
        const nextSavedFilters = savedFilters.filter(item => item.id !== normalizedSavedFilterId)
        window.NotesStorage?.writeSavedNotesFilters?.(nextSavedFilters)
        this.renderSavedFiltersMenu()
        this.showToast(this.getText("saved_filter_deleted", "Filter deleted"))
    },

    renderFilterMenu() {
        if (!this.els.filterFolders || !this.els.filterSort) return
        const { folders, config, view } = StateStore.read()
        const interfaceConfig = config.interface || {}
        const sectionSaved = document.getElementById("notes-filter-section-saved")
        const sectionTags = document.getElementById("notes-filter-section-tags")
        const sectionDate = document.getElementById("notes-filter-section-date")
        if (sectionSaved) sectionSaved.classList.toggle("hidden", interfaceConfig.showSavedFilters === false)
        if (sectionTags) sectionTags.classList.toggle("hidden", interfaceConfig.showTagFilter === false)
        if (sectionDate) sectionDate.classList.toggle("hidden", interfaceConfig.showUpdatedPeriodFilter === false)
        const current = window.NotesStorage?.normalizeNotesFilter
            ? window.NotesStorage.normalizeNotesFilter(config.notesFilter || {})
            : (config.notesFilter || { sort: "manual", folders: [], tags: [], updatedWindowDays: 0 })
        const visibleFolders = folders.filter(folder => !folder.isHidden && !folder.trashedAt)
        const visibleFolderIds = new Set(
            visibleFolders
                .map(folder => window.DomSecurity.sanitizeIdentifier(folder.id))
                .filter(Boolean)
        )
        const sanitizedFolders = Array.isArray(current.folders)
            ? current.folders.filter(folderId => folderId === "none" || visibleFolderIds.has(window.DomSecurity.sanitizeIdentifier(folderId)))
            : []
        if (sanitizedFolders.length !== (current.folders || []).length) {
            this.updateFilterConfig({ folders: sanitizedFolders })
            return
        }
        const folderFiltersBlocked = view === "archive" || view === "trash"
        const safeSortValue = window.DomSecurity.sanitizeInputValue(current.sort, "updated")
        this.els.filterSort.value = safeSortValue
        if (this.els.tagFilterInput) this.els.tagFilterInput.value = Array.isArray(current.tags) ? current.tags.join(", ") : ""
        if (this.els.dateFilterSelect) this.els.dateFilterSelect.value = String(Number(current.updatedWindowDays || 0))

        const folderFilterFragment = document.createDocumentFragment()
        const items = [{ id: "none", name: this.getText("folder_none", "No folder") }]
        visibleFolders.forEach(folder => {
            const safeFolderId = window.DomSecurity.sanitizeIdentifier(folder.id)
            if (!safeFolderId) return
            items.push({ id: safeFolderId, name: folder.name })
        })

        items.forEach(item => {
            const filterOption = document.createElement("label")
            filterOption.className = "filter-option filter-toggle-option"

            const optionInput = document.createElement("input")
            optionInput.type = "checkbox"
            optionInput.value = item.id === "none" ? "none" : window.DomSecurity.sanitizeIdentifier(item.id)
            if (!optionInput.value) return
            optionInput.checked = !folderFiltersBlocked && sanitizedFolders.includes(item.id)
            optionInput.disabled = folderFiltersBlocked

            const optionName = document.createElement("span")
            window.DomSecurity.setText(optionName, window.DomSecurity.sanitizeInputValue(item.name || ""))

            const track = document.createElement("span")
            track.className = "filter-toggle-track"
            track.setAttribute("aria-hidden", "true")

            const thumb = document.createElement("span")
            thumb.className = "filter-toggle-thumb"
            track.append(thumb)

            filterOption.append(optionInput, optionName, track)
            folderFilterFragment.append(filterOption)
        })

        this.els.filterFolders.replaceChildren(folderFilterFragment)
        this.renderSavedFiltersMenu()
    },

    toggleFilterMenu(force) {
    const menu = this.els.filterMenu
    if (!menu) return

    const next = typeof force === "boolean"
        ? force
        : !menu.classList.contains("active")

    menu.classList.toggle("active", next)
    if (!next) return

    const isMobile = !window.matchMedia("(min-width: 1024px)").matches

    if (isMobile) {
        const anchor = document.getElementById("search-input")
        if (!anchor) return

        const rect = anchor.getBoundingClientRect()

        menu.style.position = "fixed"
        menu.style.top = `${rect.bottom + 8}px`
        menu.style.left = "10px"
        menu.style.right = "10px"
        menu.style.bottom = "unset"
    } else {
        const btn = this.els.filterButton
        if (!btn) return

        const rect = btn.getBoundingClientRect()

        menu.style.position = ""
        menu.style.bottom = "unset"
        menu.style.right = "unset"
        menu.style.top = `${rect.bottom + 10}px`
        menu.style.left = `${Math.max(
            10,
            Math.min(
                window.innerWidth - menu.offsetWidth - 10,
                rect.right - menu.offsetWidth
            )
        )}px`
    }
},



    async handleAction(el, e) {
        const action = el.dataset.action
        if (!action) return

        const stopFor = new Set(["note-pin", "note-favorite", "note-menu", "rename-active-folder", "toggle-active-folder-menu", "toggle-active-folder-hidden", "delete-active-folder", "clear-trash"])
        if (stopFor.has(action)) e.stopPropagation()

        switch (action) {
            case "login":
                Auth.login()
                break
            case "login-email":
                Auth.loginWithEmail()
                break
            case "toggle-sidebar": {
                const forceAttr = el.dataset.force
                const force = typeof forceAttr === "string" ? forceAttr === "true" : undefined
                this.toggleSidebar(force)
                break
            }
            case "switch-view":
              if (el.dataset.view === "shared_workspace" && !this.isFeatureEnabled("workspaces")) {
                this.showFeatureDisabledToast("workspaces")
                break
              }
              switchView(el.dataset.view)
              if (!window.matchMedia("(min-width: 1024px)").matches) {
                this.toggleSidebar(false)
              }
              break
            case "open-folder":
              switchView("folder", el.dataset.folderId)
              if (!window.matchMedia("(min-width: 1024px)").matches) {
                this.toggleSidebar(false)
              }
              break
            case "edit-display-name": {
                const currentName = String(document.getElementById("user-name")?.textContent || "")
                this.showPrompt(this.getText("display_name", "Отображаемое имя"), this.getText("display_name_placeholder", "Введите имя"), async value => {
                    const nextName = String(value || "").trim()
                    if (!nextName || nextName.length > 50) return
                    const ok = await Auth.updateDisplayName(nextName)
                    this.showToast(ok ? this.getText("saved", "Сохранено") : this.getText("save_failed", "Save failed"))
                }, currentName, { maxLength: 50, showCounter: true })
                break
            }
            case "copy-user-uid": {
                const uid = WorkspaceAccessService?.getCurrentUserUid?.() || ""
                if (!uid) {
                    this.showToast(this.getText("share_manage_denied", "Permission denied"))
                    break
                }
                const copied = await CollaborationService.copyToClipboard(uid)
                this.showToast(copied ? this.getText("uid_copied", "UID скопирован") : uid)
                break
            }
            case "join-shared-workspace-link": {
                if (!this.isFeatureEnabled("workspaces")) {
                    this.showFeatureDisabledToast("workspaces")
                    break
                }
                this.showPrompt(this.getText("join_shared_workspace", "Присоединиться по ссылке"), this.getText("join_shared_workspace_placeholder", "Вставьте ссылку или токен"), async value => {
                    const user = StateStore.read().user
                    if (!user?.uid) return
                    const result = await WorkspaceAccessService?.acceptWorkspaceShareToken?.(value, user)
                    this.showToast(result ? this.getText("join_shared_workspace_success", "Совместная папка добавлена") : this.getText("join_shared_workspace_failed", "Не удалось добавить совместную папку"))
                })
                break
            }
            case "toggle-active-workspace-menu":
                if (!this.isFeatureEnabled("workspaces")) {
                    this.showFeatureDisabledToast("workspaces")
                    break
                }
                this.toggleActiveWorkspaceMenu()
                break
            case "view-workspace-members":
                if (!this.isFeatureEnabled("workspaces")) {
                    this.showFeatureDisabledToast("workspaces")
                    break
                }
                this.openWorkspaceMembersModal()
                this.toggleActiveWorkspaceMenu(false)
                break
            case "rename-workspace":
                if (!this.isFeatureEnabled("workspaces")) {
                    this.showFeatureDisabledToast("workspaces")
                    break
                }
                this.renameActiveWorkspace()
                this.toggleActiveWorkspaceMenu(false)
                break
            case "edit-workspace-description":
                if (!this.isFeatureEnabled("workspaces")) {
                    this.showFeatureDisabledToast("workspaces")
                    break
                }
                this.editActiveWorkspaceDescription()
                this.toggleActiveWorkspaceMenu(false)
                break
            case "open-shared-workspace":
                if (!this.isFeatureEnabled("workspaces")) {
                    this.showFeatureDisabledToast("workspaces")
                    break
                }
                switchView("shared_workspace", null, el.dataset.workspaceId)
                if (!window.matchMedia("(min-width: 1024px)").matches) {
                    this.toggleSidebar(false)
                }
                break
            case "copy-shared-workspace-link": {
                if (!this.isFeatureEnabled("workspaces")) {
                    this.showFeatureDisabledToast("workspaces")
                    break
                }
                const workspaceId = String(el.dataset.workspaceId || StateStore.read().activeSharedWorkspaceId || "")
                const link = await WorkspaceAccessService?.createInviteLink?.(workspaceId, "editor")
                if (!link) {
                    this.showToast(this.getText("share_manage_denied", "Permission denied"))
                    break
                }
                const copied = await CollaborationService.copyToClipboard(link)
                this.showToast(copied ? this.getText("share_link_copied", "Share link copied") : link)
                break
            }
            case "add-shared-workspace-user": {
                if (!this.isFeatureEnabled("workspaces")) {
                    this.showFeatureDisabledToast("workspaces")
                    break
                }
                const workspaceId = String(el.dataset.workspaceId || StateStore.read().activeSharedWorkspaceId || "")
                this.showPrompt(this.getText("shared_user_uid_prompt", "UID пользователя"), this.getText("shared_user_uid_placeholder", "Введите UID"), async value => {
                    const targetUid = String(value || "").trim()
                    if (!targetUid) return
                    const ok = await WorkspaceAccessService?.addMemberByUid?.(workspaceId, targetUid, "editor")
                    this.showToast(ok ? this.getText("shared_user_added", "Пользователь добавлен") : this.getText("share_manage_denied", "Permission denied"))
                })
                break
            }
            case "folder-unhide":
                this.setFolderHidden(el.dataset.folderId, false)
                break
            case "folder-restore":
                restoreFolderById(el.dataset.folderId)
                break
            case "folder-delete-permanent":
                deleteFolderPermanently(el.dataset.folderId)
                break
            case "toggle-active-folder-menu":
                this.toggleActiveFolderMenu()
                break
            case "toggle-active-folder-hidden":
                this.toggleFolderHidden(StateStore.read().activeFolderId)
                this.toggleActiveFolderMenu(false)
                break
            case "clear-trash":
                clearTrashPermanently()
                break
            case "delete-active-folder":
                deleteFolder(StateStore.read().activeFolderId)
                this.toggleActiveFolderMenu(false)
                break
            case "primary-action":
                this.primaryAction()
                break
            case "create-folder":
                this.createFolder()
                break
            case "rename-active-folder":
                this.renameFolder(StateStore.read().activeFolderId)
                this.toggleActiveFolderMenu(false)
                break
            case "open-modal":
                this.openModal(el.dataset.modal)
                break
            case "close-modal":
                this.closeModal(el.dataset.modal)
                break
            case "open-settings":
                this.openSettings()
                break
            case "settings-save":
                this.saveSettingsDraft()
                break
            case "settings-export-all-notes": {
                if (el.disabled) break
                el.disabled = true
                const loadingLock = this.startLoading(this.getText("loading_export", "Подготовка экспорта..."))
                try {
                    await this.exportAllNotes()
                } finally {
                    this.stopLoading(loadingLock)
                    el.disabled = false
                }
                break
            }
            case "settings-export-folder": {
                if (el.disabled) break
                this.exportFolderBySelection()
                break
            }
            case "settings-backup-all-notes": {
                if (el.disabled) break
                if (!this.isFeatureEnabled("googleDrive")) {
                    this.showFeatureDisabledToast("googleDrive")
                    break
                }
                el.disabled = true
                const loadingLock = this.startLoading(this.getText("loading_backup", "Создание резервной копии..."))
                try {
                    await this.backupAllNotesToDrive()
                } finally {
                    this.stopLoading(loadingLock)
                    el.disabled = false
                    this.renderSettingsPage()
                }
                break
            }
            case "settings-backup-folder": {
                if (el.disabled) break
                if (!this.isFeatureEnabled("googleDrive")) {
                    this.showFeatureDisabledToast("googleDrive")
                    break
                }
                this.backupFolderBySelection()
                break
            }
            case "settings-trigger-import":
                this.triggerImport()
                break
            case "settings-cancel":
                this.cancelSettingsDraft()
                break
            case "close-settings-modal":
                this.requestCloseSettingsModal()
                break
            case "trigger-admin-analysis-pending":
                this.triggerAnalysisRequest("pending", "trigger-admin-analysis-pending")
                break
            case "trigger-admin-analysis-all":
                this.triggerAnalysisRequest("reindex_body", "trigger-admin-analysis-all")
                break
            case "trigger-admin-analysis-user":
                this.triggerAnalysisRequest("reindex_body", "trigger-admin-analysis-user")
                break
            case "settings-back":
                this.backSettingsPage()
                break
            case "open-settings-page":
                this.openSettingsPage(el.dataset.page)
                break
            case "toggle-user-menu":
                this.toggleUserMenu()
                break
            case "change-avatar": {
                const input = document.getElementById("avatar-upload-input")
                if (!input) break
                input.onchange = async () => {
                    const file = input.files && input.files[0] ? input.files[0] : null
                    if (!file) return
                    const ok = await Auth.updateAvatarFromFile(file)
                    this.showToast(ok ? this.getText("saved", "Сохранено") : this.getText("save_failed", "Save failed"))
                    input.value = ""
                }
                input.click()
                break
            }
            case "switch-account":
                this.confirm("account", () => Auth.switchAccount())
                break
            case "logout":
                this.confirm("exit", () => {
                    const settingsModalElement = document.getElementById("settings-modal")
                    if (settingsModalElement?.classList.contains("active")) {
                        this.closeModal("settings-modal")
                    }
                    Auth.logout()
                })
                break
            case "trigger-import":
                this.triggerImport()
                break
            case "load-more-notes": {
                e.preventDefault()
                const loadMoreState = PaginationService.getLoadMoreState()
                if (!loadMoreState.hasMoreItems || loadMoreState.isLoading) break
                PaginationService.loadMoreVisibleNotes()
                if (PaginationService.shouldLoadMoreOwnedFromServer()) {
                    OwnedNotesService.loadMore()
                }
                break
            }
            case "toggle-folder-description": {
                e.preventDefault()
                const folderCard = el.closest(".folder-card")
                const descriptionElement = folderCard?.querySelector(".folder-description-preview")
                if (!descriptionElement) break
                const expanded = descriptionElement.classList.toggle("expanded")
                el.setAttribute("aria-expanded", String(expanded))
                window.DomSecurity.setText(el, expanded ? this.getText("show_less", "Свернуть") : this.getText("show_more", "Ещё"))
                break
            }
            case "editor-undo":
                window.SmartNotesEditor?.undo()
                break
            case "editor-redo":
                window.SmartNotesEditor?.redo()
                break
            case "editor-delete":
                window.SmartNotesEditor?.deleteCurrent()
                break
            case "editor-save":
                window.SmartNotesEditor?.save()
                break
            case "editor-prev-page":
                window.SmartNotesEditor?.prevPage()
                break
            case "editor-next-page":
                window.SmartNotesEditor?.nextPage()
                break
            case "editor-add-page":
                window.SmartNotesEditor?.addPage()
                break
            case "editor-calc":
                window.SmartNotesEditor?.confirmEquation()
                break
            case "close-editor":
                window.SmartNotesEditor?.close()
                break
            case "toggle-toolbar":
                window.SmartNotesEditor?.toggleToolbar()
                break
            case "editor-note-actions": {
                e.preventDefault()
                e.stopPropagation()
                const noteId = StateStore.read().currentNote?.id
                if (noteId) this.openNoteActionsFlow(noteId)
                break
            }
            case "open-feedback-modal":
                if ((el.dataset.modal === "rate-modal" && !this.isFeatureEnabled("feedback")) || (el.dataset.modal === "poll-modal" && !this.isFeatureEnabled("poll"))) {
                    this.showFeatureDisabledToast(el.dataset.modal === "poll-modal" ? "poll" : "feedback")
                    break
                }
                this.closeModal("feedback-menu-modal")
                this.openModal(el.dataset.modal)
                break
            case "note-pin":
                togglePin(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-favorite":
                toggleFavorite(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-menu":
                e.preventDefault()
                e.stopPropagation()
                this.openNoteActionsFlow(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "lock-note-menu":
                e.preventDefault()
                e.stopPropagation()
                this.openNoteActionsFlow(decodeURIComponent(el.dataset.noteId || ""), { allowLocked: true })
                break
            case "note-pin-toggle":
                this.toggleSelectedPin(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-archive":
                this.toggleSelectedArchive(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-lock-toggle":
                this.toggleSelectedLock(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-delete":
                deleteNoteById(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-copy-text":
                copyNoteTextById(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-reminder-set":
                scheduleReminder(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-reminder-clear":
                clearReminder(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-restore":
                restoreNoteById(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-move-folder":
                this.moveSelectedNoteToFolder(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "note-mark-for-reanalysis":
                this.markNoteForReanalysis(decodeURIComponent(el.dataset.noteId || ""))
                break
            case "download-note":
                this.downloadSelectedNote()
                break
            case "export-note-txt":
                this.exportSelectedNoteAsText()
                break
            case "export-note-pdf":
                this.exportSelectedNoteAsPdf()
                break
            case "lock-pin":
                this.toggleLockPin(el.dataset.noteId || "")
                break
            case "lock-archive":
                this.toggleLockArchive(el.dataset.noteId || "")
                break
            case "lock-unhide":
                this.unlockLockedNote(el.dataset.noteId || "")
                break
            case "lock-remove":
                this.removeLockPermanently(el.dataset.noteId || "")
                break
            case "lock-move-folder":
                this.moveLockNoteToFolder(el.dataset.noteId || "")
                break
            case "appearance-reset":
                this.resetAppearanceDraft()
                break
            case "appearance-save":
                this.saveAppearanceDraft()
                break
            case "appearance-cancel":
                this.cancelAppearanceDraft()
                break
            case "toggle-filter-menu":
                this.toggleFilterMenu()
                break
            case "submit-feedback":
                if (!this.isFeatureEnabled("feedback")) {
                    this.showFeatureDisabledToast("feedback")
                    break
                }
                this.submitFeedback()
                break
            case "media-reset":
                window.SmartNotesEditor?.resetMediaTransform()
                break
            case "media-align":
                window.SmartNotesEditor?.alignMediaOrText(el.dataset.align)
                break
            case "media-delete":
                window.SmartNotesEditor?.deleteSelectedMedia()
                break
            case "editor-align":
                window.SmartNotesEditor?.alignMediaOrText(el.dataset.align)
                break
            case "survey-next":
                this.advanceSurvey()
                break
            case "survey-prev":
                this.goBackSurvey()
                break
            case "survey-continue":
                this.continueSurvey()
                break
            case "survey-finish":
                this.finishSurvey()
                break
            case "photo-undo":
                PhotoEditor.undo()
                break
            case "photo-clear":
                PhotoEditor.clear()
                break
            case "photo-save":
                PhotoEditor.save()
                break
            default:
                break
        }
    }
});

(() => {
    const DRIVE_LAST_MANUAL_BACKUP_AT_KEY = "drive-last-manual-backup-at"

    const buildExportFileName = (note, extension) => {
        const baseName = NoteIO.fileNameFor(note).replace(/\.json$/i, "")
        return `${baseName}.${extension}`
    }

    const buildNoteTextExport = (note) => {
        const contentWrapper = document.createElement("div")
        contentWrapper.innerHTML = Utils.sanitizeHtml(note.content || "")
        contentWrapper.querySelectorAll("img, figure, picture, svg, canvas").forEach(element => element.remove())
        const contentText = Utils.stripHtml(contentWrapper.innerHTML).replace(/\r\n/g, "\n").trim()
        const titleText = (note.title || NoteText.buildAutoTitle(note)).trim()
        const parts = []
        if (titleText) parts.push(titleText)
        if (contentText) parts.push(contentText)
        return parts.join("\n\n")
    }

    const buildSafeExportPagesHtml = (note) => {
        const safeContentHtml = Utils.sanitizeHtml(note.content || "")
        const contentWrapper = document.createElement("div")
        contentWrapper.innerHTML = safeContentHtml
        const pages = Array.from(contentWrapper.querySelectorAll(".note-page"))
        const pageDrawings = Array.isArray(note.pageDrawings) ? note.pageDrawings : []
        const sourcePages = pages.length ? pages : [contentWrapper]
        const exportRoot = document.createElement("div")
        sourcePages.forEach((page, index) => {
            const pageElement = document.createElement("div")
            pageElement.className = "note-page"
            const pageHtml = page.innerHTML || ""
            pageElement.innerHTML = Utils.sanitizeHtml(pageHtml)
            const drawingSource = pageDrawings[index]
            if (typeof drawingSource === "string" && drawingSource.trim()) {
                const drawingElement = document.createElement("img")
                drawingElement.className = "note-drawing"
                drawingElement.alt = ""
                drawingElement.src = drawingSource
                pageElement.appendChild(drawingElement)
            }
            exportRoot.appendChild(pageElement)
        })
        return Utils.sanitizeHtml(exportRoot.innerHTML)
    }

    const buildPrintableNoteHtml = (note, dict) => {
        const titleText = (note.title || NoteText.buildAutoTitle(note)).trim()
        const formattedDate = Utils.formatDate(note.updatedAt || note.createdAt || Date.now())
        return {
            language: StateStore.read().config.lang || "ru",
            printableTitle: titleText || dict.untitled_note || "Untitled",
            printableDate: formattedDate,
            printableContentHtml: buildSafeExportPagesHtml(note),
            printableStyles: `
        :root { color-scheme: light dark; }
        body { margin: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f1f1f; background: #ffffff; }
        h1 { font-size: 24px; margin: 0 0 6px; }
        .note-date { font-size: 12px; color: #6f6f6f; margin-bottom: 18px; }
        .note-content { font-size: 14px; line-height: 1.6; }
        .note-page { position: relative; padding: 18px; border: 1px solid #e6e6e6; border-radius: 12px; margin-bottom: 18px; min-height: 240px; }
        .note-page:last-child { margin-bottom: 0; }
        .note-drawing { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
        .note-content img { max-width: 100%; height: auto; }
        .note-content ul, .note-content ol { padding-left: 22px; }
        .note-content p { margin: 0 0 10px; }
        @media print {
            body { margin: 20mm; }
            .note-page { break-inside: avoid; }
        }
    `
        }
    }

    const openPrintWindow = (printableDocument, dict) => {
        const printWindow = window.open("", "_blank")
        if (!printWindow || !printWindow.document) {
            UI.showToast(dict.popup_blocked || "Allow popups to print")
            return
        }
        const printableHtml = `<!doctype html><html lang="${Utils.escapeHtml(printableDocument.language)}"><head><meta charset="utf-8"><title>${Utils.escapeHtml(printableDocument.printableTitle)}</title><style>${printableDocument.printableStyles}</style></head><body><header><h1>${Utils.escapeHtml(printableDocument.printableTitle)}</h1><div class="note-date">${Utils.escapeHtml(printableDocument.printableDate)}</div></header><main class="note-content">${printableDocument.printableContentHtml}</main></body></html>`
        printWindow.document.open()
        printWindow.document.write(printableHtml)
        printWindow.document.close()
        const runPrint = () => {
            printWindow.focus()
            printWindow.print()
        }
        if (printWindow.document.readyState === "complete") {
            runPrint()
            return
        }
        printWindow.addEventListener("load", runPrint, { once: true })
    }

    window.UINoteActionsExport = {
        DRIVE_LAST_MANUAL_BACKUP_AT_KEY,
        buildExportFileName,
        buildNoteTextExport,
        buildPrintableNoteHtml,
        openPrintWindow
    }
})();

(() => {
window.UINoteActionsPanel = {

    renderNoteActions(noteId) {
        const note = this.resolveNoteById(noteId)
        const root = document.getElementById("note-actions-content")
        if (!note || !root) return
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const folders = StateStore.read().folders
        const isArchived = !!note.isArchived
        const archiveLabel = isArchived ? (dict.restore_note || "Restore") : (dict.archive_note || "Archive")
        const folderOptions = [`<option value="">${dict.folder_none || "No folder"}</option>`]
        folders.forEach(f => {
            const selected = note.folderId === f.id ? "selected" : ""
            folderOptions.push(`<option value="${f.id}" ${selected}>${Utils.escapeHtml(f.name)}</option>`)
        })
        const reminderStamp = note.reminderAt?.toDate ? note.reminderAt.toDate() : (note.reminderAt ? new Date(note.reminderAt) : null)
        const reminderValue = reminderStamp ? new Date(reminderStamp.getTime() - reminderStamp.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""
        const reminderClearButton = reminderValue
            ? `<button type="button" class="btn-secondary" data-action="note-reminder-clear" data-note-id="${encodeURIComponent(note.id)}">
                    ${dict.reminder_clear || "Clear"}
                </button>`
            : ""
        root.innerHTML = `
            <div class="modal-actions-grid">
                <button type="button" class="btn-secondary" data-action="note-archive" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">inventory_2</i>${archiveLabel}
                </button>
                <button type="button" class="btn-secondary" data-action="note-lock-toggle" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">lock</i>${note.lock?.hash ? (dict.unlock_note || "Unlock") : (dict.lock_note || "Lock")}
                </button>
                <button type="button" class="btn-secondary" data-action="note-copy-text" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">content_copy</i>${dict.copy_text || "Copy text"}
                </button>
                <button type="button" class="btn-secondary" data-action="note-mark-for-reanalysis" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">psychology</i>${dict.note_mark_for_reanalysis || "Отметить для повторного анализа"}
                </button>
                <button type="button" class="btn-danger" data-action="note-delete" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">delete</i>${note.trashedAt ? (dict.delete_permanently || "Delete permanently") : (dict.delete_note || "Delete")}
                </button>
                ${note.trashedAt ? `<button type="button" class="btn-secondary" data-action="note-restore" data-note-id="${encodeURIComponent(note.id)}">${dict.restore_note || "Restore"}</button>` : ""}
            </div>
            <div class="lock-center-folder" style="margin-top:12px;">
                <select class="input-area lock-center-select note-actions-select" data-note-id="${encodeURIComponent(note.id)}" aria-label="${dict.folder_view_aria || "Folder"}">
                    ${folderOptions.join("")}
                </select>
                <button type="button" class="btn-primary" data-action="note-move-folder" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">drive_file_move</i>${dict.move_to_folder || "Move"}
                </button>
            </div>
            <div class="lock-center-folder" style="margin-top:12px;">
                <input type="datetime-local" class="input-area note-reminder-input" data-note-id="${encodeURIComponent(note.id)}" value="${reminderValue}" aria-label="${dict.reminder_note || "Reminder"}">
                <button type="button" class="btn-primary" data-action="note-reminder-set" data-note-id="${encodeURIComponent(note.id)}">
                    <i class="material-icons-round" aria-hidden="true">notifications</i>${dict.reminder_note || "Reminder"}
                </button>
                ${reminderClearButton}
            </div>
            <div class="modal-actions-grid" style="margin-top:12px;">
                <button type="button" class="btn-primary" data-action="download-note" data-lang="download_note">
                    <i class="material-icons-round" aria-hidden="true">download</i>${dict.download_note || "Download"}
                </button>
                <button type="button" class="btn-secondary" data-action="export-note-txt" data-lang="export_txt">
                    <i class="material-icons-round" aria-hidden="true">description</i>${dict.export_txt || "Export TXT"}
                </button>
                <button type="button" class="btn-secondary" data-action="export-note-pdf" data-lang="export_pdf">
                    <i class="material-icons-round" aria-hidden="true">picture_as_pdf</i>${dict.export_pdf || "Export PDF"}
                </button>
            </div>
        `
        this.applyInputAutocompletePolicy(root)
    },


    async toggleSelectedLock(noteId) {
        if (!noteId) return
        const note = this.resolveNoteById(noteId)
        if (!note) return
        if (note.lock?.hash) {
            const password = await this.showPasswordPrompt(this.getText("lock_title", "Lock"), this.getText("lock_password", "Password"))
            if (password == null) return
            const verified = await LockService.verify(note, password)
            if (!verified) {
                this.showToast(this.getText("lock_invalid_password", "Invalid password"))
                return
            }
            const previousNotes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
            const nextNotes = previousNotes.map(item => item.id === note.id ? NoteIO.normalizeNote({ ...item, lock: null }) : item)
            StateActions.setNotes(nextNotes)
            try {
                const savedNote = await window.NoteActionService.patch(note.id, { lock: null })
                if (savedNote) {
                    StateActions.setNotes((Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []).map(item => item.id === note.id ? NoteIO.normalizeNote(savedNote) : item))
                }
                this.showToast(this.getText("unlock_success", "Note unlocked"))
                this.closeModal("note-actions-modal")
            } catch (error) {
                StateActions.setNotes(previousNotes)
                this.showToast(this.getText("unlock_failed", "Unable to unlock note"))
                console.error("Unlock failed", error)
            }
            return
        }
        const password = await this.showPasswordPrompt(this.getText("lock_title", "Lock"), this.getText("lock_password", "Password"))
        if (password == null) return
        const normalizedPassword = String(password || "").trim()
        if (!normalizedPassword) {
            this.showToast(this.getText("lock_password_empty", "Password is empty"))
            return
        }
        const lockedNote = await LockService.setLock({ ...note }, normalizedPassword)
        const previousNotes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
        const nextNotes = previousNotes.map(item => item.id === note.id ? NoteIO.normalizeNote({ ...item, lock: lockedNote.lock || null }) : item)
        StateActions.setNotes(nextNotes)
        try {
            const savedNote = await window.NoteActionService.patch(note.id, { lock: lockedNote.lock || null })
            if (savedNote) {
                StateActions.setNotes((Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []).map(item => item.id === note.id ? NoteIO.normalizeNote(savedNote) : item))
            }
            this.showToast(this.getText("lock_hidden", "Note hidden"))
            this.closeModal("note-actions-modal")
        } catch (error) {
            StateActions.setNotes(previousNotes)
            this.showToast(this.getText("lock_failed", "Unable to lock note"))
            console.error("Lock failed", error)
        }
    },
    async toggleSelectedPin(noteId) {
        if (!noteId) return
        await togglePin(noteId)
        this.closeModal("note-actions-modal")
    },

    async toggleSelectedArchive(noteId) {
        if (!noteId) return
        const note = this.resolveNoteById(noteId)
        if (!note) return
        await toggleArchive(noteId, !note.isArchived)
        this.closeModal("note-actions-modal")
    },

    async moveSelectedNoteToFolder(noteId) {
        if (!noteId) return
        const select = document.querySelector(`.note-actions-select[data-note-id="${encodeURIComponent(noteId)}"]`)
        if (!select) return
        const folderId = select.value || null
        await moveNoteToFolder(noteId, folderId)
        this.closeModal("note-actions-modal")
    },

    downloadSelectedNote() {
        const note = this.resolveNoteById(this.currentNoteActionId)
        if (!note) return
        if (note.lock?.hash) {
            this.showToast(this.getText("lock_download_blocked", "Note is locked"))
            return
        }
        const data = NoteIO.exportNote(note)
        const blob = new Blob([data], { type: "application/json" })
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = NoteIO.fileNameFor(note)
        a.click()
        URL.revokeObjectURL(a.href)
        this.showToast(this.getText("download_success", "File saved"))
        this.closeModal("note-actions-modal")
    },

    exportSelectedNoteAsText() {
        const note = this.resolveNoteById(this.currentNoteActionId)
        if (!note) return
        if (note.lock?.hash) {
            this.showToast(this.getText("lock_download_blocked", "Note is locked"))
            return
        }
        const exportApi = window.UINoteActionsExport
        if (!exportApi || typeof exportApi.buildNoteTextExport !== "function" || typeof exportApi.buildExportFileName !== "function") return
        const text = exportApi.buildNoteTextExport(note)
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = exportApi.buildExportFileName(note, "txt")
        link.click()
        URL.revokeObjectURL(link.href)
        this.showToast(this.getText("download_success", "File saved"))
        this.closeModal("note-actions-modal")
    },

    exportSelectedNoteAsPdf() {
        const note = this.resolveNoteById(this.currentNoteActionId)
        if (!note) return
        if (note.lock?.hash) {
            this.showToast(this.getText("lock_download_blocked", "Note is locked"))
            return
        }
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const exportApi = window.UINoteActionsExport
        if (!exportApi || typeof exportApi.buildPrintableNoteHtml !== "function" || typeof exportApi.openPrintWindow !== "function") return
        const printableDocument = exportApi.buildPrintableNoteHtml(note, dict)
        exportApi.openPrintWindow(printableDocument, dict)
        this.closeModal("note-actions-modal")
    },
}
})();

const DRIVE_LAST_MANUAL_BACKUP_AT_KEY = "drive-last-manual-backup-at";

;(() => {
const noteActionsPanel = window.UINoteActionsPanel
if (noteActionsPanel && typeof noteActionsPanel === "object") Object.assign(UI, noteActionsPanel);

Object.assign(UI, {
    updateSidebarLayout() {
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches
        const isActive = this.els.sidebar?.classList.contains("active")
        if (this.els.sidebar) {
            this.els.sidebar.classList.toggle("collapsed", isDesktop && !isActive)
        }
        if (this.els.sidebarOverlay) {
            this.els.sidebarOverlay.classList.toggle("active", !!isActive && !isDesktop)
        }
    },

    toggleSidebar(force) {
        if (!this.els.sidebar) return
        const next = typeof force === "boolean" ? force : !this.els.sidebar.classList.contains("active")
        this.els.sidebar.classList.toggle("active", next)
        this.updateSidebarLayout()
    },

    toggleUserMenu(force) {
        if (!this.els.userMenu) return
        this.els.userMenu.classList.toggle("active", typeof force === "boolean" ? force : !this.els.userMenu.classList.contains("active"))
    },

    triggerImport() {
        const input = document.getElementById("note-import")
        if (!input) return
        input.value = ""
        input.click()
    },

    resolveExternalMediaMessage(error, options = {}) {
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const descriptor = mediaService?.resolveUserFacingError?.(error, options) || (options.attachmentOnly ? { messageKey: "external_attachment_unavailable", fallbackMessage: "Disk is not connected, attachment unavailable" } : { messageKey: "external_storage_unlinked", fallbackMessage: "External storage is not connected" })
        return this.getText(descriptor.messageKey, descriptor.fallbackMessage)
    },

    normalizeImportedDate(inputValue, fallbackValue = Date.now()) {
        const toIsoString = (value) => {
            if (value instanceof Date) {
                return Number.isFinite(value.getTime()) ? value.toISOString() : null
            }
            if (typeof value?.toDate === "function") {
                const convertedDate = value.toDate()
                return convertedDate instanceof Date && Number.isFinite(convertedDate.getTime())
                    ? convertedDate.toISOString()
                    : null
            }
            if (value && typeof value === "object") {
                const seconds = Number.isFinite(value.seconds) ? value.seconds : value._seconds
                const nanoseconds = Number.isFinite(value.nanoseconds) ? value.nanoseconds : value._nanoseconds
                if (Number.isFinite(seconds)) {
                    const convertedDate = new Date((seconds * 1000) + (Number.isFinite(nanoseconds) ? nanoseconds / 1000000 : 0))
                    return Number.isFinite(convertedDate.getTime()) ? convertedDate.toISOString() : null
                }
            }
            if (typeof value === "number" && Number.isFinite(value)) {
                const timestamp = Math.abs(value) < 1000000000000 ? value * 1000 : value
                const convertedDate = new Date(timestamp)
                return Number.isFinite(convertedDate.getTime()) ? convertedDate.toISOString() : null
            }
            if (typeof value === "string") {
                const convertedDate = new Date(value)
                return Number.isFinite(convertedDate.getTime()) ? convertedDate.toISOString() : null
            }
            return null
        }

        const normalizedValue = toIsoString(inputValue)
        if (normalizedValue) return normalizedValue
        if (fallbackValue == null) return null
        return toIsoString(fallbackValue)
    },

    normalizeImportedTags(rawTags) {
        if (!Array.isArray(rawTags)) return []
        const uniqueTags = []
        const seenTags = new Set()
        for (const rawTag of rawTags) {
            const normalizedTag = String(rawTag || "").trim()
            if (!normalizedTag) continue
            const lowerTag = normalizedTag.toLowerCase()
            if (seenTags.has(lowerTag)) continue
            seenTags.add(lowerTag)
            uniqueTags.push(normalizedTag)
            if (uniqueTags.length >= 50) break
        }
        return uniqueTags
    },

    buildImportedNote(rawNote, ownerUid) {
        const normalizedNote = NoteIO.normalizeNote({
            ...(rawNote && typeof rawNote === "object" ? rawNote : {}),
            id: Utils.generateId(),
            ownerUid: String(ownerUid || ""),
            folderId: null,
            trashedAt: null,
            access: null,
            hiddenTags: []
        })
        const importedAt = Date.now()
        const createdAt = this.normalizeImportedDate(normalizedNote.createdAt, importedAt)
        const updatedAt = this.normalizeImportedDate(normalizedNote.updatedAt, createdAt || importedAt)
        return {
            ...normalizedNote,
            tags: this.normalizeImportedTags(normalizedNote.tags),
            pageTitles: Array.isArray(normalizedNote.pageTitles) ? normalizedNote.pageTitles : [],
            pageDrawings: Array.isArray(normalizedNote.pageDrawings) ? normalizedNote.pageDrawings : [],
            pageDrawingsRevision: String(normalizedNote.pageDrawingsRevision || ""),
            createdAt,
            updatedAt,
            ownerUid: String(ownerUid || ""),
            access: {
                ownerUid: String(ownerUid || ""),
                roles: String(ownerUid || "") ? { [String(ownerUid || "")]: "owner" } : {},
                noteId: "",
                shareId: "",
                ownerCollection: ""
            },
            analyzed: false,
            aiProcessed: false,
            aiFolder: "",
            aiTags: [],
            aiRelevance: 0,
            aiVersion: 0,
            aiLastAnalyzed: null,
            hiddenTags: [],
            relevance: 0,
            folderId: null,
            trashedAt: null,
            reminderAt: this.normalizeImportedDate(normalizedNote.reminderAt, null),
            order: Date.now()
        }
    },

    async saveImportedNotes(user, importedNotes) {
        const notes = Array.isArray(importedNotes) ? importedNotes : []
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const hasInlineMedia = mediaService
            ? notes.some(note => mediaService.getInlineMediaSummary?.(note)?.hasInlineMedia)
            : notes.some(note => /data:(image|audio)\//i.test(String(note?.content || "")) || (Array.isArray(note?.pageDrawings) && note.pageDrawings.some(item => /data:(image|audio)\//i.test(String(item || "")))))
        if (hasInlineMedia) {
            throw new Error(mediaService ? "external-inline-media-blocked" : "external-storage-unlinked")
        }
        const chunkSize = 450
        for (let index = 0; index < notes.length; index += chunkSize) {
            const batch = db.batch()
            notes.slice(index, index + chunkSize).forEach(importedNote => {
                const reference = DataPath.getUserNotesCollection(user).doc(importedNote.id)
                batch.set(reference, importedNote, { merge: true })
            })
            await batch.commit()
        }
    },

    async saveImportedFolders(user, importedFolders) {
        const folders = Array.isArray(importedFolders) ? importedFolders : []
        if (!folders.length) return new Map()
        const existingFolders = StateStore.read().folders.filter(folder => !folder.trashedAt)
        const existingByName = new Map(existingFolders.map(folder => [String(folder.name || "").trim().toLowerCase(), folder]))
        const folderIdMap = new Map()
        const foldersToCreate = []

        folders.forEach((importedFolder, index) => {
            if (!importedFolder) return
            const normalizedName = String(importedFolder.name || "").trim().toLowerCase()
            if (!normalizedName) return
            const existingFolder = existingByName.get(normalizedName)
            if (existingFolder) {
                folderIdMap.set(String(importedFolder.sourceId || importedFolder.id || ""), existingFolder.id)
                return
            }
            const nextFolder = {
                ...importedFolder,
                id: importedFolder.id || Utils.generateId(),
                folderOrder: Date.now() + index
            }
            folderIdMap.set(String(importedFolder.sourceId || importedFolder.id || ""), nextFolder.id)
            foldersToCreate.push(nextFolder)
            existingByName.set(normalizedName, nextFolder)
        })

        if (!foldersToCreate.length) return folderIdMap

        const batch = db.batch()
        foldersToCreate.forEach(folder => {
            const reference = DataPath.getUserFoldersCollection(user).doc(folder.id)
            const { sourceId, ...folderPayload } = folder
            batch.set(reference, folderPayload, { merge: true })
        })
        await batch.commit()
        return folderIdMap
    },

    async handleNoteImport(e) {
        if (!db || !StateStore.read().user) return
        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null
        if (!file) return
        if (!String(file.type).includes("json") && !String(file.name).toLowerCase().endsWith(".json")) {
            this.showToast(this.getText("import_invalid", "Unsupported file"))
            return
        }
        const reader = new FileReader()
        reader.onload = async () => {
            const loadingLock = this.startLoading(this.getText("loading_import", "Импорт данных..."))
            try {
                const text = String(reader.result || "").replace(/^﻿/, "")
                const parsed = JSON.parse(text)
                const importBundle = NoteIO.parseImportBundle(parsed)
                if (!importBundle.notes.length) {
                    this.showToast(this.getText("import_empty", "No notes found"))
                    return
                }
                const current = StateStore.read()
                const importedNotes = Array.isArray(importBundle.notes) ? importBundle.notes : []
                const notesToImport = importedNotes.map(note => this.buildImportedNote(note, current.user.uid))
                await this.saveImportedNotes(current.user, notesToImport)
                this.showToast(this.getText("import_success", "Imported"))
            } catch (error) {
                console.error("Import failed", error)
                const errorCode = String(error?.message || error?.code || "")
                if (errorCode.includes("external-") || errorCode.includes("drive-")) {
                    this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
                    return
                }
                this.showToast(this.getText("import_failed", "Import failed"))
            } finally {
                this.stopLoading(loadingLock)
            }
        }
        reader.onerror = () => this.showToast(this.getText("import_failed", "Import failed"))
        reader.readAsText(file, "utf-8")
    },

    getExportableNotes(filterFn = null) {
        const notes = Array.isArray(StateStore.read().notes) ? StateStore.read().notes : []
        return notes.filter(note => {
            if (!note || note.trashedAt) return false
            return typeof filterFn === "function" ? filterFn(note) : true
        })
    },

    getVisibleExportableNotes() {
        const stateSnapshot = StateStore.read()
        const query = document.getElementById("search-input")?.value || stateSnapshot.searchQuery || ""
        const visible = NotesQueryService.execute(stateSnapshot, query).notes || []
        return visible.filter(note => !!note && !note.trashedAt)
    },

    getExportFoldersForNotes(notes, options = {}) {
        if (Array.isArray(options.folders)) return options.folders
        const stateFolders = Array.isArray(StateStore.read().folders) ? StateStore.read().folders : []
        const folderIds = new Set((Array.isArray(notes) ? notes : []).map(note => String(note?.folderId || "")).filter(Boolean))
        if (options.folder && typeof options.folder === "object") {
            folderIds.add(String(options.folder.id || ""))
        }
        return stateFolders.filter(folder => folderIds.has(String(folder.id || "")))
    },

    async prepareExportNotes(notes) {
        const exportableNotes = Array.isArray(notes) ? notes : []
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        if (!mediaService) {
            if (exportableNotes.some(note => /data:(image|audio)\//i.test(String(note?.content || "")) || (Array.isArray(note?.pageDrawings) && note.pageDrawings.some(item => /data:(image|audio)\//i.test(String(item || "")))))) {
                throw new Error("external-storage-unlinked")
            }
            return exportableNotes
        }
        return Promise.all(exportableNotes.map(async note => {
            const prepared = await mediaService.externalizeNoteMedia(note, {
                fileNameBase: window.NoteExportService?.sanitizeExportFileName?.(note?.title || note?.id || "note_export", "note_export") || "note_export"
            })
            const normalizedNote = NoteIO.normalizeNote(prepared.note)
            if (mediaService.getInlineMediaSummary?.(normalizedNote)?.hasInlineMedia) {
                throw new Error("drive-upload-failed:export-inline-media")
            }
            return normalizedNote
        }))
    },

    async exportNotesBundle(notes, options = {}) {
        const loadingLock = this.startLoading(this.getText("loading_export", "Подготовка экспорта..."))
        try {
            const exportableNotes = Array.isArray(notes) ? notes : []
            if (!exportableNotes.length) {
                const emptyKey = options.emptyMessageKey || "export_empty"
                const fallbackMessage = options.emptyFallback || "No notes available for export"
                this.showToast(this.getText(emptyKey, fallbackMessage))
                return null
            }
            const preparedNotes = await this.prepareExportNotes(exportableNotes)
            const payload = window.NoteExportService.buildExportPayload({
                notes: preparedNotes,
                folders: this.getExportFoldersForNotes(preparedNotes, options),
                scope: options.scope || "all",
                folder: options.folder || null
            })
            const fileName = window.NoteExportService.downloadExportPayload(payload, {
                scope: options.scope || "all",
                folderName: options.folder?.name || ""
            })
            this.showToast(this.getText("download_success", "File saved"))
            return fileName
        } finally {
            this.stopLoading(loadingLock)
        }
    },

    async backupNotesBundleToDrive(notes, options = {}) {
        const loadingLock = this.startLoading(this.getText("loading_backup", "Создание резервной копии..."))
        try {
            const exportableNotes = Array.isArray(notes) ? notes : []
            if (!exportableNotes.length) {
                const emptyKey = options.emptyMessageKey || "export_empty"
                const fallbackMessage = options.emptyFallback || "No notes available for export"
                this.showToast(this.getText(emptyKey, fallbackMessage))
                return null
            }
            const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
            if (!mediaService?.uploadFile) {
                this.showToast(this.getText("backup_connected_drive_required", "Connect external storage to create a backup"))
                return null
            }
            const preparedNotes = await this.prepareExportNotes(exportableNotes)
            const payload = window.NoteExportService.buildExportPayload({
                notes: preparedNotes,
                folders: this.getExportFoldersForNotes(preparedNotes, options),
                scope: options.scope || "all",
                folder: options.folder || null
            })
            const fileName = window.NoteExportService.buildExportFileName({
                scope: options.scope || "all",
                folderName: options.folder?.name || ""
            })
            const blob = window.NoteExportService.createExportBlob(payload)
            const publicUrl = await mediaService.uploadFile(blob, {
                fileName,
                mimeType: "application/json",
                targetFolder: "backups"
            })
            const completedAt = new Date().toISOString()
            SafeStorage.local.set(DRIVE_LAST_MANUAL_BACKUP_AT_KEY, completedAt)
            this.showToast(this.getText("backup_success", "Backup saved to external storage"))
            return { fileName, publicUrl, completedAt }
        } finally {
            this.stopLoading(loadingLock)
        }
    },

    async exportAllNotes() {
        try {
            return await this.exportNotesBundle(this.getExportableNotes(), {
                scope: "all",
                emptyMessageKey: "export_empty",
                emptyFallback: "No notes available for export"
            })
        } catch (error) {
            console.error("Export failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    async exportVisibleNotes() {
        try {
            return await this.exportNotesBundle(this.getVisibleExportableNotes(), {
                scope: "selection",
                emptyMessageKey: "export_visible_empty",
                emptyFallback: "No notes found for the current filters"
            })
        } catch (error) {
            console.error("Export failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    getExportableFoldersList() {
        const folders = Array.isArray(StateStore.read().folders) ? StateStore.read().folders : []
        return folders.filter(folder => !folder?.trashedAt)
    },

    getLastDriveBackupAt() {
        const rawValue = SafeStorage.local.get(DRIVE_LAST_MANUAL_BACKUP_AT_KEY)
        if (!rawValue) return null
        const date = new Date(rawValue)
        return Number.isFinite(date.getTime()) ? date : null
    },

    getLastDriveBackupLabel() {
        const date = this.getLastDriveBackupAt()
        if (!date) return this.getText("backup_last_manual_none", "Пока не выполнялось")
        return date.toLocaleString(StateStore.read().config.lang === "en" ? "en-US" : "ru-RU")
    },

    resolveFolderByName(folderName) {
        const normalizedName = String(folderName || "").trim().toLocaleLowerCase()
        if (!normalizedName) return null
        return this.getExportableFoldersList().find(folder => String(folder.name || "").trim().toLocaleLowerCase() === normalizedName) || null
    },

    selectFolderForExport(callback) {
        const folders = this.getExportableFoldersList()
        if (!folders.length) {
            this.showToast(this.getText("folder_not_found", "Folder not found"))
            return
        }
        this.showPrompt(
            this.getText("export_folder_prompt_title", "Выберите папку для экспорта/резервной копии"),
            this.getText("export_folder_prompt_placeholder", "Введите точное название папки"),
            (value) => {
                const folder = this.resolveFolderByName(value)
                if (!folder) {
                    this.showToast(this.getText("export_folder_not_found", "Папка не найдена"))
                    return
                }
                callback(folder)
            }
        )
    },

    async backupAllNotesToDrive() {
        if (!this.isFeatureEnabled("googleDrive")) {
            this.showFeatureDisabledToast("googleDrive")
            return null
        }
        try {
            return await this.backupNotesBundleToDrive(this.getExportableNotes(), {
                scope: "all",
                emptyMessageKey: "export_empty",
                emptyFallback: "No notes available for export"
            })
        } catch (error) {
            console.error("Backup failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    async exportActiveFolderNotes(folderId = null) {
        const { activeFolderId, folders } = StateStore.read()
        const targetFolderId = folderId || activeFolderId
        if (!targetFolderId) return null
        const folder = folders.find(item => item.id === targetFolderId)
        try {
            return await this.exportNotesBundle(this.getExportableNotes(note => note.folderId === targetFolderId), {
                scope: "folder",
                folder,
                folders: folder ? [folder] : [],
                emptyMessageKey: "export_folder_empty",
                emptyFallback: "This folder has no notes to export"
            })
        } catch (error) {
            console.error("Export failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    async backupActiveFolderToDrive(folderId = null) {
        if (!this.isFeatureEnabled("googleDrive")) {
            this.showFeatureDisabledToast("googleDrive")
            return null
        }
        const { activeFolderId, folders } = StateStore.read()
        const targetFolderId = folderId || activeFolderId
        if (!targetFolderId) return null
        const folder = folders.find(item => item.id === targetFolderId)
        try {
            return await this.backupNotesBundleToDrive(this.getExportableNotes(note => note.folderId === targetFolderId), {
                scope: "folder",
                folder,
                folders: folder ? [folder] : [],
                emptyMessageKey: "export_folder_empty",
                emptyFallback: "This folder has no notes to export"
            })
        } catch (error) {
            console.error("Backup failed", error)
            this.showToast(this.resolveExternalMediaMessage(error, { attachmentOnly: true }))
            return null
        }
    },

    exportFolderBySelection() {
        this.selectFolderForExport(folder => {
            this.exportActiveFolderNotes(folder.id)
        })
    },

    backupFolderBySelection() {
        this.selectFolderForExport(folder => {
            this.backupActiveFolderToDrive(folder.id)
        })
    },

    openNoteActionsFlow(noteId, options = {}) {
        const normalizedNoteId = String(noteId || "")
        if (!normalizedNoteId) return false
        const opener = typeof window.openNoteActions === "function" ? window.openNoteActions : null
        if (!opener) return false
        opener(normalizedNoteId, options)
        const modalElement = document.getElementById("note-actions-modal")
        const contentElement = document.getElementById("note-actions-content")
        const isVisible = !!modalElement && modalElement.classList.contains("active") && !modalElement.classList.contains("hidden") && document.body.contains(modalElement)
        const hasContent = !!contentElement && String(contentElement.innerHTML || "").trim().length > 0
        const opened = isVisible && hasContent
        if (!opened && options.showError !== false) {
            this.showToast(this.getText("note_actions_unavailable", "Unable to open note actions"))
        }
        return opened
    },

    canShowPrimaryAction(view = StateStore.read().view) {
        const normalizedView = String(view || "notes")
        if (normalizedView === "shared_workspace" && !this.isFeatureEnabled("workspaces")) {
            return false
        }
        return new Set(["notes", "folder", "folders", "shared_workspace"]).has(normalizedView)
    },

    primaryAction() {
        const currentView = StateStore.read().view
        if (!this.canShowPrimaryAction(currentView)) return
        if (currentView === "folders") {
            this.createFolder()
            return
        }
        if (currentView === "shared_workspace") {
            if (!this.isFeatureEnabled("workspaces")) {
                this.showFeatureDisabledToast("workspaces")
                return
            }
            const workspace = WorkspaceAccessService?.getWorkspaceById?.(StateStore.read().activeSharedWorkspaceId)
            if (!workspace || !WorkspaceAccessService?.canEditWorkspace?.(workspace)) {
                this.showToast(this.getText("share_manage_denied", "Permission denied"))
                return
            }
        }
        window.SmartNotesEditor?.open()
    },


    createSharedWorkspace() {
        if (!this.isFeatureEnabled("workspaces")) {
            this.showFeatureDisabledToast("workspaces")
            return
        }
        this.showPrompt(this.getText("shared_workspace_create", "Новая совместная папка"), this.getText("shared_workspace_placeholder", "Название папки"), async (name, description) => {
            const normalizedName = String(name || "").trim()
            const normalizedDescription = String(description || "").trim()
            if (!normalizedName) {
                this.showToast(this.getText("folder_empty", "Введите название папки"))
                return
            }
            if (normalizedName.length > 50 || normalizedDescription.length > 300) {
                this.showToast(this.getText("shared_workspace_limits_error", "Проверьте длину названия и описания"))
                return
            }
            const workspace = await WorkspaceAccessService?.createWorkspace?.(normalizedName, normalizedDescription)
            if (!workspace) {
                this.showToast(this.getText("save_failed", "Save failed"))
                return
            }
            this.showToast(this.getText("shared_workspace_created", "Совместная папка создана"))
        }, "", {
            maxLength: 50,
            showCounter: true,
            secondaryField: {
                value: "",
                placeholder: this.getText("shared_workspace_description_placeholder", "Описание папки"),
                ariaLabel: this.getText("shared_workspace_description", "Описание"),
                showCounter: true,
                softLimit: 300,
                maxLength: 300
            }
        })
    },

    updateFolderLimitControls() {
        const createFolderButton = document.querySelector('[data-action="create-folder"]')
        if (!createFolderButton) return
        const canCreateFolder = window.Validators.canAddFolder(StateStore.read().folders.length)
        createFolderButton.disabled = !canCreateFolder
        createFolderButton.classList.toggle("is-disabled", !canCreateFolder)
    },

    createFolder() {
        if (!window.Validators.canAddFolder(StateStore.read().folders.length)) {
            return this.showToast(window.AppMessages.getAppMessage(this, window.AppMessages.APP_MESSAGES.folderLimitReached))
        }
        this.showPrompt(this.getText("new_folder", "New folder"), this.getText("folder_placeholder", "Folder name"), async (name, description) => {
            const validatedName = window.Validators.validateFolderName(name)
            const validatedDescription = window.Validators.validateFolderDescription(description)
            if (!String(name || "").trim()) return this.showToast(this.getText("folder_empty", "Enter a folder name"))
            if (!validatedName) return this.showToast(window.AppMessages.getAppMessage(this, window.AppMessages.APP_MESSAGES.folderNameTooLong))
            if (validatedDescription == null) return this.showToast(this.getText("folder_description_too_long", "Folder description must be up to 300 characters"))
            if (StateStore.read().folders.some(f => f.name && f.name.toLowerCase() === validatedName.toLowerCase())) {
                return this.showToast(this.getText("folder_exists", "Folder already exists"))
            }
            if (!db || !StateStore.read().user) return
            const createdFolder = await DataPath.getUserFoldersCollection(StateStore.read().user).add({
                name: validatedName,
                description: validatedDescription,
                isHidden: false,
                trashedAt: null,
                folderOrder: Date.now(),
                createdAt: new Date().toISOString(),
                ownerUid: StateStore.read().user.uid
            })
            if (createdFolder?.id) {
                StateStore.update("folders", [...StateStore.read().folders, createdFolder])
                this.renderFolders()
                this.updateViewTitle()
            }
        }, "", {
            maxLength: 50,
            showCounter: true,
            secondaryField: {
                value: "",
                placeholder: this.getText("folder_description_placeholder", "Describe what notes should go to this folder"),
                ariaLabel: this.getText("folder_description_label", "Folder description"),
                showCounter: true,
                softLimit: window.Validators.FOLDER_DESCRIPTION_SOFT_LIMIT,
                maxLength: window.Validators.FOLDER_DESCRIPTION_HARD_LIMIT
            }
        })
    },

    renameFolder(folderId) {
        const id = String(folderId || "")
        if (!id) return
        const folder = StateStore.read().folders.find(f => f.id === id)
        if (!folder) return
        this.showPrompt(this.getText("rename_folder", "Rename folder"), this.getText("folder_placeholder", "Folder name"), async (name, description) => {
            const validatedName = window.Validators.validateFolderName(name)
            const validatedDescription = window.Validators.validateFolderDescription(description)
            if (!String(name || "").trim()) return this.showToast(this.getText("folder_empty", "Enter a folder name"))
            if (!validatedName) return this.showToast(window.AppMessages.getAppMessage(this, window.AppMessages.APP_MESSAGES.folderNameTooLong))
            if (validatedDescription == null) return this.showToast(this.getText("folder_description_too_long", "Folder description must be up to 300 characters"))
            const sameName = validatedName.toLowerCase() === String(folder.name || "").toLowerCase()
            const sameDescription = validatedDescription === String(folder.description || "").trim()
            if (sameName && sameDescription) return
            if (StateStore.read().folders.some(f => f.id !== id && f.name && f.name.toLowerCase() === validatedName.toLowerCase())) {
                return this.showToast(this.getText("folder_exists", "Folder already exists"))
            }
            if (!db || !StateStore.read().user) return
            await DataPath.getUserFoldersCollection(StateStore.read().user).doc(id).update({
                name: validatedName,
                description: validatedDescription
            })
            StateStore.update("folders", StateStore.read().folders.map(item => item.id === id ? { ...item, name: validatedName, description: validatedDescription } : item))
            this.renderFolders()
            this.updateViewTitle()
        }, String(folder.name || ""), {
            maxLength: 50,
            showCounter: true,
            secondaryField: {
                value: String(folder.description || ""),
                placeholder: this.getText("folder_description_placeholder", "Describe what notes should go to this folder"),
                ariaLabel: this.getText("folder_description_label", "Folder description"),
                showCounter: true,
                softLimit: window.Validators.FOLDER_DESCRIPTION_SOFT_LIMIT,
                maxLength: window.Validators.FOLDER_DESCRIPTION_HARD_LIMIT
            }
        })
    },

    applyAppearanceSettings() {
        const currentSettings = StateStore.read().originalUserSettings || StateStore.read().draftUserSettings || null
        if (currentSettings) {
            SettingsSyncService.applyUserSettingsToRuntime(currentSettings, { resetVisibleLimit: false, persistTheme: false })
        } else {
            ThemeManager.revertToLastSaved()
        }
        this.renderFolders()
        this.syncSettingsUI()
    },

    updateViewTitle() {
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const titles = {
            notes: dict.view_notes || "Notes",
            favorites: dict.view_favorites || "Favorites",
            archive: dict.view_archive || "Archive",
            reminders: dict.view_reminders || "Reminders",
            trash: dict.trash || "Trash",
            folder: dict.view_folder || "Folder",
            folders: dict.view_folders || "Folders",
            locked: dict.view_locked || dict.lock_center || "Note Protection",
            hidden_folders: dict.hidden_folders || "Hidden folders",
            admin_tools: dict.admin_tools || "Admin tools",
            shared_workspace: dict.shared_workspace || "Совместная папка"
        }
        const { view, activeFolderId, activeSharedWorkspaceId, folders, sharedWorkspaces } = StateStore.read()
        let title = titles[view] || "SmartNotes"
        if (view === "folder" && activeFolderId) {
            const folder = folders.find(f => f.id === activeFolderId)
            if (folder) title = folder.name
        }
        if (view === "shared_workspace" && activeSharedWorkspaceId) {
            const workspace = (sharedWorkspaces || []).find(item => item.id === activeSharedWorkspaceId)
            if (workspace) title = workspace.name
        }
        const el = document.getElementById("current-view-title")
        if (el) el.textContent = title
        this.updateActiveFolderMenu()
        this.updateActiveWorkspaceMenu()
        this.updateTrashActionVisibility()
        this.updateFolderLimitControls()
        this.updateAdminToolsNavigationVisibility()
    },

    getTrashSummary() {
        const state = StateStore.read()
        const trashedNotes = Array.isArray(state.notes) ? state.notes.filter(note => !!note?.trashedAt) : []
        const trashedFolders = Array.isArray(state.folders) ? state.folders.filter(folder => !!folder?.trashedAt) : []
        return {
            notes: trashedNotes,
            folders: trashedFolders,
            totalCount: trashedNotes.length + trashedFolders.length
        }
    },

    updateTrashActionVisibility() {
        const clearTrashButton = this.els.clearTrashButton
        if (!clearTrashButton) return
        const isTrashView = StateStore.read().view === "trash"
        const trashSummary = this.getTrashSummary()
        clearTrashButton.classList.toggle("hidden", !isTrashView)
        clearTrashButton.disabled = trashSummary.totalCount === 0
        clearTrashButton.title = this.getText("clear_trash", "Clear trash")
        clearTrashButton.setAttribute("aria-label", this.getText("clear_trash", "Clear trash"))
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return
        const view = StateStore.read().view
        const label = view === "folders"
            ? this.getText("create_folder", "Create folder")
            : this.getText("create_note", "Create note")
        this.els.fab.setAttribute("aria-label", label)
        this.els.fab.classList.toggle("hidden", !this.canShowPrimaryAction(view))
        this.updateActiveFolderMenu()
        this.updateActiveWorkspaceMenu()
        this.updateFolderLimitControls()
        this.updateAdminToolsNavigationVisibility()
    },

    handleMobileBackNavigation() {
        const editorOverlay = document.getElementById("note-editor")
        if (editorOverlay?.classList.contains("active")) {
            window.SmartNotesEditor?.close?.()
            return true
        }
        const activeModal = Array.from(document.querySelectorAll(".modal-overlay.active")).pop()
        if (activeModal) {
            if (activeModal.id === "settings-modal") {
                this.requestCloseSettingsModal()
            } else {
                this.closeModal(activeModal.id)
            }
            return true
        }
        if (this.els.sidebar?.classList.contains("active")) {
            this.toggleSidebar(false)
            return true
        }
        const currentView = StateStore.read().view
        if (currentView === "shared_workspace") {
            switchView("notes")
            return true
        }
        if (currentView !== "notes") {
            switchView("notes")
            return true
        }
        return false
    },

    updateNotesLoadMoreButton(loadMoreState) {
        const loadMoreButton = document.getElementById("load-more-notes-button")
        if (!loadMoreButton) return
        const state = loadMoreState || { hasMoreItems: false, isLoading: false }
        loadMoreButton.disabled = !!state.isLoading
        loadMoreButton.classList.toggle("hidden", !state.hasMoreItems)
    },


    async setFolderHidden(folderId, hiddenState) {
        const user = StateStore.read().user
        if (!db || !user || !folderId) return
        await DataPath.getUserFoldersCollection(user).doc(folderId).update({ isHidden: !!hiddenState })
        StateStore.update("folders", StateStore.read().folders.map(folder => folder.id === folderId ? { ...folder, isHidden: !!hiddenState } : folder))
        this.renderFolders()
        this.updateViewTitle()
    },

    async toggleFolderHidden(folderId, options = {}) {
        const folder = StateStore.read().folders.find(item => item.id === folderId)
        if (!folder) return
        const nextHiddenState = !folder.isHidden
        if (nextHiddenState && !options.skipConfirmation) {
            this.confirm("hide_f", () => this.setFolderHidden(folderId, true))
            return
        }
        await this.setFolderHidden(folderId, nextHiddenState)
    },

    async reorderFolders(draggedFolderId, targetFolderId) {
        const user = StateStore.read().user
        if (!db || !user || !draggedFolderId || !targetFolderId || draggedFolderId === targetFolderId) return
        const folders = StateStore.read().folders.filter(folder => !folder.trashedAt).sort((a, b) => (a.folderOrder || 0) - (b.folderOrder || 0))
        const fromIndex = folders.findIndex(folder => folder.id === draggedFolderId)
        const toIndex = folders.findIndex(folder => folder.id === targetFolderId)
        if (fromIndex < 0 || toIndex < 0) return
        const reordered = folders.slice()
        const [dragged] = reordered.splice(fromIndex, 1)
        reordered.splice(toIndex, 0, dragged)
        const batch = db.batch()
        reordered.forEach((folder, index) => {
            const ref = DataPath.getUserFoldersCollection(user).doc(folder.id)
            batch.update(ref, { folderOrder: index + 1 })
        })
        await batch.commit()
        const nextOrderMap = new Map(reordered.map((folder, index) => [folder.id, index + 1]))
        StateStore.update("folders", StateStore.read().folders.map(folder => nextOrderMap.has(folder.id) ? { ...folder, folderOrder: nextOrderMap.get(folder.id) } : folder))
        this.renderFolders()
    },

    toggleActiveWorkspaceMenu(force) {
        const menu = this.els.activeWorkspaceMenu
        if (!menu) return
        menu.classList.toggle("active", typeof force === "boolean" ? force : !menu.classList.contains("active"))
    },


    async openWorkspaceMembersModal() {
        const workspace = WorkspaceAccessService?.getWorkspaceById?.(StateStore.read().activeSharedWorkspaceId)
        if (!workspace) return
        const root = document.getElementById("workspace-members-content")
        const saveButton = document.getElementById("workspace-members-save-button")
        if (!root) return
        if (saveButton) {
            saveButton.onclick = null
            saveButton.disabled = true
        }
        const currentUserUid = String(StateStore.read().user?.uid || "")
        const canManage = WorkspaceAccessService?.canManageWorkspace?.(workspace)
        const members = (WorkspaceAccessService?.getWorkspaceMembers?.(workspace.id) || [])
            .filter(member => member.uid && member.uid !== currentUserUid)
        if (!members.length) {
            const empty = document.createElement("div")
            empty.className = "folder-meta"
            window.DomSecurity.setText(empty, this.getText("shared_members_no_other", "Кроме вас участников нет"))
            root.replaceChildren(empty)
            if (saveButton) saveButton.classList.add("hidden")
            this.openModal("workspace-members-modal")
            return
        }
        if (saveButton) saveButton.classList.remove("hidden")
        const pendingRoles = new Map()
        const pendingRemove = new Set()
        const updateSaveButtonState = () => {
            if (!saveButton) return
            saveButton.disabled = !(pendingRoles.size || pendingRemove.size)
        }
        const fragment = document.createDocumentFragment()
        members.forEach(member => {
            const row = document.createElement("div")
            row.className = "shared-member-row"

            const nameLabel = document.createElement("div")
            nameLabel.className = "shared-member-name"
            window.DomSecurity.setText(nameLabel, member.displayName || member.uid)

            const roleGroup = document.createElement("div")
            roleGroup.className = "shared-member-field"
            const roleLabel = document.createElement("div")
            roleLabel.className = "shared-member-field-label"
            window.DomSecurity.setText(roleLabel, this.getText("workspace_access_level", "Права"))
            const roleSelect = document.createElement("select")
            roleSelect.className = "input-area"
            const options = [
                { value: "viewer", label: this.getText("role_viewer", "Читатель") },
                { value: "editor", label: this.getText("role_editor", "Редактор") },
                { value: "owner", label: this.getText("role_owner", "Полный доступ") }
            ]
            options.forEach(optionData => {
                const option = document.createElement("option")
                option.value = optionData.value
                option.textContent = optionData.label
                roleSelect.append(option)
            })
            roleSelect.value = member.role
            roleSelect.disabled = !canManage
            roleSelect.onchange = () => {
                if (roleSelect.value === member.role) {
                    pendingRoles.delete(member.uid)
                } else {
                    pendingRoles.set(member.uid, roleSelect.value)
                }
                updateSaveButtonState()
            }
            roleGroup.append(roleLabel, roleSelect)

            const removeButton = document.createElement("button")
            removeButton.type = "button"
            removeButton.className = "btn-danger"
            window.DomSecurity.setText(removeButton, this.getText("remove_member", "Удалить"))
            removeButton.disabled = !canManage
            removeButton.onclick = () => {
                pendingRemove.add(member.uid)
                pendingRoles.delete(member.uid)
                row.classList.add("hidden")
                updateSaveButtonState()
            }

            row.append(nameLabel, roleGroup, removeButton)
            fragment.append(row)
        })
        root.replaceChildren(fragment)
        if (saveButton) {
            saveButton.onclick = async () => {
                const operations = []
                pendingRoles.forEach((role, memberUid) => {
                    operations.push(WorkspaceAccessService.updateMemberRole(workspace.id, memberUid, role))
                })
                pendingRemove.forEach(memberUid => {
                    operations.push(WorkspaceAccessService.removeMember(workspace.id, memberUid))
                })
                if (!operations.length) return
                saveButton.disabled = true
                const result = await Promise.all(operations)
                const ok = result.every(Boolean)
                this.showToast(ok ? this.getText("saved", "Сохранено") : this.getText("save_failed", "Не удалось сохранить"))
                if (ok) {
                    this.closeModal("workspace-members-modal")
                }
            }
            updateSaveButtonState()
        }
        this.openModal("workspace-members-modal")
    },

        renameActiveWorkspace() {
        const workspace = WorkspaceAccessService?.getWorkspaceById?.(StateStore.read().activeSharedWorkspaceId)
        if (!workspace || !WorkspaceAccessService?.canManageWorkspace?.(workspace)) return
        this.showPrompt(this.getText("rename_workspace", "Переименовать папку"), this.getText("shared_workspace_placeholder", "Название папки"), async name => {
            const normalizedName = String(name || "").trim()
            if (!normalizedName || normalizedName.length > 50) return
            const ok = await WorkspaceAccessService.updateWorkspace(workspace.id, { name: normalizedName })
            this.showToast(ok ? this.getText("saved", "Сохранено") : this.getText("save_failed", "Save failed"))
        }, String(workspace.name || ""), { maxLength: 50, showCounter: true })
    },

    editActiveWorkspaceDescription() {
        const workspace = WorkspaceAccessService?.getWorkspaceById?.(StateStore.read().activeSharedWorkspaceId)
        if (!workspace || !WorkspaceAccessService?.canManageWorkspace?.(workspace)) return
        this.showPrompt(this.getText("edit_workspace_description", "Изменить описание"), this.getText("shared_workspace_description_placeholder", "Описание папки"), async value => {
            const normalized = String(value || "").trim()
            if (normalized.length > 300) return
            const ok = await WorkspaceAccessService.updateWorkspace(workspace.id, { description: normalized })
            this.showToast(ok ? this.getText("saved", "Сохранено") : this.getText("save_failed", "Save failed"))
        }, String(workspace.description || ""), { maxLength: 300, showCounter: true })
    },

    toggleActiveFolderMenu(force) {
        const menu = this.els.activeFolderMenu
        if (!menu) return
        menu.classList.toggle("active", typeof force === "boolean" ? force : !menu.classList.contains("active"))
    },


    isStandaloneAppMode() {
        const displayModeStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches
        return !!(displayModeStandalone || window.navigator.standalone)
    },

    isIosBrowserInstallAvailable() {
        return document.body.classList.contains("platform-ios") && !this.isStandaloneAppMode()
    },

    getAnalysisApiEndpoint() {
        const config = window.SmartNotesBackendConfig
        if (config && typeof config.createApiEndpoint === "function") {
            return config.createApiEndpoint("analyze")
        }
        return "/api/analyze"
    },

    async requestAnalysis({ secretToken = "", requestVariant = "pending", targetUid = "" } = {}) {
        const requestHeaders = {
            "Content-Type": "application/json"
        }
        if (secretToken) {
            requestHeaders["x-secret"] = secretToken
        }

        let endpoint = this.getAnalysisApiEndpoint()
        let requestBody = {}
        const normalizedTargetUid = String(targetUid || "").trim()

        if (requestVariant === "reindex_query") {
            endpoint = `${endpoint}?reindexAll=true`
            requestBody = null
        } else if (requestVariant === "reindex_body") {
            requestBody = { reindexAll: true }
        } else if (requestVariant === "reindex_force") {
            requestBody = { forceReindex: true }
        }

        if (normalizedTargetUid) {
            requestBody = { ...(requestBody || {}), uid: normalizedTargetUid, reindexAll: true }
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: requestHeaders,
            body: requestBody === null ? null : JSON.stringify(requestBody)
        })
        if (!response.ok) {
            throw new Error(`Analysis request failed with status ${response.status}`)
        }
        const responseData = await response.json().catch(() => ({}))
        return responseData
    },

    hasSmartNotesFolderAccess() {
        const currentUserUid = String(StateStore.read().user?.uid || "")
        if (!currentUserUid) return false
        return StateStore.read().folders.some(folder => String(folder.name || "").trim().toLowerCase() === "smartnotes")
    },

    updateAdminToolsNavigationVisibility() {
        const adminToolsButton = this.els.adminToolsNavButton
        if (!adminToolsButton) return
        const canShowAdminTools = this.hasSmartNotesFolderAccess() && !!StateStore.read().user?.uid
        adminToolsButton.classList.toggle("hidden", !canShowAdminTools)
        if (!canShowAdminTools && StateStore.read().view === "admin_tools") {
            switchView("notes")
        }
    },

    resetContentGridLayout(root = this.els.grid) {
        if (!root) return
        root.style.display = ""
        root.style.gridTemplateColumns = ""
        root.style.gap = ""
    },

    renderAdminToolsView() {
        const root = this.els.grid
        if (!root) return
        this.els.empty.classList.add("hidden")
        this.els.grid.classList.remove("folder-grid")
        root.style.display = "grid"
        root.style.gridTemplateColumns = "1fr"
        root.style.gap = "14px"

        const headerCard = document.createElement("div")
        headerCard.className = "note-card"

        const title = document.createElement("h3")
        window.DomSecurity.setText(title, this.getText("ai_functions", "ИИ функции"))

        const description = document.createElement("p")
        window.DomSecurity.setText(description, this.getText("analysis_admin_description", "Запуск серверного анализа заметок"))

        const helper = document.createElement("p")
        helper.style.marginTop = "6px"
        helper.style.opacity = "0.78"
        helper.style.fontSize = "14px"
        helper.style.lineHeight = "1.5"
        window.DomSecurity.setText(helper, this.getText("analysis_admin_helper", "Запуск выполняется на сервере. Для старта потребуется admin secret."))
        headerCard.append(title, description, helper)

        const actions = [
            {
                key: "pending",
                className: "btn-primary",
                action: "trigger-admin-analysis-pending",
                labelKey: "analysis_pending_reindex_button",
                fallback: "Проиндексировать непроиндексированные",
                descriptionKey: "analysis_pending_reindex_description",
                descriptionFallback: "Запускает анализ только для заметок, которые еще не отмечены как обработанные."
            },
            {
                key: "all",
                className: "btn-secondary",
                action: "trigger-admin-analysis-all",
                labelKey: "analysis_full_reindex_button",
                fallback: "Проиндексировать ВСЕ заметки",
                descriptionKey: "analysis_full_reindex_description",
                descriptionFallback: "Повторно прогоняет анализ по всем заметкам, включая уже проиндексированные."
            }
        ]

        const buttonsContainer = document.createElement("div")
        buttonsContainer.style.display = "grid"
        buttonsContainer.style.gridTemplateColumns = "repeat(auto-fit, minmax(260px, 1fr))"
        buttonsContainer.style.gap = "12px"

        actions.forEach(actionConfig => {
            const actionPanel = document.createElement("div")
            actionPanel.className = "note-card"
            actionPanel.style.padding = "14px"
            actionPanel.style.display = "grid"
            actionPanel.style.gap = "10px"

            const actionHeading = document.createElement("div")
            actionHeading.style.fontWeight = "700"
            actionHeading.style.fontSize = "15px"
            window.DomSecurity.setText(actionHeading, this.getText(actionConfig.labelKey, actionConfig.fallback))

            const actionDescription = document.createElement("p")
            actionDescription.style.margin = "0"
            actionDescription.style.opacity = "0.82"
            actionDescription.style.fontSize = "14px"
            actionDescription.style.lineHeight = "1.5"
            window.DomSecurity.setText(actionDescription, this.getText(actionConfig.descriptionKey, actionConfig.descriptionFallback))

            const actionButton = document.createElement("button")
            actionButton.type = "button"
            actionButton.className = actionConfig.className
            actionButton.dataset.action = actionConfig.action
            actionButton.dataset.analysisVariant = actionConfig.key
            window.DomSecurity.setText(actionButton, this.getText(actionConfig.labelKey, actionConfig.fallback))
            actionPanel.append(actionHeading, actionDescription, actionButton)
            buttonsContainer.append(actionPanel)
        })

        const userActionPanel = document.createElement("div")
        userActionPanel.className = "note-card"
        userActionPanel.style.padding = "14px"
        userActionPanel.style.display = "grid"
        userActionPanel.style.gap = "10px"

        const userActionHeading = document.createElement("div")
        userActionHeading.style.fontWeight = "700"
        userActionHeading.style.fontSize = "15px"
        window.DomSecurity.setText(userActionHeading, this.getText("analysis_user_reindex_button", "Проиндексировать заметки пользователя"))

        const userActionDescription = document.createElement("p")
        userActionDescription.style.margin = "0"
        userActionDescription.style.opacity = "0.82"
        userActionDescription.style.fontSize = "14px"
        userActionDescription.style.lineHeight = "1.5"
        window.DomSecurity.setText(userActionDescription, this.getText("analysis_user_reindex_description", "Повторно запускает анализ для всех заметок конкретного пользователя по его UID."))

        const userActionField = document.createElement("input")
        userActionField.type = "text"
        userActionField.id = "admin-analysis-target-uid"
        userActionField.className = "input-area"
        userActionField.placeholder = this.getText("analysis_user_uid_placeholder", "Введите UID пользователя")
        userActionField.autocomplete = "off"
        userActionField.spellcheck = false

        const userActionButton = document.createElement("button")
        userActionButton.type = "button"
        userActionButton.className = "btn-secondary"
        userActionButton.dataset.action = "trigger-admin-analysis-user"
        window.DomSecurity.setText(userActionButton, this.getText("analysis_user_reindex_button", "Проиндексировать заметки пользователя"))

        userActionPanel.append(userActionHeading, userActionDescription, userActionField, userActionButton)
        buttonsContainer.append(userActionPanel)

        const statusCard = document.createElement("div")
        statusCard.className = "note-card"
        statusCard.style.marginTop = "14px"
        statusCard.style.padding = "14px"
        statusCard.style.display = "grid"
        statusCard.style.gap = "8px"

        const statusTitle = document.createElement("div")
        statusTitle.style.fontWeight = "700"
        window.DomSecurity.setText(statusTitle, this.getText("analysis_status_title", "Последний запуск"))

        const statusText = document.createElement("p")
        statusText.id = "admin-analysis-status-text"
        statusText.style.margin = "0"
        statusText.style.opacity = "0.86"
        statusText.style.fontSize = "14px"
        statusText.style.lineHeight = "1.55"
        statusText.style.maxHeight = "none"
        statusText.style.overflow = "visible"
        window.DomSecurity.setText(statusText, this.getAdminAnalysisStatusText())

        statusCard.append(statusTitle, statusText)

        root.replaceChildren(headerCard, buttonsContainer, statusCard)
    },

    getAdminAnalysisStatusText() {
        const status = StateStore.read().adminAnalysisStatus || {}
        if (!status.updatedAt) {
            return this.getText("analysis_status_empty", "Запусков пока не было.")
        }

        if (status.status === "running") {
            return status.message || this.getText("analysis_status_running", "Запуск выполняется...")
        }

        const parts = []
        if (status.message) parts.push(status.message)
        if (Number.isFinite(Number(status.processed))) parts.push(`${this.getText("analysis_result_processed", "Обработано заметок")}: ${Number(status.processed)}`)
        if (Number.isFinite(Number(status.processedUsers))) parts.push(`${this.getText("analysis_result_users", "Пользователей")}: ${Number(status.processedUsers)}`)
        if (status.provider) parts.push(`${this.getText("analysis_result_provider", "Провайдер")}: ${status.provider}`)
        if (status.uid) parts.push(`${this.getText("analysis_result_uid", "UID")}: ${status.uid}`)
        return parts.filter(Boolean).join(". ") || this.getText("analysis_status_empty", "Запусков пока не было.")
    },

    updateAdminAnalysisStatus(statusPatch = {}) {
        const currentStatus = StateStore.read().adminAnalysisStatus || {}
        const nextStatus = {
            ...currentStatus,
            ...statusPatch,
            updatedAt: Date.now()
        }
        StateStore.update("adminAnalysisStatus", nextStatus)
        const statusText = document.getElementById("admin-analysis-status-text")
        if (statusText) {
            window.DomSecurity.setText(statusText, this.getAdminAnalysisStatusText())
        }
    },

    formatAnalysisResultMessage(responseData = {}) {
        const provider = String(responseData?.provider || "")
        const processed = Number(responseData?.processed)
        const processedUsers = Number(responseData?.processedUsers)
        const uid = String(responseData?.uid || "")
        const processedLabel = Number.isFinite(processed)
            ? this.getText("analysis_result_processed", "Обработано заметок") + `: ${processed}`
            : ""
        const usersLabel = Number.isFinite(processedUsers)
            ? this.getText("analysis_result_users", "Пользователей") + `: ${processedUsers}`
            : ""
        const providerLabel = provider
            ? this.getText("analysis_result_provider", "Провайдер") + `: ${provider}`
            : ""
        const uidLabel = uid
            ? this.getText("analysis_result_uid", "UID") + `: ${uid}`
            : ""

        return [processedLabel, usersLabel, providerLabel, uidLabel].filter(Boolean).join(". ")
    },

    async markNoteForReanalysis(noteId = "") {
        const user = StateStore.read().user
        const normalizedNoteId = String(noteId || "")
        if (!db || !user?.uid || !normalizedNoteId) {
            this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
            return
        }
        try {
            const noteReference = DataPath.getUserNotesCollection(user)?.doc(normalizedNoteId)
            if (!noteReference) {
                this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
                return
            }
            await noteReference.update({
                analyzed: false,
                aiProcessed: false,
                tags: [],
                hiddenTags: [],
                relevance: null,
                folderId: null
            })
            this.showToast(this.getText("analysis_marked_for_reanalysis", "Заметка отмечена для повторного анализа"))
            this.closeModal("note-actions-modal")
        } catch {
            this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
        }
    },
    async triggerAnalysisRequest(analysisVariant = "pending", actionName = "") {
        const secretToken = window.prompt(this.getText("analysis_admin_secret_prompt", "Введите admin secret"), "")
        if (!secretToken) return
        const normalizedActionName = String(actionName || "")
        const triggerButton = normalizedActionName ? document.querySelector(`[data-action="${normalizedActionName}"]`) : null
        const targetUidInput = document.getElementById("admin-analysis-target-uid")
        const targetUid = normalizedActionName === "trigger-admin-analysis-user" ? String(targetUidInput?.value || "").trim() : ""
        if (normalizedActionName === "trigger-admin-analysis-user" && !targetUid) {
            this.showToast(this.getText("analysis_user_uid_required", "Введите UID пользователя"))
            return
        }
        const initialLabel = triggerButton ? triggerButton.textContent : ""
        if (triggerButton) {
            triggerButton.disabled = true
            triggerButton.setAttribute("aria-busy", "true")
            window.DomSecurity.setText(triggerButton, this.getText("loading", "Loading..."))
        }
        this.updateAdminAnalysisStatus({
            status: "running",
            message: this.getText("analysis_status_running", "Запуск выполняется..."),
            processed: null,
            provider: "",
            uid: targetUid,
            processedUsers: null
        })
        try {
            const responseData = await this.requestAnalysis({ secretToken, requestVariant: analysisVariant, targetUid })
            const summary = this.formatAnalysisResultMessage(responseData)
            const successMessage = this.getText("analysis_request_sent", "Запрос отправлен. Анализ выполнится на стороне сервера")
            this.updateAdminAnalysisStatus({
                status: "success",
                message: successMessage,
                processed: responseData?.processed,
                provider: responseData?.provider || "",
                uid: responseData?.uid || targetUid,
                processedUsers: responseData?.processedUsers
            })
            this.showToast(summary ? `${successMessage} ${summary}` : successMessage)
        } catch {
            this.updateAdminAnalysisStatus({
                status: "error",
                message: this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"),
                processed: null,
                provider: "",
                uid: targetUid,
                processedUsers: null
            })
            this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
        } finally {
            if (triggerButton) {
                triggerButton.disabled = false
                triggerButton.setAttribute("aria-busy", "false")
                window.DomSecurity.setText(triggerButton, initialLabel || this.getText("analysis_pending_reindex_button", "Проиндексировать непроиндексированные"))
            }
        }
    },


    updateActiveWorkspaceMenu() {
        const wrapper = this.els.activeWorkspaceMenuWrapper
        if (!wrapper) return
        const state = StateStore.read()
        const isVisible = this.isFeatureEnabled("workspaces") && state.view === "shared_workspace" && !!state.activeSharedWorkspaceId
        wrapper.classList.toggle("hidden", !isVisible)
        if (!isVisible) {
            this.toggleActiveWorkspaceMenu(false)
            return
        }
        const workspace = WorkspaceAccessService?.getWorkspaceById?.(state.activeSharedWorkspaceId)
        const canManage = !!workspace && WorkspaceAccessService?.canManageWorkspace?.(workspace)
        if (this.els.workspaceCopyLinkButton) this.els.workspaceCopyLinkButton.classList.toggle("hidden", !canManage)
        if (this.els.workspaceAddUserButton) this.els.workspaceAddUserButton.classList.toggle("hidden", !canManage)
        if (this.els.workspaceRenameButton) this.els.workspaceRenameButton.classList.toggle("hidden", !canManage)
        if (this.els.workspaceEditDescriptionButton) this.els.workspaceEditDescriptionButton.classList.toggle("hidden", !canManage)
    },

    updateActiveFolderMenu() {
        const wrapper = this.els.activeFolderMenuWrapper
        const hideLabel = this.els.activeFolderHideButton?.querySelector("span")
        const hideIcon = this.els.activeFolderHideButton?.querySelector("i")
        if (!wrapper) return
        const { view, activeFolderId, activeSharedWorkspaceId, folders, sharedWorkspaces } = StateStore.read()
        const isVisible = view === "folder" && !!activeFolderId
        wrapper.classList.toggle("hidden", !isVisible)
        if (!isVisible) {
            this.toggleActiveFolderMenu(false)
            return
        }
        const folder = folders.find(item => item.id === activeFolderId)
        if (!folder) return
        if (hideLabel) hideLabel.textContent = folder.isHidden ? this.getText("show_folder", "Show folder") : this.getText("hide_folder", "Hide folder")
        if (hideIcon) hideIcon.textContent = folder.isHidden ? "visibility" : "visibility_off"
    }
});

})();

Object.assign(UI, {
    getNextModalLayerBase() {
        const activeModals = Array.from(document.querySelectorAll(".modal-overlay.active"))
        const currentMax = activeModals.reduce((max, modalElement) => {
            const inlineZ = Number(modalElement.style.zIndex || 0)
            const computedZ = Number(window.getComputedStyle(modalElement).zIndex || 0)
            const value = Number.isFinite(inlineZ) && inlineZ > 0 ? inlineZ : computedZ
            return value > max ? value : max
        }, 0)
        return currentMax > 0 ? currentMax + 2 : 3002
    },

    openModal(id) {
        const el = document.getElementById(id)
        if (!el) return false
        el.style.zIndex = String(this.getNextModalLayerBase())
        el.classList.remove("hidden")
        el.classList.add("active")
        el.setAttribute("aria-hidden", "false")
        this.toggleSidebar(false)
        if (id === "poll-modal") {
            if (!this.isFeatureEnabled("poll")) return false
            this.startSurvey()
        }
        if (id === "lock-center-modal") {
            this.renderLockCenter()
        }
        return el.classList.contains("active")
    },

    closeModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.remove("active")
        el.setAttribute("aria-hidden", "true")
        el.style.removeProperty("z-index")
        el.dispatchEvent(new CustomEvent("smartnotes:modal-closed", { detail: { id } }))
        if (id === "settings-modal") {
            const pendingTimerId = Number(this.draftRuntimeApplyTimerId || 0)
            if (pendingTimerId) {
                clearTimeout(pendingTimerId)
                this.draftRuntimeApplyTimerId = 0
            }
            StateStore.update("appearanceDraft", null)
        }
    },

    syncSettingsDraftFromOriginal() {
        const originalSettings = StateStore.read().originalUserSettings
        if (!originalSettings) return
        StateStore.update("draftUserSettings", JSON.parse(JSON.stringify(originalSettings)))
    },

    openSettings() {
        this.settingsPage = null
        this.interfaceSettingsPersistPending = false
        this.syncSettingsDraftFromOriginal()
        this.openModal("settings-modal")
        this.renderSettingsPage()
    },

    openSettingsPage(page) {
        this.settingsPage = page
        this.renderSettingsPage()
    },

    backSettingsPage() {
        this.settingsPage = null
        this.renderSettingsPage()
    },

    renderSettingsPage() {
        const root = document.getElementById("settings-content")
        const title = document.getElementById("settings-title")
        const backBtn = document.querySelector(".settings-back")
        if (!root || !title || !backBtn) return
        const page = this.settingsPage
        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        root.classList.toggle("settings-appearance-page", page === "appearance")
        if (!page) {
            title.textContent = dict.settings_menu_title || dict.settings || "Settings"
            backBtn.classList.add("is-hidden")
            root.innerHTML = `
                <div class="settings-menu-list">
                    <button type="button" class="settings-menu-item" data-action="open-settings-page" data-page="general">
                        <div class="settings-menu-meta">
                            <span class="settings-menu-title">${dict.settings_general || "General"}</span>
                            <span class="settings-menu-desc">${dict.settings_category_general_desc || ""}</span>
                        </div>
                        <i class="material-icons-round" aria-hidden="true">chevron_right</i>
                    </button>
                    <button type="button" class="settings-menu-item" data-action="open-settings-page" data-page="appearance">
                        <div class="settings-menu-meta">
                            <span class="settings-menu-title">${dict.settings_appearance || "Appearance"}</span>
                            <span class="settings-menu-desc">${dict.settings_category_appearance_desc || ""}</span>
                        </div>
                        <i class="material-icons-round" aria-hidden="true">chevron_right</i>
                    </button>
                    <button type="button" class="settings-menu-item" data-action="open-settings-page" data-page="interface">
                        <div class="settings-menu-meta">
                            <span class="settings-menu-title">${dict.settings_interface || "Interface Elements"}</span>
                            <span class="settings-menu-desc">${dict.settings_category_interface_desc || ""}</span>
                        </div>
                        <i class="material-icons-round" aria-hidden="true">chevron_right</i>
                    </button>
                    <button type="button" class="settings-menu-item" data-action="open-settings-page" data-page="export_import">
                        <div class="settings-menu-meta">
                            <span class="settings-menu-title">${dict.settings_export_import || "Export / Import"}</span>
                            <span class="settings-menu-desc">${dict.settings_category_export_import_desc || ""}</span>
                        </div>
                        <i class="material-icons-round" aria-hidden="true">chevron_right</i>
                    </button>
                </div>
            `
            this.applyInputAutocompletePolicy(root)
            return
        }

        backBtn.classList.remove("is-hidden")
        if (page === "general") {
            title.textContent = dict.settings_general || dict.general || "General"
            root.innerHTML = `
                <div class="settings-group">
                    <div class="settings-grid">
                        <div class="field">
                            <span class="field-label">${dict.language || "Language"}</span>
                            <select id="settings-language" class="input-area" aria-label="${dict.language || "Language"}">
                                <option value="ru">Русский</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.folder_view_mode || "Display"}</span>
                            <select id="settings-folder-view" class="input-area" aria-label="${dict.folder_view_mode || "Display"}">
                                <option value="compact">${dict.folder_view_compact || "Sidebar list"}</option>
                                <option value="full">${dict.folder_view_full || "Full view"}</option>
                            </select>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_notes_per_page || "Notes per page"}</span>
                            <select id="settings-notes-per-page" class="input-area" aria-label="${dict.settings_notes_per_page || "Notes per page"}">
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                            </select>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_external_storage || "Google Drive"}</span>
                            <div class="settings-toggle-item" style="padding:0; background:none; border:0; gap:12px; align-items:center;">
                                <div style="display:flex; flex-direction:column; gap:4px; min-width:0; flex:1;">
                                    <span id="settings-drive-status">${dict.drive_not_connected || "Not connected"}</span>
                                </div>
                                <button type="button" id="settings-drive-connect" class="btn-secondary">${dict.drive_connect || "Connect"}</button>
                            </div>
                        </div>
                        <div class="settings-toggle-item">
                            <span>${dict.reduce_motion || "Reduce motion"}</span>
                            <label class="switch">
                                <input type="checkbox" id="settings-reduce-motion" aria-label="${dict.reduce_motion || "Reduce motion"}">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="settings-actions row-between">
                    <button type="button" class="btn-secondary" data-action="settings-cancel">${dict.cancel || "Cancel"}</button>
                    <button type="button" class="btn-primary" data-action="settings-save">${dict.save || "Save"}</button>
                </div>
            `
            this.bindSettingsControls()
            this.syncSettingsUI()
            return
        }

        if (page === "appearance") {
            title.textContent = dict.settings_appearance || dict.appearance || "Appearance"
            root.innerHTML = `
                <div class="settings-group">
                    <div class="field">
                        <span class="field-label">${dict.presets || "Presets"}</span>
                        <div id="theme-picker-root" class="settings-theme-grid"></div>
                    </div>
                    <div class="field">
                        <span class="field-label">${dict.manual || "Manual"}</span>
                        <div class="settings-color-grid">
                            <label class="field">
                                <span class="field-label">${dict.c_accent || "Accent"}</span>
                                <div class="color-picker" data-color-picker>
                                    <input type="text" id="cp-primary" class="color-picker-input" data-color-input aria-label="${dict.color_accent || "Accent color"}" autocomplete="off">
                                    <button type="button" class="color-picker-trigger" data-color-trigger aria-label="${dict.color_accent || "Accent color"}">
                                        <span class="color-picker-swatch" data-color-swatch></span>
                                        <span class="color-picker-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24" focusable="false">
                                                <path d="M12 3c4.97 0 9 3.13 9 7 0 2.2-1.42 4.19-3.71 5.48-.79.44-1.28 1.28-1.28 2.18v.84c0 .83-.67 1.5-1.5 1.5h-2.5c-.83 0-1.5-.67-1.5-1.5v-1.3H9c-3.87 0-7-2.69-7-6s3.13-7 10-7zm-4 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7-2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm2 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"></path>
                                            </svg>
                                        </span>
                                    </button>
                                    <div class="color-picker-panel" data-color-panel role="dialog" aria-label="${dict.color_accent || "Accent color"}">
                                        <div class="color-picker-sv" data-color-sv>
                                            <span class="color-picker-sv-handle" data-color-sv-handle></span>
                                        </div>
                                        <div class="color-picker-hue" data-color-hue>
                                            <span class="color-picker-hue-handle" data-color-hue-handle></span>
                                        </div>
                                        <div class="color-picker-hex-row">
                                            <span class="color-picker-hex-label">#</span>
                                            <input type="text" class="color-picker-hex" data-color-hex maxlength="7" aria-label="${dict.hex_color || "HEX code"}" autocomplete="off">
                                        </div>
                                    </div>
                                </div>
                            </label>
                            <label class="field">
                                <span class="field-label">${dict.c_bg || "Background"}</span>
                                <div class="color-picker" data-color-picker>
                                    <input type="text" id="cp-bg" class="color-picker-input" data-color-input aria-label="${dict.color_bg || "Background color"}" autocomplete="off">
                                    <button type="button" class="color-picker-trigger" data-color-trigger aria-label="${dict.color_bg || "Background color"}">
                                        <span class="color-picker-swatch" data-color-swatch></span>
                                        <span class="color-picker-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24" focusable="false">
                                                <path d="M12 3c4.97 0 9 3.13 9 7 0 2.2-1.42 4.19-3.71 5.48-.79.44-1.28 1.28-1.28 2.18v.84c0 .83-.67 1.5-1.5 1.5h-2.5c-.83 0-1.5-.67-1.5-1.5v-1.3H9c-3.87 0-7-2.69-7-6s3.13-7 10-7zm-4 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7-2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm2 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"></path>
                                            </svg>
                                        </span>
                                    </button>
                                    <div class="color-picker-panel" data-color-panel role="dialog" aria-label="${dict.color_bg || "Background color"}">
                                        <div class="color-picker-sv" data-color-sv>
                                            <span class="color-picker-sv-handle" data-color-sv-handle></span>
                                        </div>
                                        <div class="color-picker-hue" data-color-hue>
                                            <span class="color-picker-hue-handle" data-color-hue-handle></span>
                                        </div>
                                        <div class="color-picker-hex-row">
                                            <span class="color-picker-hex-label">#</span>
                                            <input type="text" class="color-picker-hex" data-color-hex maxlength="7" aria-label="${dict.hex_color || "HEX code"}" autocomplete="off">
                                        </div>
                                    </div>
                                </div>
                            </label>
                            <label class="field">
                                <span class="field-label">${dict.c_text || "Text"}</span>
                                <div class="color-picker" data-color-picker>
                                    <input type="text" id="cp-text" class="color-picker-input" data-color-input aria-label="${dict.color_text || "Text color"}" autocomplete="off">
                                    <button type="button" class="color-picker-trigger" data-color-trigger aria-label="${dict.color_text || "Text color"}">
                                        <span class="color-picker-swatch" data-color-swatch></span>
                                        <span class="color-picker-icon" aria-hidden="true">
                                            <svg viewBox="0 0 24 24" focusable="false">
                                                <path d="M12 3c4.97 0 9 3.13 9 7 0 2.2-1.42 4.19-3.71 5.48-.79.44-1.28 1.28-1.28 2.18v.84c0 .83-.67 1.5-1.5 1.5h-2.5c-.83 0-1.5-.67-1.5-1.5v-1.3H9c-3.87 0-7-2.69-7-6s3.13-7 10-7zm-4 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7-2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm2 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"></path>
                                            </svg>
                                        </span>
                                    </button>
                                    <div class="color-picker-panel" data-color-panel role="dialog" aria-label="${dict.color_text || "Text color"}">
                                        <div class="color-picker-sv" data-color-sv>
                                            <span class="color-picker-sv-handle" data-color-sv-handle></span>
                                        </div>
                                        <div class="color-picker-hue" data-color-hue>
                                            <span class="color-picker-hue-handle" data-color-hue-handle></span>
                                        </div>
                                        <div class="color-picker-hex-row">
                                            <span class="color-picker-hex-label">#</span>
                                            <input type="text" class="color-picker-hex" data-color-hex maxlength="7" aria-label="${dict.hex_color || "HEX code"}" autocomplete="off">
                                        </div>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">${dict.settings_transparency || "Transparency"}</div>
                        <div class="field">
                            <span class="field-label">${dict.settings_ui_opacity || "Interface opacity"}</span>
                            <input type="range" min="40" max="100" step="1" class="input-area" data-appearance-opacity>
                            <span class="folder-meta" data-appearance-opacity-value></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_cards_opacity || "Notes and folders opacity"}</span>
                            <input type="range" min="50" max="100" step="1" class="input-area" data-appearance-cards-opacity>
                            <span class="folder-meta" data-appearance-cards-opacity-value></span>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">${dict.settings_backgrounds || "Backgrounds"}</div>
                        <div class="settings-background-grid">
                            <div class="field">
                                <span class="field-label">${dict.settings_main_background || "Main screen background"}</span>
                                <input type="text" class="input-area" data-appearance-bg-input="main" placeholder="${dict.settings_background_placeholder || "Image URL or data"}" aria-label="${dict.settings_main_background || "Main screen background"}" autocomplete="off">
                                <div class="settings-background-actions">
                                    <label class="btn-secondary" for="settings-background-file-main">${dict.settings_background_upload || "Upload background"}</label>
                                    <input type="file" id="settings-background-file-main" hidden data-appearance-bg-file="main" accept="image/*" aria-label="${dict.settings_background_upload || "Upload background"}">
                                    <span class="folder-meta" data-appearance-bg-file-name="main">${dict.settings_background_file_empty || "No file selected"}</span>
                                    <button type="button" class="btn-secondary" data-appearance-bg-clear="main">${dict.clear || "Clear"}</button>
                                </div>
                            </div>
                            <div class="field">
                                <span class="field-label">${dict.settings_sidebar_background || "Sidebar background"}</span>
                                <input type="text" class="input-area" data-appearance-bg-input="sidebar" placeholder="${dict.settings_background_placeholder || "Image URL or data"}" aria-label="${dict.settings_sidebar_background || "Sidebar background"}" autocomplete="off">
                                <div class="settings-background-actions">
                                    <label class="btn-secondary" for="settings-background-file-sidebar">${dict.settings_background_upload || "Upload background"}</label>
                                    <input type="file" id="settings-background-file-sidebar" hidden data-appearance-bg-file="sidebar" accept="image/*" aria-label="${dict.settings_background_upload || "Upload background"}">
                                    <span class="folder-meta" data-appearance-bg-file-name="sidebar">${dict.settings_background_file_empty || "No file selected"}</span>
                                    <button type="button" class="btn-secondary" data-appearance-bg-clear="sidebar">${dict.clear || "Clear"}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="settings-actions row-between">
                    <div class="row-left">
                        <button type="button" class="btn-secondary" data-action="appearance-reset">${dict.reset || "Reset"}</button>
                        <button type="button" class="btn-secondary" data-action="appearance-cancel">${dict.cancel || "Cancel"}</button>
                    </div>
                    <button type="button" class="btn-primary" data-action="appearance-save">${dict.save || "Save"}</button>
                </div>
            `
            if (typeof ColorPalette !== "undefined") ColorPalette.init(root)
            this.initAppearanceDraft()
            this.bindAppearanceBackgroundControls(root)
            this.renderAppearanceDraft()
            this.applyInputAutocompletePolicy(root)
            return
        }

        if (page === "interface") {
            title.textContent = dict.settings_interface || dict.editor_settings || "Interface Elements"
            const interfaceSettings = this.getSettingsDraft()?.interface || {}
            root.innerHTML = `
                <div class="settings-group">
                    <details class="settings-section" open>
                        <summary class="settings-section-title">${dict.settings_interface_filters || "Фильтры"}</summary>
                        <div class="settings-toggle-list">
                            ${this.buildInterfaceSettingToggle("showSavedFilters", dict.settings_show_saved_filters || "Показывать сохранённые фильтры", interfaceSettings.showSavedFilters !== false)}
                            ${this.buildInterfaceSettingToggle("showTagFilter", dict.settings_show_tag_filter || "Показывать фильтр по тегам", interfaceSettings.showTagFilter !== false)}
                            ${this.buildInterfaceSettingToggle("showUpdatedPeriodFilter", dict.settings_show_updated_period || "Показывать период обновления", interfaceSettings.showUpdatedPeriodFilter !== false)}
                        </div>
                    </details>
                    <details class="settings-section">
                        <summary class="settings-section-title">${dict.settings_editor_tools || "Editor Tools"}</summary>
                        <div id="editor-tools-list" class="settings-toggle-list"></div>
                    </details>
                </div>
            `
            root.querySelectorAll("[data-interface-key]").forEach(input => {
                input.addEventListener("change", event => {
                    const key = event.target.dataset.interfaceKey
                    const nextInterface = {
                        ...(this.getSettingsDraft()?.interface || {}),
                        [key]: !!event.target.checked
                    }
                    this.updateSettingsDraft({ interface: nextInterface })
                    this.applyDraftSettingsToRuntime()
                    this.renderFilterMenu()
                    this.interfaceSettingsPersistPending = true
                })
            })
            this.renderEditorSettings()
            this.applyInputAutocompletePolicy(root)
            return
        }

        if (page === "export_import") {
            title.textContent = dict.settings_export_import || "Export / Import"
            const lastBackupLabel = typeof this.getLastDriveBackupLabel === "function"
                ? this.getLastDriveBackupLabel()
                : ""
            root.innerHTML = `
                <div class="settings-group">
                    <div class="settings-section">
                        <div class="settings-section-title">${dict.export_section_title || "Export"}</div>
                        <div class="settings-actions-grid">
                            <button type="button" class="btn-secondary" data-action="settings-export-all-notes">
                                ${dict.settings_export_all_notes || dict.export_all || "Export all notes"}
                            </button>
                            <button type="button" class="btn-secondary" data-action="settings-export-folder">
                                ${dict.settings_export_folder || dict.export_folder || "Export folder"}
                            </button>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">${dict.backup_section_title || "Backup"}</div>
                        <div class="settings-actions-grid">
                            <button type="button" class="btn-secondary" data-action="settings-backup-all-notes">
                                ${dict.settings_backup_all_notes || dict.backup_all_notes_drive || "Back up all notes"}
                            </button>
                            <button type="button" class="btn-secondary" data-action="settings-backup-folder">
                                ${dict.settings_backup_folder || dict.backup_folder_select || "Back up folder"}
                            </button>
                        </div>
                        <div class="folder-meta">${lastBackupLabel}</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">${dict.import_section_title || "Import"}</div>
                        <div class="settings-actions-grid">
                            <button type="button" class="btn-primary" data-action="settings-trigger-import">
                                ${dict.settings_import_notes || dict.import_file || "Import notes"}
                            </button>
                        </div>
                    </div>
                </div>
            `
            this.applyInputAutocompletePolicy(root)
        }
    },

    buildInterfaceSettingToggle(key, label, checked) {
        return `
            <label class="settings-toggle-item">
                <span>${label}</span>
                <label class="switch">
                    <input type="checkbox" data-interface-key="${key}" ${checked ? "checked" : ""}>
                    <span class="slider"></span>
                </label>
            </label>
        `
    },

    getSettingsDraft() {
        return StateStore.read().draftUserSettings || StateStore.read().originalUserSettings
    },

    isSettingsDirty() {
        const originalSettings = StateStore.read().originalUserSettings
        const draftSettings = StateStore.read().draftUserSettings
        if (!originalSettings || !draftSettings) return false
        return JSON.stringify(draftSettings) !== JSON.stringify(originalSettings)
    },

    updateSettingsDraft(updates) {
        const currentDraft = this.getSettingsDraft()
        if (!currentDraft) return
        const nextDraft = { ...currentDraft, ...updates }
        StateStore.update("draftUserSettings", JSON.parse(JSON.stringify(nextDraft)))
    },

    applyDraftSettingsToRuntime() {
        const currentDraftSettings = this.getSettingsDraft()
        if (!currentDraftSettings) return
        SettingsSyncService.applyUserSettingsToRuntime(currentDraftSettings, { resetVisibleLimit: true, persistTheme: false })
    },

    scheduleDraftSettingsRuntimeApply() {
        const pendingTimerId = Number(this.draftRuntimeApplyTimerId || 0)
        if (pendingTimerId) clearTimeout(pendingTimerId)
        this.draftRuntimeApplyTimerId = setTimeout(() => {
            this.draftRuntimeApplyTimerId = 0
            this.applyDraftSettingsToRuntime()
        }, 48)
    },

    requestCloseSettingsModal() {
        if (this.interfaceSettingsPersistPending) {
            this.saveSettingsDraft()
            return
        }
        if (!this.isSettingsDirty()) {
            this.closeModal("settings-modal")
            return
        }
        this.confirm("confirm_default", () => {
            this.cancelSettingsDraft()
        })
    },

    cancelSettingsDraft() {
        const originalSettings = StateStore.read().originalUserSettings
        if (!originalSettings) return
        StateStore.update("draftUserSettings", JSON.parse(JSON.stringify(originalSettings)))
        SettingsSyncService.applyUserSettingsToRuntime(originalSettings, { resetVisibleLimit: true, persistTheme: false })
        if (this.settingsPage === "appearance") {
            this.initAppearanceDraft()
            this.renderAppearanceDraft()
        } else {
            this.syncSettingsUI()
        }
        this.interfaceSettingsPersistPending = false
        this.closeModal("settings-modal")
    },

    async saveSettingsDraft() {
        const pendingTimerId = Number(this.draftRuntimeApplyTimerId || 0)
        if (pendingTimerId) {
            clearTimeout(pendingTimerId)
            this.draftRuntimeApplyTimerId = 0
            this.applyDraftSettingsToRuntime()
        }
        const currentDraftSettings = this.getSettingsDraft()
        if (!currentDraftSettings) return
        try {
            const nextSavedSettings = await SettingsSyncService.saveUserSettings(currentDraftSettings)
            if (!nextSavedSettings) return
            StateStore.set(previousState => ({
                ...previousState,
                originalUserSettings: JSON.parse(JSON.stringify(nextSavedSettings)),
                draftUserSettings: JSON.parse(JSON.stringify(nextSavedSettings))
            }))
            SettingsSyncService.applyUserSettingsToRuntime(nextSavedSettings, { resetVisibleLimit: true, persistTheme: true })
            if (this.settingsPage === "appearance") {
                this.initAppearanceDraft()
                this.renderAppearanceDraft()
            } else {
                this.syncSettingsUI()
            }
            this.interfaceSettingsPersistPending = false
            this.closeModal("settings-modal")
        } catch {
            this.showToast(this.getText("sync_error", "Sync error"))
        }
    },
    initAppearanceDraft() {
        const settingsDraft = this.getSettingsDraft()
        const sourceTheme = settingsDraft
            ? {
                preset: settingsDraft.themeId,
                ...(settingsDraft.customTheme || {})
            }
            : ThemeManager.getSavedSettings()
        const presetKey = sourceTheme.preset || "oled"
        const preset = ThemeManager.resolvePreset(presetKey)
        StateStore.update("appearanceDraft", {
            preset: presetKey,
            p: sourceTheme.p || preset.p,
            bg: sourceTheme.bg || preset.bg,
            t: sourceTheme.t || preset.t,
            brandName: sourceTheme.brandName || "SmartNotes",
            basePreset: sourceTheme.basePreset || presetKey,
            mainBackgroundUrl: sourceTheme.mainBackgroundUrl || "",
            sidebarBackgroundUrl: sourceTheme.sidebarBackgroundUrl || "",
            mainBackgroundImage: sourceTheme.mainBackgroundImage || "",
            sidebarBackgroundImage: sourceTheme.sidebarBackgroundImage || "",
            uiOpacity: typeof sourceTheme.uiOpacity === "number" ? sourceTheme.uiOpacity : 0.78,
            cardsOpacity: typeof sourceTheme.cardsOpacity === "number" ? sourceTheme.cardsOpacity : 0.9
        })
    },

    renderAppearanceDraft() {
        let draft = StateStore.read().appearanceDraft || { preset: "oled", ...((this.getSettingsDraft() && this.getSettingsDraft().customTheme) || ThemeManager.getSavedSettings()) }
        if (draft.preset && draft.preset !== "manual" && (!draft.p || !draft.bg || !draft.t)) {
            const preset = ThemeManager.resolvePreset(draft.preset)
            draft = { ...draft, p: preset.p, bg: preset.bg, t: preset.t }
            StateStore.update("appearanceDraft", draft)
        }
        const normalizedDraft = {
            ...draft,
            mainBackgroundUrl: typeof draft.mainBackgroundUrl === "string" ? draft.mainBackgroundUrl : "",
            sidebarBackgroundUrl: typeof draft.sidebarBackgroundUrl === "string" ? draft.sidebarBackgroundUrl : "",
            mainBackgroundImage: typeof draft.mainBackgroundImage === "string" ? draft.mainBackgroundImage : "",
            sidebarBackgroundImage: typeof draft.sidebarBackgroundImage === "string" ? draft.sidebarBackgroundImage : "",
            uiOpacity: Math.min(1, Math.max(0.4, Number(draft.uiOpacity ?? 0.78))),
            cardsOpacity: Math.min(1, Math.max(0.5, Number(draft.cardsOpacity ?? 0.9)))
        }
        if (normalizedDraft.mainBackgroundUrl !== draft.mainBackgroundUrl || normalizedDraft.sidebarBackgroundUrl !== draft.sidebarBackgroundUrl || normalizedDraft.mainBackgroundImage !== draft.mainBackgroundImage || normalizedDraft.sidebarBackgroundImage !== draft.sidebarBackgroundImage) {
            draft = normalizedDraft
            StateStore.update("appearanceDraft", draft)
        }
        const activeKey = draft.preset && draft.preset !== "manual" ? draft.preset : "manual"
        ThemeManager.syncInputs(draft.p, draft.bg, draft.t)
        this.syncAppearanceBackgroundInputs(draft)
        this.syncAppearanceOpacityControl(draft)
        const onSelect = (key) => {
            let nextDraft = null
            if (key === "manual") {
                nextDraft = {
                    ...draft,
                    preset: "manual",
                    brandName: "SmartNotes",
                    basePreset: "oled"
                }
            } else {
                const preset = ThemeManager.resolvePreset(key)
                const customPreset = ThemeManager.getCustomPresetByKey(key)
                nextDraft = {
                    preset: key,
                    p: preset.p,
                    bg: preset.bg,
                    t: preset.t,
                    brandName: "SmartNotes",
                    basePreset: key,
                    mainBackgroundUrl: customPreset ? (customPreset.mainBackgroundUrl || "") : (draft.mainBackgroundUrl || ""),
                    sidebarBackgroundUrl: customPreset ? (customPreset.sidebarBackgroundUrl || "") : (draft.sidebarBackgroundUrl || ""),
                    mainBackgroundImage: customPreset ? customPreset.mainBackgroundImage : (draft.mainBackgroundImage || ""),
                    sidebarBackgroundImage: customPreset ? customPreset.sidebarBackgroundImage : (draft.sidebarBackgroundImage || ""),
                    uiOpacity: customPreset && typeof customPreset.uiOpacity === "number" ? customPreset.uiOpacity : (typeof draft.uiOpacity === "number" ? draft.uiOpacity : 0.78),
                    cardsOpacity: customPreset && typeof customPreset.cardsOpacity === "number" ? customPreset.cardsOpacity : (typeof draft.cardsOpacity === "number" ? draft.cardsOpacity : 0.9)
                }
            }
            this.applyAppearanceDraft(nextDraft)
            this.renderAppearanceDraft()
        }
        const onCreateCustomPreset = () => {
            const currentDraft = StateStore.read().appearanceDraft || draft
            const createResult = ThemeManager.addCustomPreset(currentDraft)
            if (!createResult?.ok) {
                this.showToast(this.getText("appearance_preset_limit", "Maximum 5 custom presets"))
                return
            }
            const createdPreset = ThemeManager.getCustomPresetByKey(createResult.key)
            if (!createdPreset) return
            const nextDraft = {
                ...currentDraft,
                preset: createResult.key,
                p: createdPreset.p,
                bg: createdPreset.bg,
                t: createdPreset.t,
                mainBackgroundUrl: createdPreset.mainBackgroundUrl || "",
                sidebarBackgroundUrl: createdPreset.sidebarBackgroundUrl || "",
                mainBackgroundImage: createdPreset.mainBackgroundImage || "",
                sidebarBackgroundImage: createdPreset.sidebarBackgroundImage || "",
                uiOpacity: typeof createdPreset.uiOpacity === "number" ? createdPreset.uiOpacity : (typeof currentDraft.uiOpacity === "number" ? currentDraft.uiOpacity : 0.78),
                cardsOpacity: typeof createdPreset.cardsOpacity === "number" ? createdPreset.cardsOpacity : (typeof currentDraft.cardsOpacity === "number" ? currentDraft.cardsOpacity : 0.9)
            }
            this.applyAppearanceDraft(nextDraft)
            this.renderAppearanceDraft()
        }
        ThemeManager.renderPicker({ onSelect, onCreateCustomPreset, activeKey, manualColor: draft.p })
        ThemeManager.setupColorInputs((type, val) => {
            const current = StateStore.read().appearanceDraft || draft
            const normalizedValue = ThemeManager.normalizeHex(val)
            const isCustomPresetSelected = String(current.preset || "").startsWith("custom:")
            if (isCustomPresetSelected) {
                ThemeManager.updateCustomPreset(current.preset, { [type]: normalizedValue })
                const updatedCustomPreset = ThemeManager.getCustomPresetByKey(current.preset)
                const next = {
                    ...current,
                    p: updatedCustomPreset?.p || current.p,
                    bg: updatedCustomPreset?.bg || current.bg,
                    t: updatedCustomPreset?.t || current.t
                }
                ThemeManager.updatePresetPreviewDot(current.preset, next)
                this.applyAppearanceDraft(next)
                ThemeManager.syncInputs(next.p, next.bg, next.t)
                return
            }
            const next = {
                ...current,
                preset: "manual",
                [type]: normalizedValue
            }
            this.applyAppearanceDraft(next)
            ThemeManager.syncInputs(next.p, next.bg, next.t)
        })
    },

    applyAppearanceDraft(nextDraft) {
        const currentDraft = StateStore.read().appearanceDraft || null
        if (currentDraft && JSON.stringify(currentDraft) === JSON.stringify(nextDraft)) return
        StateStore.update("appearanceDraft", nextDraft)
        this.updateSettingsDraft({
            themeId: nextDraft.preset || "oled",
            customTheme: {
                p: nextDraft.p,
                bg: nextDraft.bg,
                t: nextDraft.t,
                mainBackgroundUrl: nextDraft.mainBackgroundUrl || "",
                sidebarBackgroundUrl: nextDraft.sidebarBackgroundUrl || "",
                mainBackgroundImage: nextDraft.mainBackgroundImage || "",
                sidebarBackgroundImage: nextDraft.sidebarBackgroundImage || "",
                uiOpacity: typeof nextDraft.uiOpacity === "number" ? nextDraft.uiOpacity : 0.78,
                cardsOpacity: typeof nextDraft.cardsOpacity === "number" ? nextDraft.cardsOpacity : 0.9
            },
            backgroundType: (nextDraft.mainBackgroundUrl || nextDraft.mainBackgroundImage) ? "image" : "none",
            backgroundValue: nextDraft.mainBackgroundUrl || nextDraft.mainBackgroundImage || ""
        })
        this.scheduleDraftSettingsRuntimeApply()
        this.syncAppearanceBackgroundInputs(nextDraft)
        this.syncAppearanceOpacityControl(nextDraft)
    },

    resetAppearanceDraft() {
        const defaults = ThemeManager.getDefaultSettings()
        const preset = ThemeManager.resolvePreset(defaults.preset || "oled")
        const draft = {
            preset: defaults.preset || "oled",
            p: preset.p,
            bg: preset.bg,
            t: preset.t,
            mainBackgroundUrl: defaults.mainBackgroundUrl || "",
            sidebarBackgroundUrl: defaults.sidebarBackgroundUrl || "",
            mainBackgroundImage: defaults.mainBackgroundImage || "",
            sidebarBackgroundImage: defaults.sidebarBackgroundImage || "",
            uiOpacity: typeof defaults.uiOpacity === "number" ? defaults.uiOpacity : 0.78,
            cardsOpacity: typeof defaults.cardsOpacity === "number" ? defaults.cardsOpacity : 0.9
        }
        this.applyAppearanceDraft(draft)
        this.renderAppearanceDraft()
    },

    async saveAppearanceDraft() {
        await this.saveSettingsDraft()
    },

    cancelAppearanceDraft() {
        this.cancelSettingsDraft()
    },

    bindSettingsControls() {
        const langSelect = document.getElementById("settings-language")
        if (langSelect) {
            langSelect.addEventListener("change", event => {
                this.updateSettingsDraft({ lang: event.target.value === "en" ? "en" : "ru" })
                this.applyDraftSettingsToRuntime()
                this.syncSettingsUI()
            })
        }

        const folderSelect = document.getElementById("settings-folder-view")
        if (folderSelect) {
            folderSelect.addEventListener("change", event => {
                this.updateSettingsDraft({ folderViewMode: event.target.value === "full" ? "full" : "compact" })
                this.applyDraftSettingsToRuntime()
                this.syncSettingsUI()
            })
        }

        const notesPerPageSelect = document.getElementById("settings-notes-per-page")
        if (notesPerPageSelect) {
            notesPerPageSelect.addEventListener("change", event => {
                const allowedValues = new Set([5, 10, 20, 50])
                const parsedValue = Number(event.target.value)
                const notesPerPage = allowedValues.has(parsedValue) ? parsedValue : 20
                this.updateSettingsDraft({ notesPerPage })
                this.applyDraftSettingsToRuntime()
                this.syncSettingsUI()
            })
        }

        const reduceToggle = document.getElementById("settings-reduce-motion")
        if (reduceToggle) {
            reduceToggle.addEventListener("change", event => {
                this.updateSettingsDraft({ reduceMotion: !!event.target.checked })
                this.applyDraftSettingsToRuntime()
                this.syncSettingsUI()
            })
        }

        const driveConnectButton = document.getElementById("settings-drive-connect")
        if (driveConnectButton && !driveConnectButton.dataset.bound) {
            driveConnectButton.dataset.bound = "1"
            driveConnectButton.addEventListener("click", async () => {
                if (!this.isFeatureEnabled("googleDrive")) {
                    this.showFeatureDisabledToast("googleDrive")
                    this.syncSettingsUI()
                    return
                }
                const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
                const driveStatus = mediaService?.getStatus?.() || null
                const isDriveLinked = !!driveStatus?.linked || !!driveStatus?.connected
                const canConnect = (!isDriveLinked || (isDriveLinked && !driveStatus?.connected && !!driveStatus?.errorCode)) && !!mediaService?.connect
                const canUnlink = isDriveLinked && !!mediaService?.unlink
                if ((!canConnect && !canUnlink) || !driveStatus?.configured) {
                    this.showToast(this.getText("external_storage_unavailable", "External disk is temporarily unavailable"))
                    this.syncSettingsUI()
                    return
                }
                this.syncSettingsUI()
                try {
                    if (isDriveLinked && !driveStatus?.connected && driveStatus?.errorCode) {
                        await mediaService.connect()
                        this.showToast(this.getText("drive_connected", "Google Drive connected"))
                    } else if (isDriveLinked) {
                        await mediaService.unlink()
                        this.showToast(this.getText("drive_disconnected", "Google Drive disconnected"))
                    } else {
                        await mediaService.connect()
                        this.showToast(this.getText("drive_connected", "Google Drive connected"))
                    }
                } catch (error) {
                    const message = typeof this.resolveExternalMediaMessage === "function"
                        ? this.resolveExternalMediaMessage(error, { attachmentOnly: true })
                        : this.getText("external_attachment_unavailable", "Disk is not connected, attachment unavailable")
                    this.showToast(message)
                } finally {
                    this.syncSettingsUI()
                }
            })
        }
    },
    bindAppearanceBackgroundControls(root) {
        if (!root) return
        const validateBackgroundUrl = (value) => {
            const source = String(value || "").trim()
            if (!source) return { ok: true, value: "" }
            if (/pinterest\.com/i.test(source)) {
                return {
                    ok: false,
                    value: "",
                    message: this.getText("background_link_pinterest_invalid", "Pinterest does not allow direct image links. Open the image and copy the direct file URL (.jpg/.png)")
                }
            }
            if (!/^https?:\/\//i.test(source) || /^data:/i.test(source)) {
                return {
                    ok: false,
                    value: "",
                    message: this.getText("background_link_direct_only", "Provide a direct image URL (.jpg/.png/.webp)")
                }
            }
            if (!/\.(jpg|jpeg|png|webp|avif)(\?.*)?$/i.test(source)) {
                return {
                    ok: false,
                    value: "",
                    message: this.getText("background_link_direct_only", "Provide a direct image URL (.jpg/.png/.webp)")
                }
            }
            return { ok: true, value: source }
        }
        const optimizeImageDataUrlForAppearance = (dataUrl) => new Promise((resolve) => {
            const source = String(dataUrl || "")
            if (!source.startsWith("data:image/")) {
                resolve(source)
                return
            }
            const image = new Image()
            image.onload = () => {
                const width = image.naturalWidth || image.width
                const height = image.naturalHeight || image.height
                if (!width || !height) {
                    resolve(source)
                    return
                }
                const maxDimension = 1920
                const scale = Math.min(1, maxDimension / Math.max(width, height))
                const targetWidth = Math.max(1, Math.round(width * scale))
                const targetHeight = Math.max(1, Math.round(height * scale))
                const canvas = document.createElement("canvas")
                canvas.width = targetWidth
                canvas.height = targetHeight
                const context = canvas.getContext("2d")
                if (!context) {
                    resolve(source)
                    return
                }
                context.drawImage(image, 0, 0, targetWidth, targetHeight)
                const optimized = canvas.toDataURL("image/jpeg", 0.8)
                resolve(optimized.length < source.length ? optimized : source)
            }
            image.onerror = () => resolve(source)
            image.src = source
        })
        const bindTextInput = (input, key) => {
            if (!input) return
            input.addEventListener("change", (event) => {
                const validationResult = validateBackgroundUrl(event.target.value)
                if (!validationResult.ok) {
                    this.showToast(validationResult.message)
                    this.syncAppearanceBackgroundInputs(StateStore.read().appearanceDraft || ThemeManager.getSavedSettings())
                    return
                }
                this.updateAppearanceBackground(key, { mode: "url", value: validationResult.value })
            })
        }
        const updateFileInputLabel = (key, fileName = "") => {
            const label = root.querySelector(`[data-appearance-bg-file-name="${key}"]`)
            if (!label) return
            label.textContent = fileName || this.getText("settings_background_file_empty", "No file selected")
        }
        const bindFileInput = (input, key) => {
            if (!input) return
            input.addEventListener("change", (event) => {
                const file = event.target.files && event.target.files[0]
                if (!file) {
                    updateFileInputLabel(key)
                    return
                }
                updateFileInputLabel(key, file.name)
                const reader = new FileReader()
                reader.onload = async () => {
                    const result = typeof reader.result === "string" ? reader.result : ""
                    const optimized = await optimizeImageDataUrlForAppearance(result)
                    this.updateAppearanceBackground(key, { mode: "local", value: optimized })
                    event.target.value = ""
                }
                reader.readAsDataURL(file)
            })
        }
        const bindClearButton = (button, key) => {
            if (!button) return
            button.addEventListener("click", () => {
                this.updateAppearanceBackground(key, { mode: "clear", value: "" })
                updateFileInputLabel(key)
            })
        }
        bindTextInput(root.querySelector('[data-appearance-bg-input="main"]'), "main")
        bindTextInput(root.querySelector('[data-appearance-bg-input="sidebar"]'), "sidebar")
        bindFileInput(root.querySelector('[data-appearance-bg-file="main"]'), "main")
        bindFileInput(root.querySelector('[data-appearance-bg-file="sidebar"]'), "sidebar")
        bindClearButton(root.querySelector('[data-appearance-bg-clear="main"]'), "main")
        bindClearButton(root.querySelector('[data-appearance-bg-clear="sidebar"]'), "sidebar")
        updateFileInputLabel("main")
        updateFileInputLabel("sidebar")
    },
    syncAppearanceBackgroundInputs(draft) {
        const mainInput = document.querySelector('[data-appearance-bg-input="main"]')
        const sidebarInput = document.querySelector('[data-appearance-bg-input="sidebar"]')
        if (mainInput) mainInput.value = draft.mainBackgroundUrl || ""
        if (sidebarInput) sidebarInput.value = draft.sidebarBackgroundUrl || ""
    },
    updateAppearanceBackground(key, backgroundSource) {
        const current = StateStore.read().appearanceDraft || ThemeManager.getSavedSettings()
        const mode = backgroundSource?.mode || "url"
        const value = String(backgroundSource?.value || "")
        const fieldMap = {
            main: { url: "mainBackgroundUrl", image: "mainBackgroundImage" },
            sidebar: { url: "sidebarBackgroundUrl", image: "sidebarBackgroundImage" }
        }
        const fields = fieldMap[key]
        if (!fields) return
        const isCustomPresetSelected = String(current.preset || "").startsWith("custom:")
        const next = {
            ...current,
            preset: isCustomPresetSelected ? current.preset : "manual"
        }
        if (mode === "url") {
            next[fields.url] = value
            next[fields.image] = ""
        } else if (mode === "local") {
            next[fields.url] = ""
            next[fields.image] = value
        } else {
            next[fields.url] = ""
            next[fields.image] = ""
        }
        if (isCustomPresetSelected) {
            ThemeManager.updateCustomPreset(current.preset, {
                [fields.url]: next[fields.url],
                [fields.image]: next[fields.image]
            })
        }
        this.applyAppearanceDraft(next)
    },

    syncAppearanceOpacityControl(draft) {
        const opacityInput = document.querySelector("[data-appearance-opacity]")
        const opacityLabel = document.querySelector("[data-appearance-opacity-value]")
        const cardsOpacityInput = document.querySelector("[data-appearance-cards-opacity]")
        const cardsOpacityLabel = document.querySelector("[data-appearance-cards-opacity-value]")
        const uiOpacity = Math.min(1, Math.max(0.4, Number(draft.uiOpacity ?? 0.78)))
        const cardsOpacity = Math.min(1, Math.max(0.5, Number(draft.cardsOpacity ?? 0.9)))
        if (opacityInput) {
            opacityInput.value = String(Math.round(uiOpacity * 100))
            if (!opacityInput.dataset.bound) {
                opacityInput.dataset.bound = "1"
                opacityInput.addEventListener("input", event => {
                    const nextOpacity = Math.min(1, Math.max(0.4, Number(event.target.value || 78) / 100))
                    const currentDraft = StateStore.read().appearanceDraft || ThemeManager.getSavedSettings()
                    if (String(currentDraft.preset || "").startsWith("custom:")) {
                        ThemeManager.updateCustomPreset(currentDraft.preset, { uiOpacity: nextOpacity })
                    }
                    this.applyAppearanceDraft({ ...currentDraft, uiOpacity: nextOpacity })
                })
            }
        }
        if (cardsOpacityInput) {
            cardsOpacityInput.value = String(Math.round(cardsOpacity * 100))
            if (!cardsOpacityInput.dataset.bound) {
                cardsOpacityInput.dataset.bound = "1"
                cardsOpacityInput.addEventListener("input", event => {
                    const nextOpacity = Math.min(1, Math.max(0.5, Number(event.target.value || 90) / 100))
                    const currentDraft = StateStore.read().appearanceDraft || ThemeManager.getSavedSettings()
                    if (String(currentDraft.preset || "").startsWith("custom:")) {
                        ThemeManager.updateCustomPreset(currentDraft.preset, { cardsOpacity: nextOpacity })
                    }
                    this.applyAppearanceDraft({ ...currentDraft, cardsOpacity: nextOpacity })
                })
            }
        }
        if (opacityLabel) opacityLabel.textContent = `${Math.round(uiOpacity * 100)}%`
        if (cardsOpacityLabel) cardsOpacityLabel.textContent = `${Math.round(cardsOpacity * 100)}%`
    },

    showToast(msg, options = {}) {
        const message = String(msg || "").trim()
        if (!message) return
        const now = Date.now()
        const deduplicationWindow = Number(options.deduplicationWindowMs) || 1800
        if (!options.allowDuplicate && this.toastDeduplication.lastMessage === message && (now - this.toastDeduplication.lastShownAt) < deduplicationWindow) {
            return
        }
        this.toastDeduplication = { lastMessage: message, lastShownAt: now }
        const div = document.createElement("div")
        div.className = "toast show"
        div.setAttribute("role", "status")
        const text = document.createElement("span")
        text.textContent = message
        div.appendChild(text)
        if (options.actionLabel && options.onAction) {
            const btn = document.createElement("button")
            btn.type = "button"
            btn.className = "toast-action"
            btn.textContent = options.actionLabel
            btn.onclick = () => {
                options.onAction()
                div.remove()
            }
            div.appendChild(btn)
        }
        const root = document.getElementById("toast-container")
        if (!root) return
        root.appendChild(div)
        setTimeout(() => {
            div.classList.remove("show")
            setTimeout(() => div.remove(), 300)
        }, options.duration || 2500)
    },

    confirm(type, cb) {
        const titles = {
            delete: this.getText("confirm_delete", "Delete?"),
            exit: this.getText("confirm_exit", "Sign out?"),
            account: this.getText("confirm_account", "Switch account?"),
            delete_f: this.getText("confirm_delete_folder", "Delete folder?"),
            clear_trash: this.getText("clear_trash_confirm", "Clear trash?"),
            hide_f: this.getText("confirm_hide_folder", "Do you want to hide this folder?"),
            delete_page: this.getText("page_delete_confirm", "Are you sure you want to delete this page?")
        }
        const titleEl = document.getElementById("confirm-title")
        if (titleEl) titleEl.textContent = titles[type] || this.getText("confirm_default", "Confirm")

        const okBtn = document.getElementById("confirm-ok")
        const newBtn = okBtn.cloneNode(true)
        okBtn.parentNode.replaceChild(newBtn, okBtn)

        newBtn.onclick = () => {
            cb()
            this.els.confirmModal.classList.remove("active")
        }

        this.els.confirmModal.classList.add("active")
        const cancel = document.getElementById("confirm-cancel")
        if (cancel) {
            const cancelClone = cancel.cloneNode(true)
            cancel.parentNode.replaceChild(cancelClone, cancel)
            cancelClone.onclick = () => this.els.confirmModal.classList.remove("active")
        }
    },

    showPrompt(title, placeholder, cb, value = "", options = {}) {
        const modal = this.els.promptModal
        const input = document.getElementById("prompt-input")
        const secondaryField = document.getElementById("prompt-secondary-field")
        const secondaryInput = document.getElementById("prompt-secondary-input")
        const ok = document.getElementById("prompt-ok")
        const cancel = document.getElementById("prompt-cancel")
        const titleEl = document.getElementById("prompt-title")
        const maxLength = Number(options.maxLength || 0)
        const shouldShowCounter = !!options.showCounter && maxLength > 0
        const secondaryOptions = options.secondaryField && typeof options.secondaryField === "object"
            ? options.secondaryField
            : null
        const secondaryMaxLength = Number(secondaryOptions?.maxLength || 0)
        const secondarySoftLimit = Number(secondaryOptions?.softLimit || 0)
        const showSecondaryCounter = !!secondaryOptions?.showCounter && secondaryMaxLength > 0

        if (titleEl) titleEl.textContent = title
        input.value = value
        input.placeholder = placeholder
        input.readOnly = true
        input.setAttribute("autocomplete", "new-password")
        input.setAttribute("autocorrect", "off")
        input.setAttribute("autocapitalize", "off")
        input.setAttribute("spellcheck", "false")

        if (secondaryField && secondaryInput && secondaryOptions) {
            secondaryField.classList.remove("hidden")
            secondaryInput.value = String(secondaryOptions.value || "")
            secondaryInput.placeholder = String(secondaryOptions.placeholder || "")
            secondaryInput.setAttribute("aria-label", String(secondaryOptions.ariaLabel || secondaryInput.getAttribute("aria-label") || ""))
            secondaryInput.maxLength = secondaryMaxLength > 0 ? secondaryMaxLength : 524288
            secondaryInput.readOnly = true
            secondaryInput.setAttribute("autocomplete", "new-password")
            secondaryInput.setAttribute("autocorrect", "off")
            secondaryInput.setAttribute("autocapitalize", "off")
            secondaryInput.setAttribute("spellcheck", "false")
        } else if (secondaryField && secondaryInput) {
            secondaryField.classList.add("hidden")
            secondaryInput.value = ""
            secondaryInput.placeholder = ""
            secondaryInput.removeAttribute("maxLength")
            secondaryInput.readOnly = false
        }

        let primaryCounter = modal.querySelector('[data-counter="primary"]')
        if (!primaryCounter && shouldShowCounter) {
            primaryCounter = document.createElement("span")
            primaryCounter.className = "prompt-character-counter"
            primaryCounter.dataset.counter = "primary"
            input.parentNode?.appendChild(primaryCounter)
        }
        if (primaryCounter && !shouldShowCounter) {
            primaryCounter.remove()
            primaryCounter = null
        }

        let secondaryCounter = modal.querySelector('[data-counter="secondary"]')
        if (secondaryField && !secondaryCounter && showSecondaryCounter) {
            secondaryCounter = document.createElement("span")
            secondaryCounter.className = "prompt-character-counter"
            secondaryCounter.dataset.counter = "secondary"
            secondaryField.appendChild(secondaryCounter)
        }
        if (secondaryCounter && (!secondaryOptions || !showSecondaryCounter)) {
            secondaryCounter.remove()
            secondaryCounter = null
        }

        const finish = (primaryValue, secondaryValue) => {
            if (primaryValue) {
                if (secondaryOptions) cb(primaryValue, secondaryValue)
                else cb(primaryValue)
            }
            modal.classList.remove("active")
            input.onkeydown = null
            input.oninput = null
            if (secondaryInput) {
                secondaryInput.onkeydown = null
                secondaryInput.oninput = null
            }
        }

        const okClone = ok.cloneNode(true)
        ok.parentNode.replaceChild(okClone, ok)

        const cancelClone = cancel.cloneNode(true)
        cancel.parentNode.replaceChild(cancelClone, cancel)

        const updatePromptState = () => {
            const primaryLength = String(input.value || "").trim().length
            const secondaryLength = secondaryInput ? String(secondaryInput.value || "").trim().length : 0
            const isPrimaryExceeded = shouldShowCounter && primaryLength > maxLength
            const isSecondaryExceeded = showSecondaryCounter && secondaryLength > secondaryMaxLength
            const isSecondarySoftExceeded = showSecondaryCounter && secondarySoftLimit > 0 && secondaryLength > secondarySoftLimit

            if (primaryCounter) {
                primaryCounter.textContent = `${primaryLength}/${maxLength}`
                primaryCounter.classList.toggle("is-limit-exceeded", isPrimaryExceeded)
            }
            if (secondaryCounter) {
                secondaryCounter.textContent = `${secondaryLength}/${secondarySoftLimit > 0 ? secondarySoftLimit : secondaryMaxLength}`
                secondaryCounter.classList.toggle("is-soft-limit-exceeded", isSecondarySoftExceeded && !isSecondaryExceeded)
                secondaryCounter.classList.toggle("is-limit-exceeded", isSecondaryExceeded)
            }

            okClone.disabled = isPrimaryExceeded || isSecondaryExceeded
        }

        okClone.onclick = () => {
            const primaryValue = String(input.value || "").trim()
            const secondaryValue = secondaryInput ? String(secondaryInput.value || "").trim() : ""
            finish(primaryValue, secondaryValue)
        }
        cancelClone.onclick = () => modal.classList.remove("active")
        input.oninput = updatePromptState
        input.onkeydown = event => {
            if (event.key !== "Enter") return
            event.preventDefault()
            okClone.click()
        }
        if (secondaryInput && secondaryOptions) {
            secondaryInput.oninput = updatePromptState
            secondaryInput.onkeydown = event => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault()
                    okClone.click()
                }
            }
        }
        updatePromptState()

        this.applyInputAutocompletePolicy(modal)
        modal.classList.add("active")
        setTimeout(() => {
            input.readOnly = false
            input.focus()
            input.select()
            if (secondaryInput) secondaryInput.readOnly = false
        }, 80)
    },
    showPasswordPrompt(title, placeholder) {
        const modal = document.getElementById("lock-modal")
        const input = document.getElementById("lock-password")
        const ok = document.getElementById("lock-apply")
        const titleEl = modal?.querySelector("[data-lang='lock_title']")
        if (!modal || !input || !ok || !titleEl) return Promise.resolve(null)

        titleEl.textContent = title
        input.value = ""
        input.placeholder = placeholder
        this.prepareProtectedInput(input, "password")

        return new Promise(resolve => {
            const handleModalClosed = () => finish(null)
            const finish = (value) => {
                modal.classList.remove("active")
                modal.removeEventListener("smartnotes:modal-closed", handleModalClosed)
                input.onkeydown = null
                ok.onclick = null
                resolve(value)
            }

            const submit = () => {
                finish(String(input.value || ""))
            }

            ok.onclick = submit
            input.onkeydown = event => {
                if (event.key !== "Enter") return
                event.preventDefault()
                submit()
            }
            modal.addEventListener("smartnotes:modal-closed", handleModalClosed)

            modal.classList.add("active")
            setTimeout(() => {
                this.prepareProtectedInput(input, "password")
                input.focus()
            }, 80)

            const cancelButtons = modal.querySelectorAll('[data-action="close-modal"][data-modal="lock-modal"]')
            cancelButtons.forEach(button => {
                button.onclick = () => finish(null)
            })
        })
    },
    prepareProtectedInput(input, mode = "password") {
        if (!input) return
        const normalizedMode = mode === "text" ? "text" : "password"
        input.type = normalizedMode
        input.setAttribute("autocomplete", "new-password")
        input.setAttribute("autocorrect", "off")
        input.setAttribute("autocapitalize", "off")
        input.setAttribute("spellcheck", "false")
        input.setAttribute("data-lpignore", "true")
        input.setAttribute("data-1p-ignore", "true")
        input.setAttribute("data-form-type", "other")
        if (!input.dataset.noAutofillName) {
            input.dataset.noAutofillName = `sn_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
        }
        input.setAttribute("name", input.dataset.noAutofillName)
    },

    syncSettingsUI() {
        const draftSettings = this.getSettingsDraft()
        if (!draftSettings) return
        const langSelect = document.getElementById("settings-language")
        if (langSelect) langSelect.value = draftSettings.lang === "en" ? "en" : "ru"
        const folderSelect = document.getElementById("settings-folder-view")
        if (folderSelect) folderSelect.value = draftSettings.folderViewMode === "full" ? "full" : "compact"
        const reduceToggle = document.getElementById("settings-reduce-motion")
        if (reduceToggle) reduceToggle.checked = !!draftSettings.reduceMotion
        const notesPerPageSelect = document.getElementById("settings-notes-per-page")
        if (notesPerPageSelect) notesPerPageSelect.value = String(draftSettings.notesPerPage || 20)
        const driveStatusElement = document.getElementById("settings-drive-status")
        const driveConnectButton = document.getElementById("settings-drive-connect")
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const driveStatus = this.isFeatureEnabled("googleDrive") ? (mediaService?.getStatus?.() || null) : { configured: false, pending: false, linked: false, connected: false, errorCode: "feature-disabled" }
        if (driveStatusElement) {
            if (!driveStatus?.configured) {
                driveStatusElement.textContent = this.getText("external_storage_unavailable", "External disk is temporarily unavailable")
            } else if (driveStatus.pending) {
                driveStatusElement.textContent = this.getText("drive_connecting", "Connecting...")
            } else if (driveStatus.connected) {
                driveStatusElement.textContent = this.getText("drive_connected", "Google Drive connected")
            } else if (driveStatus.linked) {
                driveStatusElement.textContent = this.getText("drive_linked", "Google Drive linked")
            } else if (driveStatus.errorCode) {
                driveStatusElement.textContent = typeof this.resolveExternalMediaMessage === "function"
                    ? this.resolveExternalMediaMessage({ code: driveStatus.errorCode }, { attachmentOnly: true })
                    : this.getText("external_attachment_unavailable", "Disk is not connected, attachment unavailable")
            } else {
                driveStatusElement.textContent = this.getText("drive_not_connected", "Not connected")
            }
        }
        if (driveConnectButton) {
            const isDriveLinked = !!driveStatus?.linked || !!driveStatus?.connected
            const needsReconnect = isDriveLinked && !driveStatus?.connected && !!driveStatus?.errorCode
            driveConnectButton.disabled = !driveStatus?.configured || !!driveStatus?.pending
            driveConnectButton.textContent = driveStatus?.pending
                ? this.getText("drive_connecting", "Connecting...")
                : needsReconnect
                    ? this.getText("drive_reconnect", "Reconnect")
                    : this.getText(isDriveLinked ? "drive_disconnect" : "drive_connect", isDriveLinked ? "Disconnect" : "Connect")
        }
        const saveButton = document.querySelector('[data-action="settings-save"]')
        if (saveButton) saveButton.disabled = !this.isSettingsDirty()
    },

    renderEditorSettings() {
        const root = document.getElementById("editor-tools-list")
        if (!root || !window.SmartNotesEditor) return
        const tools = window.SmartNotesEditor.getToolList()
        const enabled = window.SmartNotesEditor.getEnabledTools()
        root.innerHTML = ""
        tools.forEach(tool => {
            const row = document.createElement("div")
            row.className = "settings-toggle-item"
            
            const label = document.createElement("span")
            label.textContent = this.getText(tool.label, tool.label)
            
            const labelSwitch = document.createElement("label")
            labelSwitch.className = "switch"
            
            const input = document.createElement("input")
            input.type = "checkbox"
            input.checked = enabled[tool.id] !== false
            input.setAttribute("aria-label", label.textContent)
            input.addEventListener("change", () => {
                window.SmartNotesEditor.setToolEnabled(tool.id, input.checked)
                this.interfaceSettingsPersistPending = true
            })
            
            const slider = document.createElement("span")
            slider.className = "slider"
            
            labelSwitch.append(input, slider)
            row.append(label, labelSwitch)
            root.appendChild(row)
        })
    }
});
