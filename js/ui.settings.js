Object.assign(UI, {
    openModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.add("active")
        this.toggleSidebar(false)
        if (id === "poll-modal") {
            this.startSurvey()
        }
        if (id === "lock-center-modal") {
            this.renderLockCenter()
        }
    },

    closeModal(id) {
        const el = document.getElementById(id)
        if (!el) return
        el.classList.remove("active")
        if (id === "settings-modal") {
            ThemeManager.revertToLastSaved()
            StateStore.update("appearanceDraft", null)
        }
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
            const hasSecretPresets = this.hasSecretPresetAccess()
            root.innerHTML = `
                <div class="settings-group">
                    <div class="field">
                        <span class="field-label">${dict.presets || "Presets"}</span>
                        <div id="theme-picker-root" class="settings-theme-grid"></div>
                    </div>
                    ${hasSecretPresets ? `
                    <div class="field">
                        <span class="field-label">${dict.hidden_presets || "Hidden presets"}</span>
                        <div id="hidden-presets-root" class="hidden-presets-root"></div>
                    </div>
                    ` : ""}
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
            if (hasSecretPresets) this.renderHiddenPresets()
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
            StateStore.update("appearanceDraft", {
                preset: saved.preset,
                p: saved.p || preset.p,
                bg: saved.bg || preset.bg,
                t: saved.t || preset.t,
                brandName: saved.brandName || "SmartNotes",
                basePreset: saved.basePreset || "dark"
            })
            return
        }
        StateStore.update("appearanceDraft", {
            preset: "manual",
            p: saved.p || ThemeManager.themes.dark.p,
            bg: saved.bg || ThemeManager.themes.dark.bg,
            t: saved.t || ThemeManager.themes.dark.t,
            brandName: saved.brandName || "SmartNotes",
            basePreset: saved.basePreset || "dark"
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
                nextDraft = {
                    ...draft,
                    preset: "manual",
                    brandName: "SmartNotes",
                    basePreset: "dark"
                }
            } else {
                const preset = ThemeManager.resolvePreset(key)
                nextDraft = {
                    preset: key,
                    p: preset.p,
                    bg: preset.bg,
                    t: preset.t,
                    brandName: "SmartNotes",
                    basePreset: key
                }
            }
            this.applyAppearanceDraft(nextDraft)
        }
        ThemeManager.renderPicker({ onSelect, activeKey, manualColor: draft.p })
        ThemeManager.setupColorInputs((type, val) => {
            const current = StateStore.read().appearanceDraft || draft
            const next = { ...current, preset: "manual", [type]: val }
            StateStore.update("appearanceDraft", next)
            ThemeManager.applySettings(next, false)
            ThemeManager.renderPicker({ onSelect, activeKey: "manual", manualColor: next.p })
            if (this.hasSecretPresetAccess()) this.renderHiddenPresets()
        })
    },

    hasSecretPresetAccess() {
        const folders = StateStore.read().folders || []
        return folders.some(folder => String(folder.name || "").trim() === "67")
    },

    getHiddenPresetGroups() {
        const lang = StateStore.read().config.lang || "ru"
        const pick = (label) => label[lang] || label.ru || label.en || ""
        return [
            {
                id: "hidden-anime",
                title: pick({ ru: "Аниме", en: "Anime" }),
                items: [
                    { key: "anime_taiga", label: pick({ ru: "Тайга", en: "Taiga" }) },
                    { key: "anime_asuka", label: pick({ ru: "Аска", en: "Asuka" }) },
                    { key: "anime_asuna", label: pick({ ru: "Асуна", en: "Asuna" }) },
                    { key: "anime_rei", label: pick({ ru: "Аянами рей", en: "Ayanami Rei" }) },
                    { key: "anime_oshi_no_ko", label: pick({ ru: "звёздное дитя", en: "Oshi no Ko" }) },
                    { key: "anime_healer_mage", label: pick({ ru: "маг целитель", en: "Healer Mage" }) },
                    { key: "anime_rem", label: pick({ ru: "Рем", en: "Rem" }) },
                    { key: "anime_zero", label: pick({ ru: "Zero", en: "Zero" }) },
                    { key: "anime_emilia", label: pick({ ru: "Эмилия", en: "Emilia" }) },
                    { key: "anime_nezuko", label: pick({ ru: "Нэдзуко", en: "Nezuko" }) },
                    { key: "anime_mai", label: pick({ ru: "Май Сакурадзима", en: "Mai Sakurajima" }) },
                    { key: "anime_hinata", label: pick({ ru: "Хината Хьюга", en: "Hinata Hyuga" }) },
                    { key: "anime_monika", label: pick({ ru: "моника", en: "Monika" }) },
                    { key: "anime_helltaker", label: pick({ ru: "хелтейкер", en: "Helltaker" }) },
                    { key: "anime_yor", label: pick({ ru: "Йор", en: "Yor" }) },
                    { key: "anime_power", label: pick({ ru: "пауер", en: "Power" }) },
                    { key: "anime_megumin", label: pick({ ru: "Мегумин", en: "Megumin" }) },
                    { key: "anime_toru", label: pick({ ru: "Тору", en: "Tohru" }) },
                    { key: "anime_nobara", label: pick({ ru: "Нобара Кугисаки", en: "Nobara Kugisaki" }) },
                    { key: "anime_casca", label: pick({ ru: "Каска(берсерк)", en: "Casca" }) },
                    { key: "anime_misa", label: pick({ ru: "Миса Аманэ", en: "Misa Amane" }) }
                ]
            },
            {
                id: "hidden-games",
                title: pick({ ru: "Игры", en: "Games" }),
                items: [
                    { key: "game_zzz", label: pick({ ru: "ZZZ", en: "ZZZ" }) },
                    { key: "game_dark_souls", label: pick({ ru: "блексоулс", en: "Dark Souls" }) },
                    { key: "game_minecraft", label: pick({ ru: "minecraft", en: "Minecraft" }) },
                    { key: "game_dota", label: pick({ ru: "dota", en: "Dota" }) },
                    { key: "game_cs", label: pick({ ru: "cs", en: "CS" }) },
                    { key: "game_fortnite", label: pick({ ru: "fortnite", en: "Fortnite" }) }
                ]
            },
            {
                id: "hidden-apps",
                title: pick({ ru: "Приложения", en: "Apps" }),
                items: [
                    { key: "app_smartlib", label: pick({ ru: "SmartLib", en: "SmartLib" }) }
                ]
            },
            {
                id: "hidden-windows",
                title: pick({ ru: "Винда", en: "Windows" }),
                items: [
                    { key: "windows_classic", label: pick({ ru: "SmartWin", en: "SmartWin" }) }
                ]
            },
            {
                id: "hidden-sites",
                title: pick({ ru: "Сайты", en: "Sites" }),
                items: [
                    { key: "site_smarthub", label: pick({ ru: "SmartHub", en: "SmartHub" }) }
                ]
            },
            {
                id: "hidden-classic",
                title: pick({ ru: "Обычные", en: "Classic" }),
                items: [
                    { key: "cyber_edge", label: pick({ ru: "КИБЕРПАНК БЕГУЩИЕ ПО КРАЮ", en: "Cyberpunk Edge Runners" }) },
                    { key: "lego_world", label: pick({ ru: "Лего", en: "Lego" }) }
                ]
            }
        ]
    },

    applyAppearanceDraft(nextDraft) {
        StateStore.update("appearanceDraft", nextDraft)
        ThemeManager.applySettings(nextDraft, false)
        this.renderAppearanceDraft()
        if (this.hasSecretPresetAccess()) this.renderHiddenPresets()
    },

    buildHiddenPresetDraft(preset, presetKey) {
        return {
            preset: presetKey,
            p: preset.p,
            bg: preset.bg,
            t: preset.t,
            brandName: preset.brandName || "SmartNotes",
            basePreset: preset.basePreset || "dark"
        }
    },

    renderHiddenPresets() {
        const root = document.getElementById("hidden-presets-root")
        if (!root) return
        const groups = this.getHiddenPresetGroups()
        if (!groups.length) return
        const draft = StateStore.read().appearanceDraft || ThemeManager.getSavedSettings()
        const activeTab = this.hiddenPresetTab && groups.some(group => group.id === this.hiddenPresetTab)
            ? this.hiddenPresetTab
            : groups[0].id
        this.hiddenPresetTab = activeTab
        root.innerHTML = ""
        const tabs = document.createElement("div")
        tabs.className = "hidden-presets-tabs"
        groups.forEach(group => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "hidden-presets-tab"
            if (group.id === activeTab) button.classList.add("active")
            button.textContent = group.title
            button.addEventListener("click", () => {
                this.hiddenPresetTab = group.id
                this.renderHiddenPresets()
            })
            tabs.appendChild(button)
        })
        root.appendChild(tabs)
        const activeGroup = groups.find(group => group.id === activeTab)
        if (!activeGroup) return
        const grid = document.createElement("div")
        grid.className = "hidden-presets-grid"
        activeGroup.items.forEach(item => {
            const preset = HiddenPresets[item.key]
            if (!preset) return
            const button = document.createElement("button")
            button.type = "button"
            button.className = "hidden-preset-item"
            if (draft?.preset === item.key) button.classList.add("active")
            button.textContent = item.label
            button.addEventListener("click", () => {
                this.applyAppearanceDraft(this.buildHiddenPresetDraft(preset, item.key))
            })
            grid.appendChild(button)
        })
        root.appendChild(grid)
    },

    resetAppearanceDraft() {
        const defaults = ThemeManager.getDefaultSettings()
        let draft = null
        if (defaults.preset && defaults.preset !== "manual") {
            const preset = ThemeManager.resolvePreset(defaults.preset)
            draft = { preset: defaults.preset, p: preset.p, bg: preset.bg, t: preset.t }
        } else {
            draft = {
                preset: "manual",
                p: ThemeManager.themes.dark.p,
                bg: ThemeManager.themes.dark.bg,
                t: ThemeManager.themes.dark.t
            }
        }
        StateStore.update("appearanceDraft", draft)
        ThemeManager.applySettings(draft, false)
        this.renderAppearanceDraft()
    },

    saveAppearanceDraft() {
        const draft = StateStore.read().appearanceDraft
        if (!draft) return
        ThemeManager.applySettings(draft, true)
        this.initAppearanceDraft()
        this.renderAppearanceDraft()
        this.closeModal("settings-modal")
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

    showPrompt(title, placeholder, cb, value = "") {
        const modal = this.els.promptModal
        const input = document.getElementById("prompt-input")
        const ok = document.getElementById("prompt-ok")
        const cancel = document.getElementById("prompt-cancel")
        const titleEl = document.getElementById("prompt-title")

        if (titleEl) titleEl.textContent = title
        input.value = value
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
