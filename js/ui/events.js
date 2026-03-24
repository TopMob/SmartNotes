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
        const sectionSort = document.getElementById("notes-filter-section-sort")
        const sectionTags = document.getElementById("notes-filter-section-tags")
        const sectionDate = document.getElementById("notes-filter-section-date")
        const sectionFolders = document.getElementById("notes-filter-section-folders")
        if (sectionSaved) sectionSaved.classList.toggle("hidden", interfaceConfig.showSavedFilters === false)
        if (sectionSort) sectionSort.classList.toggle("hidden", interfaceConfig.showSortFilter === false)
        if (sectionTags) sectionTags.classList.toggle("hidden", interfaceConfig.showTagFilter === false)
        if (sectionDate) sectionDate.classList.toggle("hidden", interfaceConfig.showUpdatedPeriodFilter === false)
        if (sectionFolders) sectionFolders.classList.toggle("hidden", interfaceConfig.showFolderFilter === false)
        if (this.els.filterButton) {
            const hideFilterButton = interfaceConfig.showFilterButton === false
            this.els.filterButton.classList.toggle("hidden", hideFilterButton)
            if (hideFilterButton) this.toggleFilterMenu(false)
        }
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
            case "trigger-admin-analysis-reindex-query":
                this.triggerAnalysisRequest("reindex_query", "trigger-admin-analysis-reindex-query")
                break
            case "trigger-admin-analysis-reindex-body":
                this.triggerAnalysisRequest("reindex_body", "trigger-admin-analysis-reindex-body")
                break
            case "trigger-admin-analysis-reindex-force":
                this.triggerAnalysisRequest("reindex_force", "trigger-admin-analysis-reindex-force")
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
})
