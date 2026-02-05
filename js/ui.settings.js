Object.assign(UI, {
    openModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.add("active")
        this.toggleSidebar(false)
        if (id === "share-modal") {
            const link = document.getElementById("share-link")
            const n = StateStore.read().currentNote
            if (link && n) link.value = ShareService.makeShareLink(n.id)
        }
        if (id === "collab-modal") {
            const link = document.getElementById("collab-link")
            const n = StateStore.read().currentNote
            if (link && n) link.value = ShareService.makeCollabLink(n.id)
        }
        if (id === "lock-center-modal") {
            this.renderLockCenter()
        }
    },

    closeModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.remove("active")
    },

    openSettings() {
        this.settingsPage = null
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
                    <button type="button" class="settings-menu-item" data-action="open-settings-page" data-page="editor_tools">
                        <div class="settings-menu-meta">
                            <span class="settings-menu-title">${dict.settings_editor_tools || "Editor Tools"}</span>
                            <span class="settings-menu-desc">${dict.settings_category_editor_tools_desc || ""}</span>
                        </div>
                        <i class="material-icons-round" aria-hidden="true">chevron_right</i>
                    </button>
                </div>
            `
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
                        <label class="row-left">
                            <input type="checkbox" id="settings-reduce-motion" aria-label="${dict.reduce_motion || "Reduce motion"}">
                            <span>${dict.reduce_motion || "Reduce motion"}</span>
                        </label>
                    </div>
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
                                <input type="color" id="cp-primary" class="color-input" aria-label="${dict.color_accent || "Accent color"}">
                            </label>
                            <label class="field">
                                <span class="field-label">${dict.c_bg || "Background"}</span>
                                <input type="color" id="cp-bg" class="color-input" aria-label="${dict.color_bg || "Background color"}">
                            </label>
                            <label class="field">
                                <span class="field-label">${dict.c_text || "Text"}</span>
                                <input type="color" id="cp-text" class="color-input" aria-label="${dict.color_text || "Text color"}">
                            </label>
                        </div>
                    </div>
                </div>
                <div class="settings-actions row-between">
                    <button type="button" class="btn-secondary" data-action="appearance-reset">${dict.reset || "Reset"}</button>
                    <button type="button" class="btn-primary" data-action="appearance-save">${dict.save || "Save"}</button>
                </div>
            `
            this.initAppearanceDraft()
            this.renderAppearanceDraft()
            return
        }

        if (page === "editor_tools") {
            title.textContent = dict.settings_editor_tools || dict.editor_settings || "Editor tools"
            root.innerHTML = `<div id="editor-tools-list" class="settings-toggle-list"></div>`
            this.renderEditorSettings()
        }
    },

    initAppearanceDraft() {
        const saved = ThemeManager.getSavedSettings()
        if (saved.preset && saved.preset !== "manual") {
            const preset = ThemeManager.resolvePreset(saved.preset)
            StateStore.update("appearanceDraft", { preset: saved.preset, p: preset.p, bg: preset.bg, t: preset.t })
            return
        }
        StateStore.update("appearanceDraft", {
            preset: "manual",
            p: saved.p || ThemeManager.themes.dark.p,
            bg: saved.bg || ThemeManager.themes.dark.bg,
            t: saved.t || ThemeManager.themes.dark.t
        })
    },

    renderAppearanceDraft() {
        let draft = StateStore.read().appearanceDraft || ThemeManager.getSavedSettings()
        if (draft.preset && draft.preset !== "manual" && (!draft.p || !draft.bg || !draft.t)) {
            const preset = ThemeManager.resolvePreset(draft.preset)
            draft = { ...draft, p: preset.p, bg: preset.bg, t: preset.t }
            StateStore.update("appearanceDraft", draft)
        }
        const activeKey = draft.preset && draft.preset !== "manual" ? draft.preset : "manual"
        ThemeManager.syncInputs(draft.p, draft.bg, draft.t)
        const onSelect = (key) => {
            let nextDraft = null
            if (key === "manual") {
                nextDraft = { ...draft, preset: "manual" }
            } else {
                const preset = ThemeManager.resolvePreset(key)
                nextDraft = { preset: key, p: preset.p, bg: preset.bg, t: preset.t }
            }
            StateStore.update("appearanceDraft", nextDraft)
            ThemeManager.applySettings(nextDraft, false)
            this.renderAppearanceDraft()
        }
        ThemeManager.renderPicker({ onSelect, activeKey, manualColor: draft.p })
        ThemeManager.setupColorInputs((type, val) => {
            const current = StateStore.read().appearanceDraft || draft
            const next = { ...current, preset: "manual", [type]: val }
            StateStore.update("appearanceDraft", next)
            ThemeManager.applySettings(next, false)
            ThemeManager.renderPicker({ onSelect, activeKey: "manual", manualColor: next.p })
        })
    },

    resetAppearanceDraft() {
        const defaults = ThemeManager.getDefaultSettings()
        if (defaults.preset && defaults.preset !== "manual") {
            const preset = ThemeManager.resolvePreset(defaults.preset)
            StateStore.update("appearanceDraft", { preset: defaults.preset, p: preset.p, bg: preset.bg, t: preset.t })
        } else {
            StateStore.update("appearanceDraft", {
                preset: "manual",
                p: ThemeManager.themes.dark.p,
                bg: ThemeManager.themes.dark.bg,
                t: ThemeManager.themes.dark.t
            })
        }
        this.renderAppearanceDraft()
    },

    saveAppearanceDraft() {
        const draft = StateStore.read().appearanceDraft
        if (!draft) return
        ThemeManager.applySettings(draft, true)
        this.initAppearanceDraft()
        this.renderAppearanceDraft()
    },

    bindSettingsControls() {
        const langSelect = document.getElementById("settings-language")
        if (langSelect) {
            langSelect.addEventListener("change", (e) => {
                this.setLang(e.target.value)
            })
        }

        const folderSelect = document.getElementById("settings-folder-view")
        if (folderSelect) {
            folderSelect.addEventListener("change", (e) => {
                const next = e.target.value === "full" ? "full" : "compact"
                StateActions.updateConfig({ folderViewMode: next })
                this.savePreferences()
                this.renderFolders()
                filterAndRender(document.getElementById("search-input")?.value || "")
            })
        }

        const reduceToggle = document.getElementById("settings-reduce-motion")
        if (reduceToggle) {
            reduceToggle.addEventListener("change", (e) => {
                StateActions.updateConfig({ reduceMotion: !!e.target.checked })
                this.savePreferences()
                ThemeManager.revertToLastSaved()
            })
        }
    },

    showToast(msg, options = {}) {
        const div = document.createElement("div")
        div.className = "toast show"
        div.setAttribute("role", "status")
        const text = document.createElement("span")
        text.textContent = msg
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
            delete_f: this.getText("confirm_delete_folder", "Delete folder?")
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

    showPrompt(title, placeholder, cb) {
        const modal = this.els.promptModal
        const input = document.getElementById("prompt-input")
        const ok = document.getElementById("prompt-ok")
        const cancel = document.getElementById("prompt-cancel")
        const titleEl = document.getElementById("prompt-title")

        if (titleEl) titleEl.textContent = title
        input.value = ""
        input.placeholder = placeholder

        const finish = (val) => {
            if (val) cb(val)
            modal.classList.remove("active")
            input.onkeydown = null
        }

        const okClone = ok.cloneNode(true)
        ok.parentNode.replaceChild(okClone, ok)

        const cancelClone = cancel.cloneNode(true)
        cancel.parentNode.replaceChild(cancelClone, cancel)

        okClone.onclick = () => finish(String(input.value || "").trim())
        cancelClone.onclick = () => modal.classList.remove("active")

        modal.classList.add("active")
        setTimeout(() => input.focus(), 80)
    },

    syncSettingsUI() {
        const langSelect = document.getElementById("settings-language")
        if (langSelect) langSelect.value = StateStore.read().config.lang === "en" ? "en" : "ru"
        const folderSelect = document.getElementById("settings-folder-view")
        if (folderSelect) folderSelect.value = StateStore.read().config.folderViewMode === "full" ? "full" : "compact"
        const reduceToggle = document.getElementById("settings-reduce-motion")
        if (reduceToggle) reduceToggle.checked = !!StateStore.read().config.reduceMotion
    },

    renderEditorSettings() {
        const root = document.getElementById("editor-tools-list")
        if (!root || typeof Editor === "undefined") return
        const tools = Editor.getToolList()
        const enabled = Editor.getEnabledTools()
        root.innerHTML = ""
        tools.forEach(tool => {
            const row = document.createElement("div")
            row.className = "settings-toggle-item"
            
            const label = document.createElement("span")
            label.textContent = this.getText(tool.label, tool.label)
            
            // Создаем структуру переключателя (Toggle Switch)
            const labelSwitch = document.createElement("label")
            labelSwitch.className = "switch"
            
            const input = document.createElement("input")
            input.type = "checkbox"
            input.checked = enabled[tool.id] !== false
            input.setAttribute("aria-label", label.textContent)
            input.addEventListener("change", () => {
                Editor.setToolEnabled(tool.id, input.checked)
            })
            
            const slider = document.createElement("span")
            slider.className = "slider"
            
            labelSwitch.append(input, slider)
            row.append(label, labelSwitch)
            root.appendChild(row)
        })
    }
})
