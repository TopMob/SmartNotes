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
                        <div class="field">
                            <span class="field-label">${dict.settings_notes_per_page || "Notes per page"}</span>
                            <select id="settings-notes-per-page" class="input-area" aria-label="${dict.settings_notes_per_page || "Notes per page"}">
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
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
            return
        }

        if (page === "editor_tools") {
            title.textContent = dict.settings_editor_tools || dict.editor_settings || "Editor tools"
            root.innerHTML = `<div id="editor-tools-list" class="settings-toggle-list"></div>`
            this.renderEditorSettings()
        }
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
            StateStore.update("draftUserSettings", JSON.parse(JSON.stringify(nextSavedSettings)))
            SettingsSyncService.applyUserSettingsToRuntime(nextSavedSettings, { resetVisibleLimit: true, persistTheme: true })
            if (this.settingsPage === "appearance") {
                this.initAppearanceDraft()
                this.renderAppearanceDraft()
            } else {
                this.syncSettingsUI()
            }
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
                this.showToast("Максимум 5 пользовательских пресетов")
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
                    message: "Pinterest не позволяет использовать ссылку напрямую. Откройте изображение и скопируйте прямую ссылку на файл (.jpg/.png)"
                }
            }
            if (!/^https?:\/\//i.test(source) || /^data:/i.test(source)) {
                return {
                    ok: false,
                    value: "",
                    message: "Нужно указать прямую ссылку на изображение (.jpg/.png/.webp)"
                }
            }
            if (!/\.(jpg|jpeg|png|webp|avif)(\?.*)?$/i.test(source)) {
                return {
                    ok: false,
                    value: "",
                    message: "Нужно указать прямую ссылку на изображение (.jpg/.png/.webp)"
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
        const bindFileInput = (input, key) => {
            if (!input) return
            input.addEventListener("change", (event) => {
                const file = event.target.files && event.target.files[0]
                if (!file) return
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
            })
        }
        bindTextInput(root.querySelector('[data-appearance-bg-input="main"]'), "main")
        bindTextInput(root.querySelector('[data-appearance-bg-input="sidebar"]'), "sidebar")
        bindFileInput(root.querySelector('[data-appearance-bg-file="main"]'), "main")
        bindFileInput(root.querySelector('[data-appearance-bg-file="sidebar"]'), "sidebar")
        bindClearButton(root.querySelector('[data-appearance-bg-clear="main"]'), "main")
        bindClearButton(root.querySelector('[data-appearance-bg-clear="sidebar"]'), "sidebar")
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

        if (secondaryField && secondaryInput && secondaryOptions) {
            secondaryField.classList.remove("hidden")
            secondaryInput.value = String(secondaryOptions.value || "")
            secondaryInput.placeholder = String(secondaryOptions.placeholder || "")
            secondaryInput.setAttribute("aria-label", String(secondaryOptions.ariaLabel || secondaryInput.getAttribute("aria-label") || ""))
            secondaryInput.maxLength = secondaryMaxLength > 0 ? secondaryMaxLength : 524288
        } else if (secondaryField && secondaryInput) {
            secondaryField.classList.add("hidden")
            secondaryInput.value = ""
            secondaryInput.placeholder = ""
            secondaryInput.removeAttribute("maxLength")
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

        modal.classList.add("active")
        setTimeout(() => input.focus(), 80)
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
            })
            
            const slider = document.createElement("span")
            slider.className = "slider"
            
            labelSwitch.append(input, slider)
            row.append(label, labelSwitch)
            root.appendChild(row)
        })
    }
})
