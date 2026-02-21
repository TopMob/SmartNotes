const baseTheme = {
    surface: "#111827",
    surfaceTransparent: "rgba(17, 24, 39, 0.78)",
    border: "rgba(148, 163, 184, 0.24)",
    blur: 12,
    motion: 1,
    density: 1,
    radius: 12,
    fontBase: 16,
    hitSize: 44,
    typeScale: 1,
    spaceUnit: 12,
    editorPadding: 30,
    editorLineHeight: 1.72,
    editorLetterSpacing: "0px",
    shadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
    shadowSmall: "0 10px 18px rgba(0, 0, 0, 0.28)",
    toolbarBg: "rgba(255, 255, 255, 0.04)",
    toolbarBorder: "rgba(255, 255, 255, 0.1)",
    toolbarShadow: "0 16px 28px rgba(0, 0, 0, 0.42)"
}

const createPreset = (bg, t, p) => ({ ...baseTheme, bg, t, p, surface: bg, surfaceTransparent: `color-mix(in srgb, ${bg} 86%, transparent)`, border: `color-mix(in srgb, ${p} 38%, transparent)`, toolbarBg: `color-mix(in srgb, ${bg} 80%, ${p} 20%)`, toolbarBorder: `color-mix(in srgb, ${p} 42%, transparent)` })

const normalizeLocalImageValue = (value, maxLength = 600000) => {
    if (typeof value !== "string") return ""
    const source = value.trim()
    if (!source) return ""
    return source.length > maxLength ? "" : source
}

const normalizeCloudSyncImageValue = (value, maxLength = 2048) => {
    if (typeof value !== "string") return ""
    const source = value.trim()
    if (!source) return ""
    if (source.startsWith("data:")) return ""
    return source.length > maxLength ? source.slice(0, maxLength) : source
}


const mergeCloudSettingsWithLocalSettings = (localSettings, cloudSettings) => {
    const safeLocalSettings = localSettings && typeof localSettings === "object" ? localSettings : {}
    const safeCloudSettings = cloudSettings && typeof cloudSettings === "object" ? cloudSettings : {}
    const localMainBackgroundImage = normalizeLocalImageValue(safeLocalSettings.mainBackgroundImage)
    const localSidebarBackgroundImage = normalizeLocalImageValue(safeLocalSettings.sidebarBackgroundImage)
    const cloudMainBackgroundImage = normalizeLocalImageValue(safeCloudSettings.mainBackgroundImage)
    const cloudSidebarBackgroundImage = normalizeLocalImageValue(safeCloudSettings.sidebarBackgroundImage)
    const mergedSettings = {
        ...safeCloudSettings,
        mainBackgroundImage: cloudMainBackgroundImage || localMainBackgroundImage,
        sidebarBackgroundImage: cloudSidebarBackgroundImage || localSidebarBackgroundImage
    }
    return mergedSettings
}

const mergeCloudPresetsWithLocalPresets = (localPresets, cloudPresets) => {
    const localPresetList = Array.isArray(localPresets) ? localPresets : []
    const cloudPresetList = Array.isArray(cloudPresets) ? cloudPresets : []
    const normalizedLocalPresets = localPresetList
        .filter(item => item && typeof item === "object")
        .map(item => ({
            key: String(item.key || ""),
            p: ThemeManager.normalizeHex(item.p),
            bg: ThemeManager.normalizeHex(item.bg),
            t: ThemeManager.normalizeHex(item.t),
            mainBackgroundImage: normalizeLocalImageValue(item.mainBackgroundImage),
            sidebarBackgroundImage: normalizeLocalImageValue(item.sidebarBackgroundImage)
        }))
    const mergedPresetsByKey = new Map(normalizedLocalPresets.map(item => [item.key, item]))

    cloudPresetList
        .filter(item => item && typeof item === "object")
        .forEach(item => {
            const presetKey = String(item.key || "")
            if (!presetKey) return
            const localPreset = mergedPresetsByKey.get(presetKey)
            const cloudMainBackgroundImage = normalizeLocalImageValue(item.mainBackgroundImage)
            const cloudSidebarBackgroundImage = normalizeLocalImageValue(item.sidebarBackgroundImage)
            const localMainBackgroundImage = normalizeLocalImageValue(localPreset?.mainBackgroundImage)
            const localSidebarBackgroundImage = normalizeLocalImageValue(localPreset?.sidebarBackgroundImage)
            const mergedPreset = {
                key: presetKey,
                p: ThemeManager.normalizeHex(item.p),
                bg: ThemeManager.normalizeHex(item.bg),
                t: ThemeManager.normalizeHex(item.t),
                mainBackgroundImage: cloudMainBackgroundImage || localMainBackgroundImage,
                sidebarBackgroundImage: cloudSidebarBackgroundImage || localSidebarBackgroundImage
            }
            mergedPresetsByKey.set(presetKey, mergedPreset)
        })

    return [...mergedPresetsByKey.values()].slice(0, ThemeManager.maxCustomPresets)
}

