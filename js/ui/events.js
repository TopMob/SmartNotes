Object.assign(UI, {
    bindEvents() {
        if (this.eventsBound) return
        this.eventsBound = true
        document.addEventListener("click", (e) => {
            const actionEl = e.target.closest("[data-action]")
            if (actionEl) {
                this.handleAction(actionEl, e)
            }

            const isDesktop = window.matchMedia("(min-width: 1024px)").matches
            if (!isDesktop && this.els.sidebar?.classList.contains("active") && !this.els.sidebar.contains(e.target) && !e.target.closest("#menu-toggle")) {
                this.toggleSidebar(false)
            }
            if (this.els.userMenu?.classList.contains("active") && !e.target.closest(".user-avatar-wrapper")) {
                this.toggleUserMenu(false)
            }
            if (this.els.filterMenu?.classList.contains("active") && !e.target.closest("#notes-filter-menu") && !e.target.closest("#notes-filter-toggle")) {
                this.toggleFilterMenu(false)
            }
            if (this.els.activeFolderMenu?.classList.contains("active") && !e.target.closest("#active-folder-menu-wrapper")) {
                this.toggleActiveFolderMenu(false)
            }

            const overlay = e.target.closest(".modal-overlay")
            if (overlay && e.target === overlay && !overlay.dataset.modalStatic) {
                if (overlay.id === "settings-modal") {
                    this.requestCloseSettingsModal()
                } else {
                    this.closeModal(overlay.id)
                }
            }
        })

        if (this.els.sidebarOverlay) {
            this.els.sidebarOverlay.addEventListener("click", () => this.toggleSidebar(false))
        }
        if (this.els.folderList) {
            this.els.folderList.addEventListener("dragstart", event => {
                const folderElement = event.target.closest("[data-folder-draggable='true']")
                if (!folderElement) return
                this.draggedFolderId = folderElement.dataset.folderId
            })
            this.els.folderList.addEventListener("dragover", event => {
                if (!this.draggedFolderId) return
                const targetElement = event.target.closest("[data-folder-draggable='true']")
                if (!targetElement || targetElement.dataset.folderId === this.draggedFolderId) return
                event.preventDefault()
            })
            this.els.folderList.addEventListener("drop", event => {
                if (!this.draggedFolderId) return
                const targetElement = event.target.closest("[data-folder-draggable='true']")
                if (!targetElement) return
                event.preventDefault()
                this.reorderFolders(this.draggedFolderId, targetElement.dataset.folderId)
                this.draggedFolderId = null
            })
            this.els.folderList.addEventListener("dragend", () => {
                this.draggedFolderId = null
            })
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.els.sidebar?.classList.contains("active")) {
                this.toggleSidebar(false)
            }
        })

        document.querySelectorAll(".star").forEach(star => {
            star.addEventListener("click", () => {
                const val = parseInt(star.dataset.val, 10)
                StateActions.setTempRating(val)
                document.querySelectorAll(".star").forEach(s => {
                    const v = parseInt(s.dataset.val, 10)
                    s.textContent = v <= val ? "star" : "star_border"
                    s.classList.toggle("active", v <= val)
                })
            })
        })

        const promptInput = document.getElementById("prompt-input")
        if (promptInput) {
            promptInput.onkeydown = (e) => {
                if (e.key === "Enter") document.getElementById("prompt-ok")?.click()
            }
        }

        const search = document.getElementById("search-input")
        if (search) {
            search.addEventListener("input", (e) => {
                filterAndRender(e.target.value)
            })
        }

        if (this.els.filterSort) {
            this.els.filterSort.addEventListener("change", event => {
                const safeSortValue = window.DomSecurity.sanitizeInputValue(event.target.value, "updated")
                this.updateFilterConfig({ sort: safeSortValue })
            })
        }

        if (this.els.filterFolders) {
            this.els.filterFolders.addEventListener("change", (e) => {
                const input = e.target.closest("input[type='checkbox']")
                if (!input) return
                const selected = this.readFolderFilterSelection()
                this.updateFilterConfig({ folders: selected })
            })
        }

        this.els.grid?.addEventListener("click", async (e) => {
            const action = e.target.closest(".action-btn")
            if (action) return
            if (this.els.userMenu?.classList.contains("active")) return
            const card = e.target.closest(".note-card")
            if (!card) return
            const id = card.dataset.noteId ? decodeURIComponent(card.dataset.noteId) : null
            const note = StateStore.read().notes.find(n => n.id === id)
            if (note) await window.SmartNotesEditor?.openFromList?.(note)
        })

        this.els.grid?.addEventListener("dragstart", (e) => {
            const card = e.target.closest(".note-card")
            if (!card) return
            if (StateStore.read().searchQuery.trim()) {
                e.preventDefault()
                this.showToast(this.getText("reorder_search_disabled", "Reordering is disabled while searching"))
                return
            }
            this.draggedNoteId = decodeURIComponent(card.dataset.noteId)
            card.classList.add("dragging")
            e.dataTransfer.effectAllowed = "move"
            e.dataTransfer.setData("text/plain", this.draggedNoteId)
        })

        this.els.grid?.addEventListener("dragover", (e) => {
            if (!this.draggedNoteId) return
            e.preventDefault()
            const card = e.target.closest(".note-card")
            if (!card) return
            const targetId = decodeURIComponent(card.dataset.noteId)
            if (!targetId || targetId === this.draggedNoteId) return
            const rect = card.getBoundingClientRect()
            const before = e.clientY < rect.top + rect.height / 2
            this.dragTargetId = targetId
            this.dragPosition = before ? "before" : "after"
            this.setDropIndicator(card, this.dragPosition)
            this.autoScroll(e.clientY)
        })

        this.els.grid?.addEventListener("drop", (e) => {
            if (!this.draggedNoteId || !this.dragTargetId) return
            e.preventDefault()
            this.reorderNotes(this.draggedNoteId, this.dragTargetId, this.dragPosition)
            this.clearDragIndicators()
        })

        this.els.grid?.addEventListener("dragend", (e) => {
            const card = e.target.closest(".note-card")
            if (card) card.classList.remove("dragging")
            this.clearDragIndicators()
            this.draggedNoteId = null
        })

        const noteImport = document.getElementById("note-import")
        if (noteImport) noteImport.addEventListener("change", (e) => this.handleNoteImport(e))
    },

    readFolderFilterSelection() {
        const selected = []
        this.els.filterFolders?.querySelectorAll("input[type='checkbox']").forEach(input => {
            const safeInputValue = window.DomSecurity.sanitizeIdentifier(input.value)
            if (input.checked && safeInputValue) selected.push(safeInputValue)
        })
        return selected
    },

    updateFilterConfig(next) {
        const current = StateStore.read().config.notesFilter || { sort: "manual", folders: [] }
        const updated = { ...current, ...next }
        StateActions.updateConfig({ notesFilter: updated })
        SafeStorage.local.setJson("notes-filter", updated)
        filterAndRender(document.getElementById("search-input")?.value || "")
        this.renderFilterMenu()
    },

    renderFilterMenu() {
        if (!this.els.filterFolders || !this.els.filterSort) return
        const { folders, config, view } = StateStore.read()
        const current = config.notesFilter || { sort: "manual", folders: [] }
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



    handleAction(el, e) {
        const action = el.dataset.action
        if (!action) return

        const stopFor = new Set(["note-pin", "note-favorite", "note-menu", "rename-active-folder", "toggle-active-folder-menu", "toggle-active-folder-hidden", "delete-active-folder"])
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
            case "settings-cancel":
                this.cancelSettingsDraft()
                break
            case "close-settings-modal":
                this.requestCloseSettingsModal()
                break
            case "trigger-admin-full-analysis":
                this.triggerFullAnalysisForAllUsers()
                break
            case "install-app":
                this.installApplication()
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
            case "load-more-notes":
                e.preventDefault()
                window.loadMoreNotes?.()
                break
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
                const noteId = StateStore.read().currentNote?.id
                if (noteId) openNoteActions(noteId)
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
                openNoteActions(decodeURIComponent(el.dataset.noteId || ""))
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
