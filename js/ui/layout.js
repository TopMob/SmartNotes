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

    normalizeImportedDate(inputValue) {
        const timestampType = firebase?.firestore?.Timestamp
        if (timestampType && typeof inputValue?.toDate === "function") return inputValue
        if (timestampType && inputValue && typeof inputValue === "object" && Number.isFinite(inputValue.seconds)) {
            return timestampType.fromMillis(inputValue.seconds * 1000)
        }
        if (timestampType && typeof inputValue === "number" && Number.isFinite(inputValue)) {
            return timestampType.fromMillis(inputValue)
        }
        if (timestampType && typeof inputValue === "string") {
            const parsedDate = new Date(inputValue)
            if (Number.isFinite(parsedDate.getTime())) {
                return timestampType.fromDate(parsedDate)
            }
        }
        if (inputValue instanceof Date && Number.isFinite(inputValue.getTime()) && timestampType) {
            return timestampType.fromDate(inputValue)
        }
        return firebase.firestore.FieldValue.serverTimestamp()
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
        const sourceNote = rawNote && typeof rawNote === "object" ? rawNote : {}
        return {
            id: Utils.generateId(),
            title: String(sourceNote.title || "").trim(),
            content: String(sourceNote.content || ""),
            tags: this.normalizeImportedTags(sourceNote.tags),
            createdAt: this.normalizeImportedDate(sourceNote.createdAt),
            updatedAt: this.normalizeImportedDate(sourceNote.updatedAt),
            ownerUid: String(ownerUid || ""),
            analyzed: false,
            aiProcessed: false,
            folderId: null,
            hiddenTags: [],
            relevance: null
        }
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
            try {
                const text = String(reader.result || "").replace(/^﻿/, "")
                const parsed = JSON.parse(text)
                const importedNotes = NoteIO.parseImport(parsed)
                if (!importedNotes.length) {
                    this.showToast(this.getText("import_empty", "No notes found"))
                    return
                }
                const current = StateStore.read()
                const batch = db.batch()
                importedNotes.forEach(note => {
                    const importedNote = this.buildImportedNote({
                        title: note?.title,
                        content: note?.content,
                        tags: note?.tags,
                        createdAt: note?.createdAt,
                        updatedAt: note?.updatedAt
                    }, current.user.uid)
                    const reference = DataPath.getUserNotesCollection(current.user).doc(importedNote.id)
                    batch.set(reference, importedNote, { merge: true })
                })
                await batch.commit()
                this.showToast(this.getText("import_success", "Imported"))
            } catch {
                this.showToast(this.getText("import_failed", "Import failed"))
            }
        }
        reader.onerror = () => this.showToast(this.getText("import_failed", "Import failed"))
        reader.readAsText(file, "utf-8")
    },

    primaryAction() {
        if (StateStore.read().view === "folders") {
            this.createFolder()
            return
        }
        window.SmartNotesEditor?.open()
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
            await DataPath.getUserFoldersCollection(StateStore.read().user).add({
                name: validatedName,
                description: validatedDescription,
                isHidden: false,
                trashedAt: null,
                folderOrder: Date.now(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                ownerUid: StateStore.read().user.uid
            })
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
        const saved = SafeStorage.local.getJson("app-preferences") || {}
        StateActions.updateConfig({
            folderViewMode: saved.folderViewMode || StateStore.read().config.folderViewMode,
            reduceMotion: !!saved.reduceMotion
        })
        ThemeManager.revertToLastSaved()
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
            admin_tools: dict.admin_tools || "Admin tools"
        }
        const { view, activeFolderId, folders } = StateStore.read()
        let title = titles[view] || "SmartNotes"
        if (view === "folder" && activeFolderId) {
            const folder = folders.find(f => f.id === activeFolderId)
            if (folder) title = folder.name
        }
        const el = document.getElementById("current-view-title")
        if (el) el.textContent = title
        this.updateActiveFolderMenu()
        this.updateFolderLimitControls()
        this.updateAdminToolsNavigationVisibility()
    },

    updatePrimaryActionLabel() {
        if (!this.els.fab) return
        const label = StateStore.read().view === "folders" ? this.getText("create_folder", "Create folder") : this.getText("create_note", "Create note")
        this.els.fab.setAttribute("aria-label", label)
        this.updateActiveFolderMenu()
        this.updateFolderLimitControls()
        this.updateAdminToolsNavigationVisibility()
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
        return "https://backendfornmartnotes.vercel.app/api/analyze"
    },

    async requestAnalysis({ secretToken = "", requestVariant = "pending" } = {}) {
        const requestHeaders = {
            "Content-Type": "application/json"
        }
        if (secretToken) {
            requestHeaders["x-secret"] = secretToken
        }

        let endpoint = this.getAnalysisApiEndpoint()
        let requestBody = {}

        if (requestVariant === "reindex_query") {
            endpoint = `${endpoint}?reindexAll=true`
            requestBody = null
        } else if (requestVariant === "reindex_body") {
            requestBody = { reindexAll: true }
        } else if (requestVariant === "reindex_force") {
            requestBody = { forceReindex: true }
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

    renderAdminToolsView() {
        const root = this.els.grid
        if (!root) return
        this.els.empty.classList.add("hidden")
        this.els.grid.classList.remove("folder-grid")
        const actionCard = document.createElement("div")
        actionCard.className = "note-card"

        const title = document.createElement("h3")
        window.DomSecurity.setText(title, this.getText("admin_tools", "Админ-меню"))

        const description = document.createElement("p")
        window.DomSecurity.setText(description, this.getText("analysis_admin_description", "Запуск серверного анализа заметок"))

        const actions = [
            { key: "pending", className: "btn-primary", action: "trigger-admin-analysis-pending", labelKey: "analysis_pending_reindex_button", fallback: "Проиндексировать непроиндексированные" },
            { key: "reindex_query", className: "btn-secondary", action: "trigger-admin-analysis-reindex-query", labelKey: "analysis_reindex_query_button", fallback: "Полная переиндексация через query-параметр" },
            { key: "reindex_body", className: "btn-secondary", action: "trigger-admin-analysis-reindex-body", labelKey: "analysis_reindex_body_button", fallback: "Полная переиндексация через body reindexAll" },
            { key: "reindex_force", className: "btn-secondary", action: "trigger-admin-analysis-reindex-force", labelKey: "analysis_force_reindex_button", fallback: "Полная переиндексация через body forceReindex" }
        ]

        const buttonsContainer = document.createElement("div")
        buttonsContainer.style.display = "grid"
        buttonsContainer.style.gridTemplateColumns = "1fr"
        buttonsContainer.style.gap = "10px"
        buttonsContainer.style.marginTop = "10px"

        actions.forEach(actionConfig => {
            const actionButton = document.createElement("button")
            actionButton.type = "button"
            actionButton.className = actionConfig.className
            actionButton.dataset.action = actionConfig.action
            actionButton.dataset.analysisVariant = actionConfig.key
            window.DomSecurity.setText(actionButton, this.getText(actionConfig.labelKey, actionConfig.fallback))
            buttonsContainer.append(actionButton)
        })

        actionCard.append(title, description, buttonsContainer)
        root.replaceChildren(actionCard)
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
        const initialLabel = triggerButton ? triggerButton.textContent : ""
        if (triggerButton) {
            triggerButton.disabled = true
            triggerButton.setAttribute("aria-busy", "true")
            window.DomSecurity.setText(triggerButton, this.getText("loading", "Loading..."))
        }
        try {
            await this.requestAnalysis({ secretToken, requestVariant: analysisVariant })
            this.showToast(this.getText("analysis_request_sent", "Запрос отправлен. Анализ выполнится на стороне сервера"))
        } catch {
            this.showToast(this.getText("analysis_failed", "Не удалось выполнить ИИ-анализ"))
        } finally {
            if (triggerButton) {
                triggerButton.disabled = false
                triggerButton.setAttribute("aria-busy", "false")
                window.DomSecurity.setText(triggerButton, initialLabel || this.getText("analysis_pending_reindex_button", "Проиндексировать непроиндексированные"))
            }
        }
    },

    updateActiveFolderMenu() {
        const wrapper = this.els.activeFolderMenuWrapper
        const hideLabel = this.els.activeFolderHideButton?.querySelector("span")
        const hideIcon = this.els.activeFolderHideButton?.querySelector("i")
        if (!wrapper) return
        const { view, activeFolderId, folders } = StateStore.read()
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
})
