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
                        <div class="settings-toggle-item">
                            <span>${dict.reduce_motion || "Reduce motion"}</span>
                            <label class="switch">
                                <input type="checkbox" id="settings-reduce-motion" aria-label="${dict.reduce_motion || "Reduce motion"}">
                                <span class="slider"></span>
                            </label>
                        </div>
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
                                            <input type="text" class="color-picker-hex" data-color-hex maxlength="7" aria-label="HEX" autocomplete="off">
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
                                            <input type="text" class="color-picker-hex" data-color-hex maxlength="7" aria-label="HEX" autocomplete="off">
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
                                            <input type="text" class="color-picker-hex" data-color-hex maxlength="7" aria-label="HEX" autocomplete="off">
                                        </div>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">${dict.settings_backgrounds || "Backgrounds"}</div>
                        <div class="settings-background-grid">
                            <div class="field">
                                <span class="field-label">${dict.settings_main_background || "Main screen background"}</span>
                                <input type="text" class="input-area" data-appearance-bg-input="main" placeholder="${dict.settings_background_placeholder || "Image URL or data"}" aria-label="${dict.settings_main_background || "Main screen background"}" autocomplete="off">
                                <div class="settings-background-actions">
                                    <input type="file" class="input-area" data-appearance-bg-file="main" accept="image/*" aria-label="${dict.settings_background_upload || "Upload background image"}">
                                    <button type="button" class="btn-secondary" data-appearance-bg-clear="main">${dict.clear || "Clear"}</button>
                                </div>
                            </div>
                            <div class="field">
                                <span class="field-label">${dict.settings_sidebar_background || "Sidebar background"}</span>
                                <input type="text" class="input-area" data-appearance-bg-input="sidebar" placeholder="${dict.settings_background_placeholder || "Image URL or data"}" aria-label="${dict.settings_sidebar_background || "Sidebar background"}" autocomplete="off">
                                <div class="settings-background-actions">
                                    <input type="file" class="input-area" data-appearance-bg-file="sidebar" accept="image/*" aria-label="${dict.settings_background_upload || "Upload background image"}">
                                    <button type="button" class="btn-secondary" data-appearance-bg-clear="sidebar">${dict.clear || "Clear"}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="settings-actions row-between">
                    <button type="button" class="btn-secondary" data-action="appearance-reset">${dict.reset || "Reset"}</button>
                    <button type="button" class="btn-primary" data-action="appearance-save">${dict.save || "Save"}</button>
                </div>
            `
            if (typeof ColorPalette !== "undefined") ColorPalette.init(root)
            this.initAppearanceDraft()
            this.bindAppearanceBackgroundControls(root)
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
            StateStore.update("appearanceDraft", {
                preset: saved.preset,
                p: saved.p || preset.p,
                bg: saved.bg || preset.bg,
                t: saved.t || preset.t,
                brandName: saved.brandName || "SmartNotes",
                basePreset: saved.basePreset || "oled",
                mainBackgroundImage: saved.mainBackgroundImage || "",
                sidebarBackgroundImage: saved.sidebarBackgroundImage || ""
            })
            return
        }
        StateStore.update("appearanceDraft", {
            preset: "manual",
            p: saved.p || ThemeManager.themes.oled.p,
            bg: saved.bg || ThemeManager.themes.oled.bg,
            t: saved.t || ThemeManager.themes.oled.t,
            brandName: saved.brandName || "SmartNotes",
            basePreset: saved.basePreset || "oled",
            mainBackgroundImage: saved.mainBackgroundImage || "",
            sidebarBackgroundImage: saved.sidebarBackgroundImage || ""
        })
    },

    renderAppearanceDraft() {
        let draft = StateStore.read().appearanceDraft || ThemeManager.getSavedSettings()
        if (draft.preset && draft.preset !== "manual" && (!draft.p || !draft.bg || !draft.t)) {
            const preset = ThemeManager.resolvePreset(draft.preset)
            draft = { ...draft, p: preset.p, bg: preset.bg, t: preset.t }
            StateStore.update("appearanceDraft", draft)
        }
        const normalizedDraft = {
            ...draft,
            mainBackgroundImage: typeof draft.mainBackgroundImage === "string" ? draft.mainBackgroundImage : "",
            sidebarBackgroundImage: typeof draft.sidebarBackgroundImage === "string" ? draft.sidebarBackgroundImage : ""
        }
        if (normalizedDraft.mainBackgroundImage !== draft.mainBackgroundImage || normalizedDraft.sidebarBackgroundImage !== draft.sidebarBackgroundImage) {
            draft = normalizedDraft
            StateStore.update("appearanceDraft", draft)
        }
        const activeKey = draft.preset && draft.preset !== "manual" ? draft.preset : "manual"
        ThemeManager.syncInputs(draft.p, draft.bg, draft.t)
        this.syncAppearanceBackgroundInputs(draft)
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
                    mainBackgroundImage: customPreset ? customPreset.mainBackgroundImage : (draft.mainBackgroundImage || ""),
                    sidebarBackgroundImage: customPreset ? customPreset.sidebarBackgroundImage : (draft.sidebarBackgroundImage || "")
                }
            }
            this.applyAppearanceDraft(nextDraft)
        }
        const onCreateCustomPreset = () => {
            const currentDraft = StateStore.read().appearanceDraft || draft
            const result = ThemeManager.addCustomPreset(currentDraft)
            if (!result.ok) {
                UI.showToast("Максимум 5 пользовательских пресетов")
                return
            }
            const preset = ThemeManager.resolvePreset(result.key)
            this.applyAppearanceDraft({
                ...currentDraft,
                preset: result.key,
                p: preset.p,
                bg: preset.bg,
                t: preset.t,
                basePreset: result.key
            })
        }
        ThemeManager.renderPicker({ onSelect, onCreateCustomPreset, activeKey, manualColor: draft.p })
        ThemeManager.setupColorInputs((type, val) => {
            const current = StateStore.read().appearanceDraft || draft
            const normalizedValue = ThemeManager.normalizeHex(val)
            if (String(current.preset || "").startsWith("custom:")) {
                ThemeManager.updateCustomPreset(current.preset, { [type]: normalizedValue })
                const customPreset = ThemeManager.getCustomPresetByKey(current.preset)
                const next = {
                    ...current,
                    p: customPreset?.p || current.p,
                    bg: customPreset?.bg || current.bg,
                    t: customPreset?.t || current.t
                }
                StateStore.update("appearanceDraft", next)
                ThemeManager.applySettings(next, false)
                ThemeManager.syncInputs(next.p, next.bg, next.t)
                return
            }
            const next = { ...current, preset: "manual", [type]: normalizedValue }
            StateStore.update("appearanceDraft", next)
            ThemeManager.applySettings(next, false)
            ThemeManager.syncInputs(next.p, next.bg, next.t)
        })
    },

    applyAppearanceDraft(nextDraft) {
        StateStore.update("appearanceDraft", nextDraft)
        ThemeManager.applySettings(nextDraft, false)
        this.renderAppearanceDraft()
    },

    resetAppearanceDraft() {
        const defaults = ThemeManager.getDefaultSettings()
        let draft = null
        if (defaults.preset && defaults.preset !== "manual") {
            const preset = ThemeManager.resolvePreset(defaults.preset)
            draft = {
                preset: defaults.preset,
                p: preset.p,
                bg: preset.bg,
                t: preset.t,
                mainBackgroundImage: defaults.mainBackgroundImage || "",
                sidebarBackgroundImage: defaults.sidebarBackgroundImage || ""
            }
        } else {
            draft = {
                preset: "manual",
                p: ThemeManager.themes.oled.p,
                bg: ThemeManager.themes.oled.bg,
                t: ThemeManager.themes.oled.t,
                mainBackgroundImage: "",
                sidebarBackgroundImage: ""
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
    bindAppearanceBackgroundControls(root) {
        if (!root) return
        const bindTextInput = (input, key) => {
            if (!input) return
            input.addEventListener("change", (event) => {
                const nextValue = String(event.target.value || "").trim()
                this.updateAppearanceBackground(key, nextValue)
            })
        }
        const bindFileInput = (input, key) => {
            if (!input) return
            input.addEventListener("change", (event) => {
                const file = event.target.files && event.target.files[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : ""
                    this.updateAppearanceBackground(key, result)
                    event.target.value = ""
                }
                reader.readAsDataURL(file)
            })
        }
        const bindClearButton = (button, key) => {
            if (!button) return
            button.addEventListener("click", () => {
                this.updateAppearanceBackground(key, "")
            })
        }
        bindTextInput(root.querySelector('[data-appearance-bg-input="main"]'), "mainBackgroundImage")
        bindTextInput(root.querySelector('[data-appearance-bg-input="sidebar"]'), "sidebarBackgroundImage")
        bindFileInput(root.querySelector('[data-appearance-bg-file="main"]'), "mainBackgroundImage")
        bindFileInput(root.querySelector('[data-appearance-bg-file="sidebar"]'), "sidebarBackgroundImage")
        bindClearButton(root.querySelector('[data-appearance-bg-clear="main"]'), "mainBackgroundImage")
        bindClearButton(root.querySelector('[data-appearance-bg-clear="sidebar"]'), "sidebarBackgroundImage")
    },
    syncAppearanceBackgroundInputs(draft) {
        const mainInput = document.querySelector('[data-appearance-bg-input="main"]')
        const sidebarInput = document.querySelector('[data-appearance-bg-input="sidebar"]')
        if (mainInput) mainInput.value = draft.mainBackgroundImage || ""
        if (sidebarInput) sidebarInput.value = draft.sidebarBackgroundImage || ""
    },
    updateAppearanceBackground(key, value) {
        const current = StateStore.read().appearanceDraft || ThemeManager.getSavedSettings()
        if (String(current.preset || "").startsWith("custom:")) {
            ThemeManager.updateCustomPreset(current.preset, { [key]: value })
        }
        const next = {
            ...current,
            [key]: value
        }
        StateStore.update("appearanceDraft", next)
        ThemeManager.applySettings(next, false)
        this.renderAppearanceDraft()
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
            delete_f: this.getText("confirm_delete_folder", "Delete folder?"),
            hide_f: this.getText("confirm_hide_folder", "Do you want to hide this folder?")
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
            })
            
            const slider = document.createElement("span")
            slider.className = "slider"
            
            labelSwitch.append(input, slider)
            row.append(label, labelSwitch)
            root.appendChild(row)
        })
    }
})
