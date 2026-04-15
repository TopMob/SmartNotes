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
                        <div class="settings-section-title">${dict.settings_theme_fine_tuning || "Fine theme tuning"}</div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_radius || "Corner rounding"}</span>
                            <input type="range" min="6" max="36" step="1" class="input-area" data-appearance-theme-tuning="radius">
                            <span class="folder-meta" data-appearance-theme-tuning-value="radius"></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_blur || "Glass blur"}</span>
                            <input type="range" min="0" max="32" step="1" class="input-area" data-appearance-theme-tuning="blur">
                            <span class="folder-meta" data-appearance-theme-tuning-value="blur"></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_density || "Density"}</span>
                            <input type="range" min="80" max="125" step="1" class="input-area" data-appearance-theme-tuning="density">
                            <span class="folder-meta" data-appearance-theme-tuning-value="density"></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_font_size || "Base font size"}</span>
                            <input type="range" min="14" max="22" step="1" class="input-area" data-appearance-theme-tuning="fontBase">
                            <span class="folder-meta" data-appearance-theme-tuning-value="fontBase"></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_type_scale || "Type scale"}</span>
                            <input type="range" min="90" max="120" step="1" class="input-area" data-appearance-theme-tuning="typeScale">
                            <span class="folder-meta" data-appearance-theme-tuning-value="typeScale"></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_spacing || "Base spacing"}</span>
                            <input type="range" min="8" max="20" step="1" class="input-area" data-appearance-theme-tuning="spaceUnit">
                            <span class="folder-meta" data-appearance-theme-tuning-value="spaceUnit"></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_editor_padding || "Editor padding"}</span>
                            <input type="range" min="16" max="52" step="1" class="input-area" data-appearance-theme-tuning="editorPadding">
                            <span class="folder-meta" data-appearance-theme-tuning-value="editorPadding"></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_line_height || "Editor line height"}</span>
                            <input type="range" min="130" max="210" step="1" class="input-area" data-appearance-theme-tuning="editorLineHeight">
                            <span class="folder-meta" data-appearance-theme-tuning-value="editorLineHeight"></span>
                        </div>
                        <div class="field">
                            <span class="field-label">${dict.settings_theme_letter_spacing || "Editor letter spacing"}</span>
                            <input type="range" min="-1" max="8" step="1" class="input-area" data-appearance-theme-tuning="editorLetterSpacing">
                            <span class="folder-meta" data-appearance-theme-tuning-value="editorLetterSpacing"></span>
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
            StateStore.update("draftUserSettings", JSON.parse(JSON.stringify(nextSavedSettings)))
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
            cardsOpacity: typeof sourceTheme.cardsOpacity === "number" ? sourceTheme.cardsOpacity : 0.9,
            radius: Number(sourceTheme.radius ?? 12),
            blur: Number(sourceTheme.blur ?? 12),
            density: Number(sourceTheme.density ?? 1),
            fontBase: Number(sourceTheme.fontBase ?? 16),
            typeScale: Number(sourceTheme.typeScale ?? 1),
            spaceUnit: Number(sourceTheme.spaceUnit ?? 12),
            editorPadding: Number(sourceTheme.editorPadding ?? 30),
            editorLineHeight: Number(sourceTheme.editorLineHeight ?? 1.72),
            editorLetterSpacing: Number(String(sourceTheme.editorLetterSpacing ?? "0px").replace("px", "")),
            frameBorder: typeof sourceTheme.frameBorder === "string" ? sourceTheme.frameBorder : "",
            effect: typeof sourceTheme.effect === "string" ? sourceTheme.effect : "none",
            surface: typeof sourceTheme.surface === "string" ? sourceTheme.surface : ""
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
            cardsOpacity: Math.min(1, Math.max(0.5, Number(draft.cardsOpacity ?? 0.9))),
            radius: Math.min(36, Math.max(6, Number(draft.radius ?? 12))),
            blur: Math.min(32, Math.max(0, Number(draft.blur ?? 12))),
            density: Math.min(1.25, Math.max(0.8, Number(draft.density ?? 1))),
            fontBase: Math.min(22, Math.max(14, Number(draft.fontBase ?? 16))),
            typeScale: Math.min(1.2, Math.max(0.9, Number(draft.typeScale ?? 1))),
            spaceUnit: Math.min(20, Math.max(8, Number(draft.spaceUnit ?? 12))),
            editorPadding: Math.min(52, Math.max(16, Number(draft.editorPadding ?? 30))),
            editorLineHeight: Math.min(2.1, Math.max(1.3, Number(draft.editorLineHeight ?? 1.72))),
            editorLetterSpacing: Math.min(8, Math.max(-1, Number(draft.editorLetterSpacing ?? 0))),
            frameBorder: typeof draft.frameBorder === "string" ? draft.frameBorder : "",
            effect: typeof draft.effect === "string" ? draft.effect : "none",
            surface: typeof draft.surface === "string" ? draft.surface : ""
        }
        if (JSON.stringify(normalizedDraft) !== JSON.stringify(draft)) {
            draft = normalizedDraft
            StateStore.update("appearanceDraft", draft)
        }
        const activeKey = draft.preset && draft.preset !== "manual" ? draft.preset : "manual"
        ThemeManager.syncInputs(draft.p, draft.bg, draft.t)
        this.syncAppearanceBackgroundInputs(draft)
        this.syncAppearanceOpacityControl(draft)
        this.syncAppearanceFineTuneControls(draft)
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
                const specialPreset = ThemeManager.getSpecialPresetByKey?.(key)
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
                    uiOpacity: (customPreset && typeof customPreset.uiOpacity === "number")
                        ? customPreset.uiOpacity
                        : (specialPreset && typeof specialPreset.uiOpacity === "number" ? specialPreset.uiOpacity : (typeof draft.uiOpacity === "number" ? draft.uiOpacity : 0.78)),
                    cardsOpacity: (customPreset && typeof customPreset.cardsOpacity === "number")
                        ? customPreset.cardsOpacity
                        : (specialPreset && typeof specialPreset.cardsOpacity === "number" ? specialPreset.cardsOpacity : (typeof draft.cardsOpacity === "number" ? draft.cardsOpacity : 0.9)),
                    radius: (customPreset && typeof customPreset.radius === "number")
                        ? customPreset.radius
                        : (specialPreset && typeof specialPreset.radius === "number" ? specialPreset.radius : (typeof draft.radius === "number" ? draft.radius : 12)),
                    blur: (customPreset && typeof customPreset.blur === "number")
                        ? customPreset.blur
                        : (specialPreset && typeof specialPreset.blur === "number" ? specialPreset.blur : (typeof draft.blur === "number" ? draft.blur : 12)),
                    density: (customPreset && typeof customPreset.density === "number")
                        ? customPreset.density
                        : (specialPreset && typeof specialPreset.density === "number" ? specialPreset.density : (typeof draft.density === "number" ? draft.density : 1)),
                    fontBase: (customPreset && typeof customPreset.fontBase === "number")
                        ? customPreset.fontBase
                        : (specialPreset && typeof specialPreset.fontBase === "number" ? specialPreset.fontBase : (typeof draft.fontBase === "number" ? draft.fontBase : 16)),
                    typeScale: (customPreset && typeof customPreset.typeScale === "number")
                        ? customPreset.typeScale
                        : (specialPreset && typeof specialPreset.typeScale === "number" ? specialPreset.typeScale : (typeof draft.typeScale === "number" ? draft.typeScale : 1)),
                    spaceUnit: (customPreset && typeof customPreset.spaceUnit === "number")
                        ? customPreset.spaceUnit
                        : (specialPreset && typeof specialPreset.spaceUnit === "number" ? specialPreset.spaceUnit : (typeof draft.spaceUnit === "number" ? draft.spaceUnit : 12)),
                    editorPadding: (customPreset && typeof customPreset.editorPadding === "number")
                        ? customPreset.editorPadding
                        : (specialPreset && typeof specialPreset.editorPadding === "number" ? specialPreset.editorPadding : (typeof draft.editorPadding === "number" ? draft.editorPadding : 30)),
                    editorLineHeight: (customPreset && typeof customPreset.editorLineHeight === "number")
                        ? customPreset.editorLineHeight
                        : (specialPreset && typeof specialPreset.editorLineHeight === "number" ? specialPreset.editorLineHeight : (typeof draft.editorLineHeight === "number" ? draft.editorLineHeight : 1.72)),
                    editorLetterSpacing: customPreset && typeof customPreset.editorLetterSpacing === "string"
                        ? Number(String(customPreset.editorLetterSpacing).replace("px", ""))
                        : (specialPreset && typeof specialPreset.editorLetterSpacing === "string"
                            ? Number(String(specialPreset.editorLetterSpacing).replace("px", ""))
                        : (typeof draft.editorLetterSpacing === "number" ? draft.editorLetterSpacing : 0)
                        ),
                    frameBorder: (customPreset && typeof customPreset.frameBorder === "string")
                        ? customPreset.frameBorder
                        : (specialPreset && typeof specialPreset.frameBorder === "string" ? specialPreset.frameBorder : (draft.frameBorder || "")),
                    effect: (customPreset && typeof customPreset.effect === "string")
                        ? customPreset.effect
                        : (specialPreset && typeof specialPreset.effect === "string" ? specialPreset.effect : (draft.effect || "none")),
                    surface: (customPreset && typeof customPreset.surface === "string")
                        ? customPreset.surface
                        : (specialPreset && typeof specialPreset.surface === "string" ? specialPreset.surface : (draft.surface || ""))
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
                cardsOpacity: typeof createdPreset.cardsOpacity === "number" ? createdPreset.cardsOpacity : (typeof currentDraft.cardsOpacity === "number" ? currentDraft.cardsOpacity : 0.9),
                radius: typeof createdPreset.radius === "number" ? createdPreset.radius : (typeof currentDraft.radius === "number" ? currentDraft.radius : 12),
                blur: typeof createdPreset.blur === "number" ? createdPreset.blur : (typeof currentDraft.blur === "number" ? currentDraft.blur : 12),
                density: typeof createdPreset.density === "number" ? createdPreset.density : (typeof currentDraft.density === "number" ? currentDraft.density : 1),
                fontBase: typeof createdPreset.fontBase === "number" ? createdPreset.fontBase : (typeof currentDraft.fontBase === "number" ? currentDraft.fontBase : 16),
                typeScale: typeof createdPreset.typeScale === "number" ? createdPreset.typeScale : (typeof currentDraft.typeScale === "number" ? currentDraft.typeScale : 1),
                spaceUnit: typeof createdPreset.spaceUnit === "number" ? createdPreset.spaceUnit : (typeof currentDraft.spaceUnit === "number" ? currentDraft.spaceUnit : 12),
                editorPadding: typeof createdPreset.editorPadding === "number" ? createdPreset.editorPadding : (typeof currentDraft.editorPadding === "number" ? currentDraft.editorPadding : 30),
                editorLineHeight: typeof createdPreset.editorLineHeight === "number" ? createdPreset.editorLineHeight : (typeof currentDraft.editorLineHeight === "number" ? currentDraft.editorLineHeight : 1.72),
                editorLetterSpacing: typeof createdPreset.editorLetterSpacing === "string"
                    ? Number(String(createdPreset.editorLetterSpacing).replace("px", ""))
                    : (typeof currentDraft.editorLetterSpacing === "number" ? currentDraft.editorLetterSpacing : 0),
                frameBorder: typeof createdPreset.frameBorder === "string" ? createdPreset.frameBorder : String(currentDraft.frameBorder || ""),
                effect: typeof createdPreset.effect === "string" ? createdPreset.effect : String(currentDraft.effect || "none"),
                surface: typeof createdPreset.surface === "string" ? createdPreset.surface : String(currentDraft.surface || "")
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
                cardsOpacity: typeof nextDraft.cardsOpacity === "number" ? nextDraft.cardsOpacity : 0.9,
                radius: Number(nextDraft.radius ?? 12),
                blur: Number(nextDraft.blur ?? 12),
                density: Number(nextDraft.density ?? 1),
                fontBase: Number(nextDraft.fontBase ?? 16),
                typeScale: Number(nextDraft.typeScale ?? 1),
                spaceUnit: Number(nextDraft.spaceUnit ?? 12),
                editorPadding: Number(nextDraft.editorPadding ?? 30),
                editorLineHeight: Number(nextDraft.editorLineHeight ?? 1.72),
                editorLetterSpacing: `${Number(nextDraft.editorLetterSpacing ?? 0)}px`,
                frameBorder: String(nextDraft.frameBorder || ""),
                effect: String(nextDraft.effect || "none"),
                surface: String(nextDraft.surface || "")
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
            cardsOpacity: typeof defaults.cardsOpacity === "number" ? defaults.cardsOpacity : 0.9,
            radius: Number(defaults.radius ?? 12),
            blur: Number(defaults.blur ?? 12),
            density: Number(defaults.density ?? 1),
            fontBase: Number(defaults.fontBase ?? 16),
            typeScale: Number(defaults.typeScale ?? 1),
            spaceUnit: Number(defaults.spaceUnit ?? 12),
            editorPadding: Number(defaults.editorPadding ?? 30),
            editorLineHeight: Number(defaults.editorLineHeight ?? 1.72),
            editorLetterSpacing: Number(String(defaults.editorLetterSpacing ?? "0px").replace("px", "")),
            frameBorder: String(defaults.frameBorder || ""),
            effect: String(defaults.effect || "none"),
            surface: String(defaults.surface || "")
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
                const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
                const driveStatus = mediaService?.getStatus?.() || null
                const canConnect = (!driveStatus?.linked || (!!driveStatus?.linked && !driveStatus?.connected && !!driveStatus?.errorCode)) && !!mediaService?.connect
                const canUnlink = !!driveStatus?.linked && !!mediaService?.unlink
                if ((!canConnect && !canUnlink) || !driveStatus?.configured) {
                    this.showToast(this.getText("external_storage_unavailable", "External disk is temporarily unavailable"))
                    this.syncSettingsUI()
                    return
                }
                this.syncSettingsUI()
                try {
                    if (driveStatus?.linked && !driveStatus?.connected && driveStatus?.errorCode) {
                        await mediaService.connect()
                        this.showToast(this.getText("drive_connected", "Google Drive connected"))
                    } else if (driveStatus?.linked) {
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
    syncAppearanceFineTuneControls(draft) {
        const controlDefinitions = [
            { key: "radius", toInput: value => String(Math.round(value)), toState: value => Math.min(36, Math.max(6, Number(value || 12))), toLabel: value => `${Math.round(value)}px` },
            { key: "blur", toInput: value => String(Math.round(value)), toState: value => Math.min(32, Math.max(0, Number(value || 12))), toLabel: value => `${Math.round(value)}px` },
            { key: "density", toInput: value => String(Math.round(value * 100)), toState: value => Math.min(1.25, Math.max(0.8, Number(value || 100) / 100)), toLabel: value => `${Math.round(value * 100)}%` },
            { key: "fontBase", toInput: value => String(Math.round(value)), toState: value => Math.min(22, Math.max(14, Number(value || 16))), toLabel: value => `${Math.round(value)}px` },
            { key: "typeScale", toInput: value => String(Math.round(value * 100)), toState: value => Math.min(1.2, Math.max(0.9, Number(value || 100) / 100)), toLabel: value => `${Math.round(value * 100)}%` },
            { key: "spaceUnit", toInput: value => String(Math.round(value)), toState: value => Math.min(20, Math.max(8, Number(value || 12))), toLabel: value => `${Math.round(value)}px` },
            { key: "editorPadding", toInput: value => String(Math.round(value)), toState: value => Math.min(52, Math.max(16, Number(value || 30))), toLabel: value => `${Math.round(value)}px` },
            { key: "editorLineHeight", toInput: value => String(Math.round(value * 100)), toState: value => Math.min(2.1, Math.max(1.3, Number(value || 172) / 100)), toLabel: value => value.toFixed(2) },
            { key: "editorLetterSpacing", toInput: value => String(Math.round(value)), toState: value => Math.min(8, Math.max(-1, Number(value || 0))), toLabel: value => `${Math.round(value)}px` }
        ]
        controlDefinitions.forEach(definition => {
            const inputElement = document.querySelector(`[data-appearance-theme-tuning="${definition.key}"]`)
            const valueLabel = document.querySelector(`[data-appearance-theme-tuning-value="${definition.key}"]`)
            const draftValue = Number(draft[definition.key] ?? 0)
            if (inputElement) {
                inputElement.value = definition.toInput(draftValue)
                if (!inputElement.dataset.bound) {
                    inputElement.dataset.bound = "1"
                    inputElement.addEventListener("input", event => {
                        const currentDraft = StateStore.read().appearanceDraft || ThemeManager.getSavedSettings()
                        const nextValue = definition.toState(event.target.value)
                        const nextDraft = { ...currentDraft, [definition.key]: nextValue }
                        if (String(currentDraft.preset || "").startsWith("custom:")) {
                            ThemeManager.updateCustomPreset(currentDraft.preset, {
                                [definition.key]: definition.key === "editorLetterSpacing" ? `${nextValue}px` : nextValue
                            })
                        }
                        this.applyAppearanceDraft(nextDraft)
                    })
                }
            }
            if (valueLabel) valueLabel.textContent = definition.toLabel(draftValue)
        })
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
        const driveStatus = mediaService?.getStatus?.() || null
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
            const needsReconnect = !!driveStatus?.linked && !driveStatus?.connected && !!driveStatus?.errorCode
            driveConnectButton.disabled = !driveStatus?.configured || !!driveStatus?.pending
            driveConnectButton.textContent = driveStatus?.pending
                ? this.getText("drive_connecting", "Connecting...")
                : needsReconnect
                    ? this.getText("drive_reconnect", "Reconnect")
                    : this.getText(driveStatus?.linked ? "drive_disconnect" : "drive_connect", driveStatus?.linked ? "Disconnect" : "Connect")
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
})
