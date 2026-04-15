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

const createPreset = (bg, t, p) => ({ ...baseTheme, bg, t, p, surface: `color-mix(in srgb, ${bg} 88%, ${t} 12%)`, surfaceTransparent: `color-mix(in srgb, ${bg} 82%, ${t} 18%, transparent)`, border: `color-mix(in srgb, ${p} 38%, ${t} 8%, transparent)`, toolbarBg: `color-mix(in srgb, ${bg} 80%, ${p} 20%)`, toolbarBorder: `color-mix(in srgb, ${p} 42%, transparent)` })
const normalizeNumberInRange = (value, minimum, maximum, fallback) => {
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) return fallback
    return Math.min(maximum, Math.max(minimum, parsedValue))
}
const normalizeEditorLetterSpacing = (value, fallback = baseTheme.editorLetterSpacing) => {
    const parsedValue = typeof value === "string" ? Number.parseFloat(value.replace("px", "")) : value
    return `${normalizeNumberInRange(parsedValue, -1, 8, Number(String(fallback).replace("px", "")) || 0)}px`
}
const normalizeHexColor = (value, fallback = "#000000") => {
    const source = String(value || "").trim()
    if (/^#[0-9a-fA-F]{6}$/.test(source)) return source
    if (/^[0-9a-fA-F]{6}$/.test(source)) return `#${source}`
    return fallback
}
const normalizeFrameBorder = (value, fallback = "1px solid rgba(148, 163, 184, 0.24)") => {
    const source = String(value || "").trim()
    if (!source) return fallback
    if (!/^\d+px\s+solid\s+(#[0-9a-fA-F]{6}|rgba?\([^)]+\))$/.test(source)) return fallback
    return source
}
const allowedThemeEffects = new Set(["none", "atomic-retro", "glow", "brutal", "carbon", "ukiyoe", "construct", "nanotech", "lego", "halftone", "wasteland", "deco"])
const normalizeThemeEffect = (value, fallback = "none") => {
    const effect = String(value || "").trim().toLowerCase()
    return allowedThemeEffects.has(effect) ? effect : fallback
}
const normalizeThemeStyleSettings = (source = {}, fallback = baseTheme) => ({
    radius: normalizeNumberInRange(source.radius, 6, 36, fallback.radius),
    blur: normalizeNumberInRange(source.blur, 0, 32, fallback.blur),
    density: normalizeNumberInRange(source.density, 0.8, 1.25, fallback.density),
    fontBase: normalizeNumberInRange(source.fontBase, 14, 22, fallback.fontBase),
    typeScale: normalizeNumberInRange(source.typeScale, 0.9, 1.2, fallback.typeScale),
    spaceUnit: normalizeNumberInRange(source.spaceUnit, 8, 20, fallback.spaceUnit),
    editorPadding: normalizeNumberInRange(source.editorPadding, 16, 52, fallback.editorPadding),
    editorLineHeight: normalizeNumberInRange(source.editorLineHeight, 1.3, 2.1, fallback.editorLineHeight),
    editorLetterSpacing: normalizeEditorLetterSpacing(source.editorLetterSpacing, fallback.editorLetterSpacing),
    frameBorder: normalizeFrameBorder(source.frameBorder, fallback.frameBorder || "1px solid rgba(148, 163, 184, 0.24)"),
    effect: normalizeThemeEffect(source.effect, fallback.effect || "none"),
    surface: /^#?[0-9a-fA-F]{6}$/.test(String(source.surface || "").trim())
        ? normalizeHexColor(source.surface)
        : (/^#?[0-9a-fA-F]{6}$/.test(String(fallback.surface || "").trim()) ? normalizeHexColor(fallback.surface) : "")
})

const normalizeLocalImageValue = (value, maxLength = 600000) => {
    if (typeof value !== "string") return ""
    const source = value.trim()
    if (!source) return ""
    return source.length > maxLength ? "" : source
}

const normalizeThemeUrlValue = (value) => {
    if (typeof value !== "string") return ""
    const source = value.trim()
    if (!source) return ""
    if (/^data:/i.test(source)) return ""
    return /^https?:\/\//i.test(source) ? source : ""
}

const pickRuntimeBackgroundValue = (urlValue, localImageValue) => {
    const safeUrl = normalizeThemeUrlValue(urlValue)
    if (safeUrl) return safeUrl
    return normalizeLocalImageValue(localImageValue)
}

const getThemeDictionary = () => {
    const stateLang = window.StateStore?.read?.().config?.lang
    const persistedLang = window.SafeStorage?.local?.get?.("app-lang")
    const documentLang = document.documentElement?.lang
    const currentLang = stateLang === "en" || stateLang === "ru"
        ? stateLang
        : (persistedLang === "en" || persistedLang === "ru"
            ? persistedLang
            : (documentLang === "en" || documentLang === "ru" ? documentLang : "ru"))
    if (window.LANG?.[currentLang]) return window.LANG[currentLang]
    return window.LANG?.ru || {}
}

const getThemeText = (key, fallback = "") => {
    const dictionary = getThemeDictionary()
    return dictionary[key] || fallback || key
}

const formatThemeText = (key, fallback, values = {}) => {
    return Object.entries(values).reduce((output, [token, value]) => output.replaceAll(`{${token}}`, String(value)), getThemeText(key, fallback))
}

const mergeCloudSettingsWithLocalSettings = (localSettings, cloudSettings) => {
    const safeLocalSettings = localSettings && typeof localSettings === "object" ? localSettings : {}
    const safeCloudSettings = cloudSettings && typeof cloudSettings === "object" ? cloudSettings : {}
    return {
        ...safeCloudSettings,
        ...normalizeThemeStyleSettings(safeCloudSettings, { ...baseTheme, ...safeLocalSettings }),
        mainBackgroundUrl: normalizeThemeUrlValue(safeCloudSettings.mainBackgroundUrl),
        sidebarBackgroundUrl: normalizeThemeUrlValue(safeCloudSettings.sidebarBackgroundUrl),
        mainBackgroundImage: normalizeLocalImageValue(safeLocalSettings.mainBackgroundImage) || "",
        sidebarBackgroundImage: normalizeLocalImageValue(safeLocalSettings.sidebarBackgroundImage) || ""
    }
}

const mergeCloudPresetsWithLocalPresets = (localPresets, cloudPresets) => {
    const localPresetList = Array.isArray(localPresets) ? localPresets : []
    const cloudPresetList = Array.isArray(cloudPresets) ? cloudPresets : []
    const localPresetsByKey = new Map(localPresetList
        .filter(item => item && typeof item === "object")
        .map(item => [String(item.key || ""), item]))
    const mergedPresets = []
    const seenPresetKeys = new Set()
    cloudPresetList
        .filter(item => item && typeof item === "object")
        .forEach(item => {
            const presetKey = String(item.key || "")
            if (!presetKey) return
            const localPreset = localPresetsByKey.get(presetKey)
            const cloudMainBackgroundUrl = normalizeThemeUrlValue(item.mainBackgroundUrl)
            const cloudSidebarBackgroundUrl = normalizeThemeUrlValue(item.sidebarBackgroundUrl)
            const localMainBackgroundUrl = normalizeThemeUrlValue(localPreset?.mainBackgroundUrl)
            const localSidebarBackgroundUrl = normalizeThemeUrlValue(localPreset?.sidebarBackgroundUrl)
            mergedPresets.push({
                key: presetKey,
                p: ThemeManager.normalizeHex(item.p),
                bg: ThemeManager.normalizeHex(item.bg),
                t: ThemeManager.normalizeHex(item.t),
                uiOpacity: normalizeNumberInRange(item.uiOpacity, 0.4, 1, 0.78),
                cardsOpacity: normalizeNumberInRange(item.cardsOpacity, 0.5, 1, 0.9),
                ...normalizeThemeStyleSettings(item, localPreset || baseTheme),
                mainBackgroundUrl: cloudMainBackgroundUrl || localMainBackgroundUrl,
                sidebarBackgroundUrl: cloudSidebarBackgroundUrl || localSidebarBackgroundUrl,
                mainBackgroundImage: normalizeLocalImageValue(localPreset?.mainBackgroundImage),
                sidebarBackgroundImage: normalizeLocalImageValue(localPreset?.sidebarBackgroundImage)
            })
            seenPresetKeys.add(presetKey)
        })
    localPresetList.forEach(item => {
        const presetKey = String(item?.key || "")
        if (!presetKey || seenPresetKeys.has(presetKey)) return
        mergedPresets.push({
            key: presetKey,
            p: ThemeManager.normalizeHex(item?.p),
            bg: ThemeManager.normalizeHex(item?.bg),
            t: ThemeManager.normalizeHex(item?.t),
            uiOpacity: normalizeNumberInRange(item?.uiOpacity, 0.4, 1, 0.78),
            cardsOpacity: normalizeNumberInRange(item?.cardsOpacity, 0.5, 1, 0.9),
            ...normalizeThemeStyleSettings(item, baseTheme),
            mainBackgroundUrl: normalizeThemeUrlValue(item?.mainBackgroundUrl),
            sidebarBackgroundUrl: normalizeThemeUrlValue(item?.sidebarBackgroundUrl),
            mainBackgroundImage: normalizeLocalImageValue(item?.mainBackgroundImage),
            sidebarBackgroundImage: normalizeLocalImageValue(item?.sidebarBackgroundImage)
        })
    })
    return mergedPresets.slice(0, ThemeManager.maxCustomPresets)
}

const buildThemeCloudPayload = (theme) => {
    const safeTheme = theme && typeof theme === "object" ? theme : {}
    return {
        preset: String(safeTheme.preset || "oled"),
        p: ThemeManager.normalizeHex(safeTheme.p),
        bg: ThemeManager.normalizeHex(safeTheme.bg),
        t: ThemeManager.normalizeHex(safeTheme.t),
        uiOpacity: normalizeNumberInRange(safeTheme.uiOpacity, 0.4, 1, 0.78),
        cardsOpacity: normalizeNumberInRange(safeTheme.cardsOpacity, 0.5, 1, 0.9),
        ...normalizeThemeStyleSettings(safeTheme, baseTheme),
        mainBackgroundUrl: normalizeThemeUrlValue(safeTheme.mainBackgroundUrl),
        sidebarBackgroundUrl: normalizeThemeUrlValue(safeTheme.sidebarBackgroundUrl)
    }
}

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
        terminal: createPreset("#000000", "#4ADE80", "#166534"),
        amber_accent: createPreset("#110114", "#FFAA00", "#07AC0A")
    },
    storageKey: "app-theme",
    customPresetStorageKey: "app-theme-custom-presets",
    maxCustomPresets: 5,
    specialPresetDefinitions: [
        { key: "atomic_heart_retro", name: "Atomic Heart Retro", family: "Советский футуризм", description: "Утопический индустриализм 50-х: металл, дерево и агит-эстетика", bg: "#F4F1EA", surface: "#E3DCC8", p: "#A62A2A", t: "#2B2523", radius: 18, frameBorder: "2px solid #2B2523", effect: "atomic-retro", previewColor: "#A62A2A" },
        { key: "cyberpunk_neon", name: "Cyberpunk Neon", family: "Night City", description: "Неон, острые формы и максимальный контраст ночного мегаполиса", bg: "#0D0D0D", surface: "#1A1A1A", p: "#FCE205", t: "#E0E0E0", radius: 6, frameBorder: "2px solid #FCE205", effect: "glow", previewColor: "#FCE205" },
        { key: "forest_fog", name: "Forest Fog", family: "Organic Matte", description: "Матовые натуральные оттенки с мягкой глубиной", bg: "#2D3632", surface: "#3E4A44", p: "#8DA399", t: "#C2C9C5", radius: 18, frameBorder: "1px solid #5B6B63", effect: "none", previewColor: "#8DA399" },
        { key: "brutalism", name: "Brutalism", family: "Raw Web", description: "Толстые чёрные рамки, жёлтые плашки и нулевая декоративность", bg: "#FFFFFF", surface: "#FFFF00", p: "#000000", t: "#000000", radius: 6, frameBorder: "4px solid #000000", effect: "brutal", previewColor: "#000000" },
        { key: "frozen_carbon", name: "Frozen Carbon", family: "Materiality", description: "Карбоновая текстура и холодный инженерный стиль", bg: "#121316", surface: "#1C1F24", p: "#5F6C7B", t: "#E1E4EA", radius: 10, frameBorder: "1px solid #2E343E", effect: "carbon", previewColor: "#5F6C7B" },
        { key: "ukiyoe", name: "Ukiyo-e", family: "Art & History", description: "Японская гравюра, волны, бумага, красные акценты", bg: "#E8DDC9", surface: "#F5EBD9", p: "#B13A2A", t: "#223A53", radius: 14, frameBorder: "1px solid #3D6B88", effect: "ukiyoe", previewColor: "#B13A2A" },
        { key: "soviet_constructivism", name: "Soviet Constructivism", family: "Art & History", description: "Диагонали и агрессивный красно-черный агитплакат", bg: "#F5EBDD", surface: "#FAF1E4", p: "#C1121F", t: "#121212", radius: 6, frameBorder: "3px solid #000000", effect: "construct", previewColor: "#C1121F" },
        { key: "nanotech", name: "Nanotech", family: "Future UI", description: "Глянцевый черный и жидкие переходы состояний", bg: "#050505", surface: "#121212", p: "#7A7A7A", t: "#D8D8D8", radius: 22, frameBorder: "1px solid #3C3C3C", effect: "nanotech", previewColor: "#7A7A7A" },
        { key: "lego_brick", name: "Lego Brick", family: "Mix", description: "Яркие цвета, блочная геометрия, эффект конструктора", bg: "#F7F7F7", surface: "#FFFFFF", p: "#E63946", t: "#1A1A1A", radius: 12, frameBorder: "3px solid #F5C400", effect: "lego", previewColor: "#E63946" },
        { key: "manga_sketch", name: "Manga Sketch", family: "Halftone", description: "Чёрно-белая манга с полутонами и контуром", bg: "#FFFFFF", surface: "#FFFFFF", p: "#000000", t: "#111111", radius: 28, frameBorder: "2px solid #000000", effect: "halftone", previewColor: "#000000" },
        { key: "post_apocalyptic", name: "Post-Apocalyptic", family: "Mix", description: "Ржавчина, пыль и разрушенные поверхности", bg: "#2A1F1A", surface: "#3B2C25", p: "#A34E2C", t: "#E2D2BE", radius: 14, frameBorder: "1px solid #A34E2C", effect: "wasteland", previewColor: "#A34E2C" },
        { key: "art_deco", name: "Art Deco", family: "Art & History", description: "Черно-золотая геометрическая элегантность", bg: "#0B0A0A", surface: "#171414", p: "#D4AF37", t: "#F3E4BC", radius: 14, frameBorder: "1px solid #D4AF37", effect: "deco", previewColor: "#D4AF37" }
    ],
    init() {
        this.applySettings(this.getSavedSettings(), false)
    },
    getDefaultSettings() {
        return { preset: "oled", mainBackgroundUrl: "", sidebarBackgroundUrl: "", mainBackgroundImage: "", sidebarBackgroundImage: "", uiOpacity: 0.78, cardsOpacity: 0.9, ...normalizeThemeStyleSettings(baseTheme, baseTheme) }
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
                    uiOpacity: normalizeNumberInRange(item.uiOpacity, 0.4, 1, 0.78),
                    cardsOpacity: normalizeNumberInRange(item.cardsOpacity, 0.5, 1, 0.9),
                    ...normalizeThemeStyleSettings(item, baseTheme),
                    mainBackgroundUrl: normalizeThemeUrlValue(item.mainBackgroundUrl),
                    sidebarBackgroundUrl: normalizeThemeUrlValue(item.sidebarBackgroundUrl),
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
            uiOpacity: normalizeNumberInRange(item?.uiOpacity, 0.4, 1, 0.78),
            cardsOpacity: normalizeNumberInRange(item?.cardsOpacity, 0.5, 1, 0.9),
            ...normalizeThemeStyleSettings(item || {}, baseTheme),
            mainBackgroundUrl: normalizeThemeUrlValue(item?.mainBackgroundUrl),
            sidebarBackgroundUrl: normalizeThemeUrlValue(item?.sidebarBackgroundUrl),
            mainBackgroundImage: normalizeLocalImageValue(item?.mainBackgroundImage),
            sidebarBackgroundImage: normalizeLocalImageValue(item?.sidebarBackgroundImage)
        })) : []
        SafeStorage.local.setJson(this.customPresetStorageKey, safePresets)
    },
    addCustomPreset(colors) {
        const currentPresets = this.getCustomPresets()
        if (currentPresets.length >= this.maxCustomPresets) {
            return { ok: false, reason: "limit" }
        }
        const nextPreset = {
            key: Utils.generateId(),
            p: this.normalizeHex(colors?.p),
            bg: this.normalizeHex(colors?.bg),
            t: this.normalizeHex(colors?.t),
            uiOpacity: normalizeNumberInRange(colors?.uiOpacity, 0.4, 1, 0.78),
            cardsOpacity: normalizeNumberInRange(colors?.cardsOpacity, 0.5, 1, 0.9),
            ...normalizeThemeStyleSettings(colors || {}, baseTheme),
            mainBackgroundUrl: normalizeThemeUrlValue(colors?.mainBackgroundUrl),
            sidebarBackgroundUrl: normalizeThemeUrlValue(colors?.sidebarBackgroundUrl),
            mainBackgroundImage: normalizeLocalImageValue(colors?.mainBackgroundImage),
            sidebarBackgroundImage: normalizeLocalImageValue(colors?.sidebarBackgroundImage)
        }
        this.saveCustomPresets([...currentPresets, nextPreset])
        return { ok: true, key: `custom:${nextPreset.key}` }
    },
    updateCustomPreset(presetKey, updates) {
        if (!String(presetKey || "").startsWith("custom:")) return false
        const presetId = String(presetKey).slice(7)
        const currentPresets = this.getCustomPresets()
        const nextPresets = currentPresets.map(item => {
            if (item.key !== presetId) return item
            return {
                ...item,
                p: this.normalizeHex(updates?.p ?? item.p),
                bg: this.normalizeHex(updates?.bg ?? item.bg),
                t: this.normalizeHex(updates?.t ?? item.t),
                uiOpacity: normalizeNumberInRange(updates?.uiOpacity ?? item.uiOpacity, 0.4, 1, 0.78),
                cardsOpacity: normalizeNumberInRange(updates?.cardsOpacity ?? item.cardsOpacity, 0.5, 1, 0.9),
                ...normalizeThemeStyleSettings({ ...item, ...updates }, item),
                mainBackgroundUrl: normalizeThemeUrlValue(updates?.mainBackgroundUrl ?? item.mainBackgroundUrl),
                sidebarBackgroundUrl: normalizeThemeUrlValue(updates?.sidebarBackgroundUrl ?? item.sidebarBackgroundUrl),
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
    setCustomPresets(presets) {
        this.saveCustomPresets(presets)
    },
    mergeCloudPresetsWithLocalPresets(localPresets, cloudPresets) {
        return mergeCloudPresetsWithLocalPresets(localPresets, cloudPresets)
    },
    buildCloudSafeCustomPresets(presets) {
        const sourcePresets = Array.isArray(presets) ? presets : []
        return sourcePresets
            .filter(item => item && typeof item === "object")
            .map(item => ({
                key: String(item.key || ""),
                p: this.normalizeHex(item.p),
                bg: this.normalizeHex(item.bg),
                t: this.normalizeHex(item.t),
                uiOpacity: normalizeNumberInRange(item.uiOpacity, 0.4, 1, 0.78),
                cardsOpacity: normalizeNumberInRange(item.cardsOpacity, 0.5, 1, 0.9),
                ...normalizeThemeStyleSettings(item, baseTheme),
                mainBackgroundUrl: normalizeThemeUrlValue(item.mainBackgroundUrl),
                sidebarBackgroundUrl: normalizeThemeUrlValue(item.sidebarBackgroundUrl)
            }))
            .filter(item => item.key)
    },
    getSpecialPresets() {
        return Array.isArray(this.specialPresetDefinitions)
            ? this.specialPresetDefinitions.filter(item => item && typeof item === "object" && typeof item.key === "string" && item.key.trim())
            : []
    },
    getSpecialPresetByKey(presetKey) {
        const key = String(presetKey || "")
        if (!key) return null
        const normalizedKey = key.startsWith("special:") ? key.slice(8) : key
        return this.getSpecialPresets().find(item => item.key === normalizedKey) || null
    },
    resetLocalThemeCache() {
        SafeStorage.local.remove(this.storageKey)
        SafeStorage.local.remove(this.customPresetStorageKey)
        SafeStorage.local.remove("theme-pending-sync")
        this.applySettings(this.getDefaultSettings(), true)
    },
    getThemeSettingsReference(user) {
        if (!user || !user.uid) return null
        const rootReference = typeof DataPath !== "undefined" ? DataPath.getUserRootReference(user) : null
        return rootReference ? rootReference.collection("preferences").doc("theme") : null
    },
    async loadAccountSettings(user) {
        const reference = this.getThemeSettingsReference(user)
        if (!reference) return null
        try {
            const snapshot = await reference.get()
            if (!snapshot.exists) return null
            const data = snapshot.data() || {}
            const settings = buildThemeCloudPayload(data)
            const localSettings = this.getSavedSettings()
            if (settings) {
                const mergedSettings = mergeCloudSettingsWithLocalSettings(localSettings, settings)
                this.saveSettings(mergedSettings)
                return mergedSettings
            }
            return settings
        } catch (error) {
            UI?.showToast?.(`Theme sync load failed${error?.code ? `: ${error.code}` : ""}`)
            return this.getSavedSettings()
        }
    },
    async saveAccountSettings(user, settings) {
        const reference = this.getThemeSettingsReference(user)
        const normalizedSettings = {
            preset: settings?.preset || "oled",
            p: this.normalizeHex(settings?.p),
            bg: this.normalizeHex(settings?.bg),
            t: this.normalizeHex(settings?.t),
            mainBackgroundUrl: normalizeThemeUrlValue(settings?.mainBackgroundUrl),
            sidebarBackgroundUrl: normalizeThemeUrlValue(settings?.sidebarBackgroundUrl),
            mainBackgroundImage: normalizeLocalImageValue(settings?.mainBackgroundImage),
            sidebarBackgroundImage: normalizeLocalImageValue(settings?.sidebarBackgroundImage),
            uiOpacity: normalizeNumberInRange(settings?.uiOpacity, 0.4, 1, 0.78),
            cardsOpacity: normalizeNumberInRange(settings?.cardsOpacity, 0.5, 1, 0.9),
            ...normalizeThemeStyleSettings(settings, baseTheme)
        }
        this.saveSettings(normalizedSettings)
        if (!reference) return
        try {
            const cloudSettings = buildThemeCloudPayload(normalizedSettings)
            const payload = {
                ...cloudSettings,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
            try {
                await reference.set(payload, { merge: true })
            } catch (error) {
                if (String(error?.code || "") !== "invalid-argument") throw error
                await reference.set({ ...cloudSettings, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
            }
        } catch (error) {
            SafeStorage.local.setJson("theme-pending-sync", { settings: normalizedSettings, customPresets: this.getCustomPresets(), savedAt: Date.now() })
        }
    },
    resolvePreset(key) {
        const customPreset = this.getCustomPresetByKey(key)
        if (customPreset) return createPreset(customPreset.bg, customPreset.t, customPreset.p)
        const specialPreset = this.getSpecialPresetByKey(key)
        if (specialPreset) return createPreset(specialPreset.bg, specialPreset.t, specialPreset.p)
        return this.themes[key] || this.themes.oled
    },
    pickRuntimeBackgroundValue(urlValue, localImageValue) {
        return pickRuntimeBackgroundValue(urlValue, localImageValue)
    },
    applySettings(settings, persist) {
        const presetKey = settings?.preset || "oled"
        const base = this.resolvePreset(presetKey)
        const specialPreset = this.getSpecialPresetByKey(presetKey)
        const source = specialPreset ? { ...specialPreset, ...settings } : settings
        const normalizedOpacity = normalizeNumberInRange(source?.uiOpacity, 0.4, 1, 0.78)
        const normalizedCardsOpacity = normalizeNumberInRange(source?.cardsOpacity, 0.5, 1, 0.9)
        const styleSettings = normalizeThemeStyleSettings(source, { ...base, ...specialPreset })
        const mainBackgroundImage = this.pickRuntimeBackgroundValue(settings?.mainBackgroundUrl, settings?.mainBackgroundImage)
        const sidebarBackgroundImage = this.pickRuntimeBackgroundValue(settings?.sidebarBackgroundUrl, settings?.sidebarBackgroundImage)
        const appliedPrimaryColor = source?.p || base.p
        const appliedBackgroundColor = source?.bg || base.bg
        const appliedTextColor = source?.t || base.t
        const appliedSurfaceColor = normalizeHexColor(source?.surface, "")
        const applied = {
            ...base,
            p: appliedPrimaryColor,
            bg: appliedBackgroundColor,
            t: appliedTextColor,
            surface: appliedSurfaceColor || `color-mix(in srgb, ${appliedBackgroundColor} 88%, ${appliedTextColor} 12%)`,
            surfaceTransparent: `color-mix(in srgb, ${appliedBackgroundColor} 82%, ${appliedTextColor} 18%, transparent)`,
            border: `color-mix(in srgb, ${appliedPrimaryColor} 38%, ${appliedTextColor} 8%, transparent)`,
            toolbarBg: `color-mix(in srgb, ${appliedBackgroundColor} 80%, ${appliedPrimaryColor} 20%)`,
            toolbarBorder: `color-mix(in srgb, ${appliedPrimaryColor} 42%, transparent)`,
            uiOpacity: normalizedOpacity,
            cardsOpacity: normalizedCardsOpacity,
            ...styleSettings
        }
        this.applyToRoot({ ...applied, mainBackgroundImage: this.prepareBackgroundImage(mainBackgroundImage), sidebarBackgroundImage: this.prepareBackgroundImage(sidebarBackgroundImage) })
        document.documentElement.dataset.themePreset = presetKey
        document.documentElement.dataset.themeEffect = styleSettings.effect
        if (persist) {
            this.saveSettings({ preset: presetKey, p: applied.p, bg: applied.bg, t: applied.t, mainBackgroundUrl: normalizeThemeUrlValue(settings?.mainBackgroundUrl), sidebarBackgroundUrl: normalizeThemeUrlValue(settings?.sidebarBackgroundUrl), mainBackgroundImage: normalizeLocalImageValue(settings?.mainBackgroundImage), sidebarBackgroundImage: normalizeLocalImageValue(settings?.sidebarBackgroundImage), uiOpacity: applied.uiOpacity, cardsOpacity: applied.cardsOpacity, ...styleSettings })
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
        root.style.setProperty("--theme-frame-border", theme.frameBorder || "1px solid var(--border)")
        root.style.setProperty("--main-bg-image", theme.mainBackgroundImage || "none")
        root.style.setProperty("--sidebar-bg-image", theme.sidebarBackgroundImage || "none")
    },
    renderPicker({ onSelect, onCreateCustomPreset, activeKey } = {}) {
        const root = document.getElementById("theme-picker-root")
        if (!root) return
        const customPresetKeys = this.getCustomPresets().map(item => `custom:${item.key}`)
        const specialPresetKeys = this.getSpecialPresets().map(item => `special:${item.key}`)
        const customThemesLeft = Math.max(0, this.maxCustomPresets - customPresetKeys.length)
        const groups = [
            { id: "dark", title: getThemeText("theme_group_dark", "Dark themes"), items: ["oled", "soft_slate", "midnight", "dark_forest", "wine_night", "deep_purple", "graphite", "terminal", "amber_accent"] },
            { id: "light", title: getThemeText("theme_group_light", "Light themes"), items: ["standard_light", "retro_typewriter", "ice_cloud", "spring_mint", "sticky_note", "warm_sunset", "soft_rose", "barbie_style", "lavender_dream", "silver"] },
            { id: "custom", title: getThemeText("theme_group_custom", "Custom"), items: customPresetKeys },
            { id: "special", title: getThemeText("theme_group_special", "Special presets"), items: specialPresetKeys }
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
                const isSpecialPreset = key.startsWith("special:")
                const dotElement = document.createElement("span")
                dotElement.className = "theme-dot"
                const customPreset = this.getCustomPresetByKey(key)
                const specialPreset = isSpecialPreset ? this.getSpecialPresets().find(item => `special:${item.key}` === key) : null
                if (specialPreset) {
                    const hint = [specialPreset.name, specialPreset.family, specialPreset.description].filter(Boolean).join(" • ")
                    buttonElement.title = hint
                    buttonElement.setAttribute("aria-label", hint)
                }
                dotElement.style.background = customPreset
                    ? `conic-gradient(${customPreset.p} 0deg 120deg, ${customPreset.bg} 120deg 240deg, ${customPreset.t} 240deg 360deg)`
                    : (specialPreset?.previewColor || this.resolvePreset(key).p)
                buttonElement.appendChild(dotElement)
                buttonElement.addEventListener("click", () => onSelect?.(key))
                presetsGrid.appendChild(buttonElement)
            })

            if (group.id === "custom") {
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
                leftLabel.textContent = formatThemeText("theme_custom_limit", "Custom themes left: {count} of {max}", { count: customThemesLeft, max: this.maxCustomPresets })
                sectionElement.appendChild(leftLabel)
            }
            if (group.id === "special" && !group.items.length) {
                const hintLabel = document.createElement("div")
                hintLabel.className = "theme-custom-limit-label"
                hintLabel.textContent = getThemeText("theme_special_coming_soon", "Special presets will appear here soon")
                sectionElement.appendChild(hintLabel)
            }

            sectionElement.appendChild(presetsGrid)
            root.appendChild(sectionElement)
        })
    },
    updatePresetPreviewDot(presetKey, colors = {}) {
        const key = String(presetKey || "")
        if (!key.startsWith("custom:")) return
        const presetButtons = Array.from(document.querySelectorAll(".theme-item-wrapper[data-theme-key]"))
        const targetButton = presetButtons.find(item => item.dataset.themeKey === key)
        const targetDot = targetButton?.querySelector(".theme-dot")
        if (!targetDot) return
        const primaryColor = this.normalizeHex(colors.p)
        const backgroundColor = this.normalizeHex(colors.bg)
        const textColor = this.normalizeHex(colors.t)
        targetDot.style.background = `conic-gradient(${primaryColor} 0deg 120deg, ${backgroundColor} 120deg 240deg, ${textColor} 240deg 360deg)`
    },
    setupColorInputs(onChange) {
        const bind = (element, type) => {
            if (!element) return
            element.dataset.themeInputType = type
            element.themeInputHandler = onChange
            if (element.dataset.bound === "1") return
            element.dataset.bound = "1"
            element.addEventListener("input", event => {
                const eventTarget = event.currentTarget
                if (!eventTarget || typeof eventTarget.themeInputHandler !== "function") return
                eventTarget.themeInputHandler(eventTarget.dataset.themeInputType, eventTarget.value)
            })
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
window.buildThemeCloudPayload = buildThemeCloudPayload
