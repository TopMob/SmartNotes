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

const createPreset = (bg, t, p) => ({ ...baseTheme, bg, t, p, surface: bg, surfaceTransparent: `color-mix(in srgb, ${bg} 86%, transparent)`, border: `color-mix(in srgb, ${t} 18%, transparent)`, toolbarBg: `color-mix(in srgb, ${bg} 80%, ${p} 20%)`, toolbarBorder: `color-mix(in srgb, ${t} 16%, transparent)` })

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
    init() {
        this.applySettings(this.getSavedSettings(), false)
    },
    getDefaultSettings() {
        return { preset: "oled", mainBackgroundImage: "", sidebarBackgroundImage: "" }
    },
    getSavedSettings() {
        try {
            const parsed = JSON.parse(localStorage.getItem(this.storageKey) || "")
            if (parsed && typeof parsed === "object") return parsed
        } catch {}
        return this.getDefaultSettings()
    },
    saveSettings(settings) {
        localStorage.setItem(this.storageKey, JSON.stringify(settings))
    },
    resolvePreset(key) {
        return this.themes[key] || this.themes.oled
    },
    applySettings(settings, persist) {
        const presetKey = settings?.preset || "oled"
        const base = this.resolvePreset(presetKey)
        const applied = { ...base, p: settings?.p || base.p, bg: settings?.bg || base.bg, t: settings?.t || base.t }
        this.applyToRoot({ ...applied, mainBackgroundImage: this.prepareBackgroundImage(settings?.mainBackgroundImage), sidebarBackgroundImage: this.prepareBackgroundImage(settings?.sidebarBackgroundImage) })
        document.documentElement.dataset.themePreset = presetKey
        if (persist) {
            this.saveSettings({ preset: presetKey, p: applied.p, bg: applied.bg, t: applied.t, mainBackgroundImage: settings?.mainBackgroundImage || "", sidebarBackgroundImage: settings?.sidebarBackgroundImage || "" })
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
        root.style.setProperty("--surface-transparent", theme.surfaceTransparent)
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
    renderPicker({ onSelect, activeKey, manualColor } = {}) {
        const root = document.getElementById("theme-picker-root")
        if (!root) return
        const items = [
            "oled","standard_light","soft_slate","retro_typewriter","ice_cloud","midnight","spring_mint","dark_forest","sticky_note","warm_sunset","soft_rose","wine_night","barbie_style","lavender_dream","deep_purple","silver","graphite","terminal","manual"
        ]
        root.innerHTML = ""
        items.forEach(key => {
            const wrapper = document.createElement("button")
            wrapper.type = "button"
            wrapper.className = "theme-item-wrapper"
            wrapper.dataset.themeKey = key
            if (activeKey === key) wrapper.classList.add("active")
            const dot = document.createElement("span")
            dot.className = "theme-dot"
            dot.style.background = key === "manual" ? (manualColor || this.themes.oled.p) : this.resolvePreset(key).p
            wrapper.appendChild(dot)
            wrapper.addEventListener("click", () => onSelect?.(key))
            root.appendChild(wrapper)
        })
    },
    setupColorInputs(onChange) {
        const bind = (el, type) => el?.addEventListener("input", event => onChange?.(type, event.target.value))
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