const normalizeNumberInRange = (value, minimum, maximum, fallback) => {
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) return fallback
    return Math.min(maximum, Math.max(minimum, parsedValue))
}


const normalizeCloudPresetRecord = (preset) => ({
    key: String(preset?.key || ""),
    p: ThemeManager.normalizeHex(preset?.p),
    bg: ThemeManager.normalizeHex(preset?.bg),
    t: ThemeManager.normalizeHex(preset?.t),
    mainBackgroundImage: normalizeCloudSyncImageValue(preset?.mainBackgroundImage),
    sidebarBackgroundImage: normalizeCloudSyncImageValue(preset?.sidebarBackgroundImage)
})


export const ThemeManager = {
    themes: {
        oled: createPreset("#000000", "#FFFFFF", "#2563EB"),
        standard_light: createPreset("#FFFFFF", "#000000", "#2563EB"),
        soft_slate: createPreset("#1E293B", "#F8FAFC", "#38BDF8"),
        retro_typewriter: createPreset("#F4F1EA", "#2C2C2C", "#A52A2A"),
        ice_cloud: createPreset("#F0F9FF", "#0C4A6E", "#0EA5E9"),
        midnight: createPreset("#020617", "#F1F5F9", "#3B82F6"),
        spring_mint: createPreset("#F0FDF4", "#166534", "#22C55E"),
        dark_forest: createPreset("#064E3B", "#ECFDF5", "#10B981"),
        sticky_note: createPreset("#FEF9C3", "#854D0E", "#EAB308"),
        warm_sunset: createPreset("#FFF7ED", "#7C2D12", "#F97316"),
        soft_rose: createPreset("#FFF1F2", "#9F1239", "#F43F5E"),
        wine_night: createPreset("#450A0A", "#FEE2E2", "#EF4444"),
        barbie_style: createPreset("#FDF2F8", "#831843", "#EC4899"),
        lavender_dream: createPreset("#F5F3FF", "#5B21B6", "#8B5CF6"),
        deep_purple: createPreset("#2E1065", "#F5F3FF", "#A855F7"),
        silver: createPreset("#F3F4F6", "#111827", "#4B5563"),
        graphite: createPreset("#27272A", "#F4F4F5", "#71717A"),
        terminal: createPreset("#000000", "#4ADE80", "#166534")
    },
    storageKey: "app-theme",
    customPresetStorageKey: "app-theme-custom-presets",
    maxCustomPresets: 5,
    isSavingTheme: false,
    init() {
        this.applySettings(this.getSavedSettings(), false)
    },
    getDefaultSettings() {
        return { preset: "oled", mainBackgroundImage: "", sidebarBackgroundImage: "", uiOpacity: 0.78, cardsOpacity: 0.9 }
    },
    getSavedSettings() {
        try {
            const parsed = SafeStorage.local.getJson(this.storageKey, null)
            if (parsed && typeof parsed === "object") return parsed
        } catch {}
        return this.getDefaultSettings()
    },
    getCustomPresets() {
        try {
            const parsed = SafeStorage.local.getJson(this.customPresetStorageKey, [])
            if (!Array.isArray(parsed)) return []
            return parsed
                .filter(item => item && typeof item === "object")
                .map(item => ({
                    key: String(item.key || Utils.generateId()),
                    p: this.normalizeHex(item.p),
                    bg: this.normalizeHex(item.bg),
                    t: this.normalizeHex(item.t),
                    mainBackgroundImage: typeof item.mainBackgroundImage === "string" ? item.mainBackgroundImage : "",
                    sidebarBackgroundImage: typeof item.sidebarBackgroundImage === "string" ? item.sidebarBackgroundImage : ""
                }))
                .slice(0, this.maxCustomPresets)
        } catch {
            return []
        }
    },
    saveCustomPresets(presets) {
        const safePresets = Array.isArray(presets) ? presets.slice(0, this.maxCustomPresets).map(item => ({
            key: String(item?.key || ""),
            p: this.normalizeHex(item?.p),
            bg: this.normalizeHex(item?.bg),
            t: this.normalizeHex(item?.t),
            mainBackgroundImage: normalizeLocalImageValue(item?.mainBackgroundImage),
            sidebarBackgroundImage: normalizeLocalImageValue(item?.sidebarBackgroundImage)
        })) : []
        SafeStorage.local.setJson(this.customPresetStorageKey, safePresets)
    },
    addCustomPreset(colors) {
        const presets = this.getCustomPresets()
        if (presets.length >= this.maxCustomPresets) {
            return { ok: false, reason: "limit" }
        }
        const nextPreset = {
            key: Utils.generateId(),
            p: this.normalizeHex(colors?.p),
            bg: this.normalizeHex(colors?.bg),
            t: this.normalizeHex(colors?.t),
            mainBackgroundImage: normalizeLocalImageValue(colors?.mainBackgroundImage),
            sidebarBackgroundImage: normalizeLocalImageValue(colors?.sidebarBackgroundImage)
        }
        this.saveCustomPresets([...presets, nextPreset])
        return { ok: true, key: `custom:${nextPreset.key}` }
    },
    updateCustomPreset(presetKey, updates) {
        if (!String(presetKey || "").startsWith("custom:")) return false
        const id = String(presetKey).slice(7)
        const presets = this.getCustomPresets()
        const nextPresets = presets.map(item => {
            if (item.key !== id) return item
            return {
                ...item,
                p: this.normalizeHex(updates?.p ?? item.p),
                bg: this.normalizeHex(updates?.bg ?? item.bg),
                t: this.normalizeHex(updates?.t ?? item.t),
                mainBackgroundImage: normalizeLocalImageValue(updates?.mainBackgroundImage ?? item.mainBackgroundImage),
                sidebarBackgroundImage: normalizeLocalImageValue(updates?.sidebarBackgroundImage ?? item.sidebarBackgroundImage)
            }
        })
        this.saveCustomPresets(nextPresets)
        return true
    },
    getCustomPresetByKey(presetKey) {
        if (!String(presetKey || "").startsWith("custom:")) return null
        const id = String(presetKey).slice(7)
        return this.getCustomPresets().find(item => item.key === id) || null
    },
    saveSettings(settings) {
        SafeStorage.local.setJson(this.storageKey, settings)
    },
    resetLocalThemeCache() {
        SafeStorage.local.remove(this.storageKey)
        SafeStorage.local.remove(this.customPresetStorageKey)
        SafeStorage.local.remove("theme-pending-sync")
        this.applySettings(this.getDefaultSettings(), true)
    },
    async loadAccountSettings(user) {
        if (!user || !user.uid) return null
        try {
            const encodedUserId = encodeURIComponent(String(user.uid))
            const response = await window.ApiClient.getJson(`/api/theme-load?uid=${encodedUserId}`)
            if (!response.ok) {
                console.error("Theme sync load failed", response.error)
                return this.getSavedSettings()
            }
            const responseData = response.data && typeof response.data === "object"
                ? response.data
                : {}
            const remoteSettings = responseData.settings && typeof responseData.settings === "object"
                ? responseData.settings
                : null
            const remoteCustomPresets = Array.isArray(responseData.customPresets)
                ? responseData.customPresets
                : []
            const localSettings = this.getSavedSettings()
            const localPresets = this.getCustomPresets()
            const mergedCustomPresets = mergeCloudPresetsWithLocalPresets(localPresets, remoteCustomPresets)
            this.saveCustomPresets(mergedCustomPresets)
            if (!remoteSettings) return null
            const mergedSettings = mergeCloudSettingsWithLocalSettings(localSettings, remoteSettings)
            this.saveSettings(mergedSettings)
            return mergedSettings
        } catch (error) {
            console.error("Theme sync load failed", error?.message || "unknown")
            return this.getSavedSettings()
        }
    },
    async saveAccountSettings(user, settings) {
        if (this.isSavingTheme) {
            console.warn("Theme save skipped due to active save")
            return
        }
        this.isSavingTheme = true
        const normalizedSettings = {
            preset: settings?.preset || "oled",
            p: this.normalizeHex(settings?.p),
            bg: this.normalizeHex(settings?.bg),
            t: this.normalizeHex(settings?.t),
            mainBackgroundImage: normalizeLocalImageValue(settings?.mainBackgroundImage),
            sidebarBackgroundImage: normalizeLocalImageValue(settings?.sidebarBackgroundImage),
            uiOpacity: normalizeNumberInRange(settings?.uiOpacity, 0.4, 1, 0.78),
            cardsOpacity: normalizeNumberInRange(settings?.cardsOpacity, 0.5, 1, 0.9)
        }
        this.saveSettings(normalizedSettings)
        if (!user || !user.uid) {
            this.isSavingTheme = false
            return
        }
        const cloudSettings = {
            ...normalizedSettings,
            mainBackgroundImage: normalizeCloudSyncImageValue(normalizedSettings.mainBackgroundImage),
            sidebarBackgroundImage: normalizeCloudSyncImageValue(normalizedSettings.sidebarBackgroundImage)
        }
        const customPresets = this.getCustomPresets()
        const localPresets = Array.isArray(customPresets)
            ? customPresets
            : []
        const normalizedCustomPresets = localPresets
            .map(normalizeCloudPresetRecord)
            .filter(preset => preset.key)
            .slice(0, this.maxCustomPresets)
        const payload = {
            uid: String(user.uid),
            settings: cloudSettings,
            customPresets: normalizedCustomPresets
        }
        try {
            const response = await window.ApiClient.postJson("/api/theme-save", payload)
            if (!response.ok) {
                SafeStorage.local.setJson("theme-pending-sync", {
                    settings: normalizedSettings,
                    customPresets: this.getCustomPresets(),
                    savedAt: Date.now()
                })
                console.error("Theme sync save failed:", response.error)
                UI?.showToast?.(`Theme sync failed: ${response.error || "unknown"}`)
            }
        } catch (error) {
            SafeStorage.local.setJson("theme-pending-sync", {
                settings: normalizedSettings,
                customPresets: this.getCustomPresets(),
                savedAt: Date.now()
            })
            console.error("Theme sync save failed:", error?.message || "unknown")
            UI?.showToast?.(`Theme sync failed: ${error?.message || "unknown"}`)
        } finally {
            this.isSavingTheme = false
        }
    },
    resolvePreset(key) {
        const customPreset = this.getCustomPresetByKey(key)
        if (customPreset) return createPreset(customPreset.bg, customPreset.t, customPreset.p)
        return this.themes[key] || this.themes.oled
    },
    applySettings(settings, persist) {
        const presetKey = settings?.preset || "oled"
        const base = this.resolvePreset(presetKey)
        const normalizedOpacity = normalizeNumberInRange(settings?.uiOpacity, 0.4, 1, 0.78)
        const normalizedCardsOpacity = normalizeNumberInRange(settings?.cardsOpacity, 0.5, 1, 0.9)
        const applied = { ...base, p: settings?.p || base.p, bg: settings?.bg || base.bg, t: settings?.t || base.t, uiOpacity: normalizedOpacity, cardsOpacity: normalizedCardsOpacity }
        this.applyToRoot({ ...applied, mainBackgroundImage: this.prepareBackgroundImage(settings?.mainBackgroundImage), sidebarBackgroundImage: this.prepareBackgroundImage(settings?.sidebarBackgroundImage) })
        document.documentElement.dataset.themePreset = presetKey
        if (persist) {
            this.saveSettings({ preset: presetKey, p: applied.p, bg: applied.bg, t: applied.t, mainBackgroundImage: settings?.mainBackgroundImage || "", sidebarBackgroundImage: settings?.sidebarBackgroundImage || "", uiOpacity: applied.uiOpacity, cardsOpacity: applied.cardsOpacity })
        }
    },
    applyToRoot(theme) {
        const root = document.documentElement
        const rgb = this.hexToRgb(theme.p)
        const reduceMotion = !!StateStore.read()?.config?.reduceMotion
        root.style.setProperty("--primary", theme.p)
        root.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`)
        root.style.setProperty("--bg", theme.bg)
        root.style.setProperty("--surface", theme.surface)
        root.style.setProperty("--surface-light", theme.surface)
        const surfaceTransparency = `color-mix(in srgb, ${theme.bg} ${Math.round((theme.uiOpacity || 0.78) * 100)}%, transparent)`
        root.style.setProperty("--surface-transparent", surfaceTransparency)
        root.style.setProperty("--cards-opacity", String(theme.cardsOpacity || 0.9))
        root.style.setProperty("--text", theme.t)
        root.style.setProperty("--text-dim", this.fadeColor(theme.t, 0.72))
        root.style.setProperty("--border", theme.border)
        root.style.setProperty("--radius-sm", `${Math.max(6, theme.radius * 0.6)}px`)
        root.style.setProperty("--radius-md", `${Math.max(8, theme.radius * 0.85)}px`)
        root.style.setProperty("--radius-lg", `${Math.max(10, theme.radius)}px`)
        root.style.setProperty("--radius-xl", `${Math.max(14, theme.radius * 1.4)}px`)
        root.style.setProperty("--font-base", `${theme.fontBase}px`)
        root.style.setProperty("--type-scale", `${theme.typeScale}`)
        root.style.setProperty("--hit-size", `${theme.hitSize}px`)
        root.style.setProperty("--density", `${theme.density}`)
        root.style.setProperty("--blur-strength", `${theme.blur}px`)
        root.style.setProperty("--motion-enabled", reduceMotion ? "0" : `${theme.motion}`)
        root.style.setProperty("--animation-duration", reduceMotion ? "0.01s" : "0.3s")
        root.style.setProperty("--shadow-sm", theme.shadowSmall)
        root.style.setProperty("--shadow-lg", theme.shadow)
        root.style.setProperty("--space-unit", `${theme.spaceUnit}px`)
        root.style.setProperty("--editor-padding", `${theme.editorPadding}px`)
        root.style.setProperty("--editor-line-height", `${theme.editorLineHeight}`)
        root.style.setProperty("--editor-letter-spacing", `${theme.editorLetterSpacing}`)
        root.style.setProperty("--editor-toolbar-bg", theme.toolbarBg)
        root.style.setProperty("--editor-toolbar-border", theme.toolbarBorder)
        root.style.setProperty("--editor-toolbar-shadow", theme.toolbarShadow)
        root.style.setProperty("--main-bg-image", theme.mainBackgroundImage || "none")
        root.style.setProperty("--sidebar-bg-image", theme.sidebarBackgroundImage || "none")
    },
    renderPicker({ onSelect, onCreateCustomPreset, activeKey } = {}) {
        const root = document.getElementById("theme-picker-root")
        if (!root) return
        const customPresetKeys = this.getCustomPresets().map(item => `custom:${item.key}`)
        const customThemesLeft = Math.max(0, this.maxCustomPresets - customPresetKeys.length)
        const groups = [
            { title: "Тёмные темы", items: ["oled", "soft_slate", "midnight", "dark_forest", "wine_night", "deep_purple", "graphite", "terminal"] },
            { title: "Светлые темы", items: ["standard_light", "retro_typewriter", "ice_cloud", "spring_mint", "sticky_note", "warm_sunset", "soft_rose", "barbie_style", "lavender_dream", "silver"] },
            { title: "Пользовательские", items: customPresetKeys }
        ]
        root.innerHTML = ""
        groups.forEach(group => {
            const sectionElement = document.createElement("section")
            sectionElement.className = "theme-group"

            const titleElement = document.createElement("h4")
            titleElement.className = "theme-group-title"
            titleElement.textContent = group.title
            sectionElement.appendChild(titleElement)

            const presetsGrid = document.createElement("div")
            presetsGrid.className = "theme-presets-row"

            group.items.forEach(key => {
                const buttonElement = document.createElement("button")
                buttonElement.type = "button"
                buttonElement.className = "theme-item-wrapper"
                buttonElement.dataset.themeKey = key
                if (activeKey === key) buttonElement.classList.add("active")
                const dotElement = document.createElement("span")
                dotElement.className = "theme-dot"
                dotElement.style.background = this.resolvePreset(key).p
                buttonElement.appendChild(dotElement)
                buttonElement.addEventListener("click", () => onSelect?.(key))
                presetsGrid.appendChild(buttonElement)
            })

            if (group.title === "Пользовательские") {
                const addButton = document.createElement("button")
                addButton.type = "button"
                addButton.className = "theme-custom-add"
                addButton.textContent = "+"
                const canCreateCustomTheme = window.Validators ? window.Validators.canAddCustomTheme(customPresetKeys.length) : customPresetKeys.length < this.maxCustomPresets
                addButton.disabled = !canCreateCustomTheme
                addButton.addEventListener("click", () => onCreateCustomPreset?.())
                presetsGrid.appendChild(addButton)

                const leftLabel = document.createElement("div")
                leftLabel.className = "theme-custom-limit-label"
                leftLabel.textContent = `${customThemesLeft} of ${this.maxCustomPresets} custom themes left`
                sectionElement.appendChild(leftLabel)
            }

            sectionElement.appendChild(presetsGrid)
            root.appendChild(sectionElement)
        })
    },
    setupColorInputs(onChange) {
        const bind = (element, type) => {
            if (!element) return
            element.oninput = event => onChange?.(type, event.target.value)
        }
        bind(document.getElementById("cp-primary"), "p")
        bind(document.getElementById("cp-bg"), "bg")
        bind(document.getElementById("cp-text"), "t")
    },
    syncInputs(p, bg, t) {
        const inputs = [document.getElementById("cp-primary"), document.getElementById("cp-bg"), document.getElementById("cp-text")]
        const values = [p, bg, t]
        inputs.forEach((input, index) => {
            if (!input) return
            input.value = this.normalizeHex(values[index])
            ColorPalette?.syncInput?.(input)
        })
    },
    revertToLastSaved() {
        this.applySettings(this.getSavedSettings(), false)
    },
    prepareBackgroundImage(value) {
        const trimmed = String(value || "").trim()
        if (!trimmed) return "none"
        if (/^url\(/i.test(trimmed)) return trimmed
        return `url("${trimmed.replace(/"/g, '\\"')}")`
    },
    normalizeHex(value) {
        const v = String(value || "").trim()
        if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
        if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`
        return "#000000"
    },
    hexToRgb(hex) {
        const value = this.normalizeHex(hex)
        const num = parseInt(value.slice(1), 16)
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
    },
    fadeColor(hex, alpha) {
        const rgb = this.hexToRgb(hex)
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
    }
}

window.ThemeManager = ThemeManager
