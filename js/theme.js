export const ThemeManager = {
    themes: {
        dark: {
            p: "#00f2ff",
            bg: "#050505",
            t: "#ffffff",
            surface: "#0d0d10",
            surfaceTransparent: "rgba(8, 8, 12, 0.72)",
            border: "rgba(255, 255, 255, 0.12)",
            blur: 18,
            motion: 1.0,
            density: 1,
            radius: 12,
            radiusScale: 1,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.0,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.7,
            editorLetterSpacing: "0px",
            shadow: "0 20px 40px rgba(0, 0, 0, 0.55)",
            shadowSmall: "0 10px 18px rgba(0, 0, 0, 0.4)",
            toolbarBg: "rgba(255, 255, 255, 0.03)",
            toolbarBorder: "rgba(255, 255, 255, 0.08)",
            toolbarShadow: "0 16px 28px rgba(0, 0, 0, 0.55)"
        },
        system: { preset: "system" },
        light: {
            p: "#2563eb",
            bg: "#f8fafc",
            t: "#0b1220",
            surface: "#ffffff",
            surfaceTransparent: "rgba(255, 255, 255, 0.72)",
            border: "rgba(2, 6, 23, 0.12)",
            blur: 10,
            motion: 1.0,
            density: 1,
            radius: 12,
            radiusScale: 1,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.0,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.68,
            editorLetterSpacing: "0px",
            shadow: "0 18px 30px rgba(2, 6, 23, 0.16)",
            shadowSmall: "0 10px 18px rgba(2, 6, 23, 0.12)",
            toolbarBg: "rgba(2, 6, 23, 0.04)",
            toolbarBorder: "rgba(2, 6, 23, 0.08)",
            toolbarShadow: "0 14px 24px rgba(2, 6, 23, 0.08)"
        },
        graphite: {
            p: "#9ca3af",
            bg: "#0a0b0d",
            t: "#f3f4f6",
            surface: "#111316",
            surfaceTransparent: "rgba(15, 17, 20, 0.78)",
            border: "rgba(148, 163, 184, 0.18)",
            blur: 8,
            motion: 0.9,
            density: 0.95,
            radius: 10,
            radiusScale: 0.95,
            fontBase: 15,
            hitSize: 42,
            typeScale: 0.98,
            spaceUnit: 11,
            editorPadding: 28,
            editorLineHeight: 1.65,
            editorLetterSpacing: "0.2px",
            shadow: "0 16px 26px rgba(0, 0, 0, 0.6)",
            shadowSmall: "0 8px 14px rgba(0, 0, 0, 0.45)",
            toolbarBg: "rgba(156, 163, 175, 0.06)",
            toolbarBorder: "rgba(148, 163, 184, 0.18)",
            toolbarShadow: "0 12px 20px rgba(0, 0, 0, 0.55)"
        },
        neon_cyan: {
            p: "#00f2ff",
            bg: "#03040a",
            t: "#ffffff",
            surface: "#0b0e1c",
            surfaceTransparent: "rgba(4, 8, 18, 0.7)",
            border: "rgba(0, 242, 255, 0.22)",
            blur: 24,
            motion: 1.08,
            density: 1.02,
            radius: 14,
            radiusScale: 1.08,
            fontBase: 16,
            hitSize: 46,
            typeScale: 1.03,
            spaceUnit: 13,
            editorPadding: 34,
            editorLineHeight: 1.76,
            editorLetterSpacing: "0.2px",
            shadow: "0 30px 60px rgba(0, 0, 0, 0.72)",
            shadowSmall: "0 14px 24px rgba(0, 0, 0, 0.55)",
            toolbarBg: "rgba(0, 242, 255, 0.12)",
            toolbarBorder: "rgba(191, 255, 255, 0.24)",
            toolbarShadow: "0 20px 36px rgba(0, 0, 0, 0.72)"
        },
        emerald_calm: {
            p: "#22c55e",
            bg: "#040a06",
            t: "#f4fff8",
            surface: "#0a1410",
            surfaceTransparent: "rgba(6, 14, 10, 0.74)",
            border: "rgba(34, 197, 94, 0.18)",
            blur: 16,
            motion: 0.96,
            density: 1,
            radius: 12,
            radiusScale: 1.02,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.01,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.72,
            editorLetterSpacing: "0.05px",
            shadow: "0 22px 44px rgba(0, 0, 0, 0.6)",
            shadowSmall: "0 12px 20px rgba(0, 0, 0, 0.42)",
            toolbarBg: "rgba(34, 197, 94, 0.08)",
            toolbarBorder: "rgba(180, 255, 210, 0.16)",
            toolbarShadow: "0 16px 26px rgba(0, 0, 0, 0.58)"
        },
        violet_pulse: {
            p: "#a855f7",
            bg: "#07050b",
            t: "#f8f7ff",
            surface: "#120d1f",
            surfaceTransparent: "rgba(12, 8, 24, 0.7)",
            border: "rgba(168, 85, 247, 0.2)",
            blur: 22,
            motion: 1.05,
            density: 1.02,
            radius: 14,
            radiusScale: 1.12,
            fontBase: 16,
            hitSize: 46,
            typeScale: 1.02,
            spaceUnit: 13,
            editorPadding: 34,
            editorLineHeight: 1.75,
            editorLetterSpacing: "0.15px",
            shadow: "0 28px 54px rgba(0, 0, 0, 0.68)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.48)",
            toolbarBg: "rgba(168, 85, 247, 0.12)",
            toolbarBorder: "rgba(248, 247, 255, 0.18)",
            toolbarShadow: "0 20px 32px rgba(0, 0, 0, 0.62)"
        },
        crimson_glow: {
            p: "#ef4444",
            bg: "#0c0607",
            t: "#fff5f5",
            surface: "#160a0c",
            surfaceTransparent: "rgba(14, 6, 8, 0.72)",
            border: "rgba(239, 68, 68, 0.2)",
            blur: 18,
            motion: 1.02,
            density: 1,
            radius: 12,
            radiusScale: 1.05,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.01,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.72,
            editorLetterSpacing: "0.08px",
            shadow: "0 24px 46px rgba(0, 0, 0, 0.65)",
            shadowSmall: "0 12px 20px rgba(0, 0, 0, 0.5)",
            toolbarBg: "rgba(239, 68, 68, 0.08)",
            toolbarBorder: "rgba(255, 205, 205, 0.2)",
            toolbarShadow: "0 18px 28px rgba(0, 0, 0, 0.6)"
        },
        amber_wave: {
            p: "#f97316",
            bg: "#0c0805",
            t: "#fff4e6",
            surface: "#18100b",
            surfaceTransparent: "rgba(16, 9, 6, 0.74)",
            border: "rgba(249, 115, 22, 0.2)",
            blur: 16,
            motion: 1.0,
            density: 1,
            radius: 12,
            radiusScale: 1.03,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.01,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.7,
            editorLetterSpacing: "0.05px",
            shadow: "0 22px 44px rgba(0, 0, 0, 0.6)",
            shadowSmall: "0 12px 20px rgba(0, 0, 0, 0.48)",
            toolbarBg: "rgba(249, 115, 22, 0.08)",
            toolbarBorder: "rgba(255, 221, 183, 0.18)",
            toolbarShadow: "0 16px 26px rgba(0, 0, 0, 0.58)"
        },
        rose_blush: {
            p: "#ec4899",
            bg: "#0c060a",
            t: "#fff6fb",
            surface: "#160b12",
            surfaceTransparent: "rgba(14, 7, 11, 0.72)",
            border: "rgba(236, 72, 153, 0.2)",
            blur: 20,
            motion: 1.03,
            density: 1.01,
            radius: 12,
            radiusScale: 1.06,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.02,
            spaceUnit: 12,
            editorPadding: 32,
            editorLineHeight: 1.73,
            editorLetterSpacing: "0.1px",
            shadow: "0 26px 50px rgba(0, 0, 0, 0.66)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.5)",
            toolbarBg: "rgba(236, 72, 153, 0.1)",
            toolbarBorder: "rgba(255, 210, 234, 0.2)",
            toolbarShadow: "0 18px 30px rgba(0, 0, 0, 0.62)"
        },
        ocean_deep: {
            p: "#3b82f6",
            bg: "#03060f",
            t: "#f0f6ff",
            surface: "#0b1222",
            surfaceTransparent: "rgba(5, 9, 20, 0.72)",
            border: "rgba(59, 130, 246, 0.2)",
            blur: 20,
            motion: 1.02,
            density: 1.01,
            radius: 12,
            radiusScale: 1.04,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.02,
            spaceUnit: 13,
            editorPadding: 32,
            editorLineHeight: 1.74,
            editorLetterSpacing: "0.12px",
            shadow: "0 26px 50px rgba(0, 0, 0, 0.7)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.5)",
            toolbarBg: "rgba(59, 130, 246, 0.1)",
            toolbarBorder: "rgba(208, 226, 255, 0.18)",
            toolbarShadow: "0 18px 32px rgba(0, 0, 0, 0.65)"
        },
        oled_pure: {
            p: "#00f2ff",
            bg: "#000000",
            t: "#ffffff",
            surface: "#050505",
            surfaceTransparent: "rgba(0, 0, 0, 0.82)",
            border: "rgba(255, 255, 255, 0.16)",
            blur: 12,
            motion: 0.9,
            density: 0.96,
            radius: 10,
            radiusScale: 0.95,
            fontBase: 15,
            hitSize: 42,
            typeScale: 0.98,
            spaceUnit: 11,
            editorPadding: 28,
            editorLineHeight: 1.62,
            editorLetterSpacing: "0.3px",
            shadow: "0 18px 32px rgba(0, 0, 0, 0.82)",
            shadowSmall: "0 10px 18px rgba(0, 0, 0, 0.7)",
            toolbarBg: "rgba(255, 255, 255, 0.02)",
            toolbarBorder: "rgba(255, 255, 255, 0.12)",
            toolbarShadow: "0 16px 28px rgba(0, 0, 0, 0.82)"
        }
    },
    storageKey: "app-theme",
    init() {
        const saved = this.getSavedSettings()
        this.applySettings(saved, false)
    },
    getDefaultSettings() {
        return { preset: "dark" }
    },
    getSavedSettings() {
        const raw = localStorage.getItem(this.storageKey)
        if (!raw) return this.getDefaultSettings()
        try {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === "object") return parsed
        } catch {}
        return this.getDefaultSettings()
    },
    saveSettings(settings) {
        localStorage.setItem(this.storageKey, JSON.stringify(settings))
    },
    resolvePreset(key) {
        if (key === "system") {
            const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            return prefersDark ? this.themes.dark : this.themes.light
        }
        return this.themes[key] || this.themes.dark
    },
    applySettings(settings, persist) {
        const presetKey = settings?.preset || "dark"
        let base = presetKey === "manual" ? null : this.resolvePreset(presetKey)
        if (!base) {
            const isLight = this.isLightColor(settings?.bg || this.themes.dark.bg)
            base = isLight ? this.themes.light : this.themes.dark
        }
        const applied = {
            ...base,
            p: settings?.p || base.p,
            bg: settings?.bg || base.bg,
            t: settings?.t || base.t
        }
        this.applyToRoot(applied)
        if (persist) this.saveSettings({ preset: presetKey, p: applied.p, bg: applied.bg, t: applied.t })
    },
    applyToRoot(theme) {
        const root = document.documentElement
        const rgb = this.hexToRgb(theme.p)
        const reduceMotion = !!(window.StateStore && StateStore.read()?.config?.reduceMotion)
        root.style.setProperty("--primary", theme.p)
        root.style.setProperty("--primary-rgb", rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : "0, 242, 255")
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
    },
        renderPicker({ onSelect, activeKey, manualColor } = {}) {
            const root = document.getElementById("theme-picker-root")
            if (!root) return
            const items = [
                { key: "dark", labelKey: "theme_dark_default" },
                { key: "graphite", labelKey: "theme_graphite" },
                { key: "neon_cyan", labelKey: "theme_neon_cyan" },
                { key: "emerald_calm", labelKey: "theme_emerald_calm" },
                { key: "violet_pulse", labelKey: "theme_violet_pulse" },
                { key: "crimson_glow", labelKey: "theme_crimson_glow" },
                { key: "amber_wave", labelKey: "theme_amber_wave" },
                { key: "rose_blush", labelKey: "theme_rose_blush" },
                { key: "ocean_deep", labelKey: "theme_ocean_deep" },
                { key: "oled_pure", labelKey: "theme_oled_pure" },
                { key: "light", labelKey: "theme_light" },
            { key: "system", labelKey: "theme_system" },
            { key: "manual", labelKey: "theme_manual" }
        ]
        root.innerHTML = ""
        items.forEach(item => {
            const wrapper = document.createElement("button")
            wrapper.type = "button"
            wrapper.className = "theme-item-wrapper"
            wrapper.dataset.themeKey = item.key
            if (activeKey === item.key) wrapper.classList.add("active")
            const dot = document.createElement("span")
            dot.className = "theme-dot"
            const color = item.key === "manual" ? (manualColor || this.themes.dark.p) : this.resolvePreset(item.key).p
            dot.style.background = color
            if (activeKey === item.key) dot.classList.add("active")
            const labelText = window.UI && UI.getText ? UI.getText(item.labelKey, item.key) : item.key
            wrapper.setAttribute("aria-label", labelText)
            wrapper.title = labelText
            wrapper.appendChild(dot)
            wrapper.addEventListener("click", () => {
                if (typeof onSelect === "function") onSelect(item.key)
            })
            root.appendChild(wrapper)
        })
    },
    setupColorInputs(onChange) {
        const primary = document.getElementById("cp-primary")
        const bg = document.getElementById("cp-bg")
        const text = document.getElementById("cp-text")
        const bind = (el, type) => {
            if (!el) return
            el.addEventListener("input", e => {
                if (typeof onChange === "function") onChange(type, e.target.value)
            })
        }
        bind(primary, "p")
        bind(bg, "bg")
        bind(text, "t")
    },
    syncInputs(p, bg, t) {
        const primary = document.getElementById("cp-primary")
        const bgInput = document.getElementById("cp-bg")
        const text = document.getElementById("cp-text")
        if (primary) primary.value = this.normalizeHex(p)
        if (bgInput) bgInput.value = this.normalizeHex(bg)
        if (text) text.value = this.normalizeHex(t)
    },
    revertToLastSaved() {
        const saved = this.getSavedSettings()
        this.applySettings(saved, false)
    },
    normalizeHex(value) {
        const v = String(value || "").trim()
        if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
        if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`
        return "#000000"
    },
    hexToRgb(hex) {
        const v = this.normalizeHex(hex)
        const num = parseInt(v.slice(1), 16)
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
    },
    fadeColor(hex, alpha) {
        const rgb = this.hexToRgb(hex)
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
    },
    isLightColor(hex) {
        const rgb = this.hexToRgb(hex)
        const l = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
        return l > 0.6
    }
}

window.ThemeManager = ThemeManager
