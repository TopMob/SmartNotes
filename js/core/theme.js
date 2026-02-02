;(() => {
  if (window.ThemeManager) return

  const presets = {
    dark: { p: "#0ea5e9", bg: "#020617", t: "#e5e7eb" },
    light: { p: "#2563eb", bg: "#f8fafc", t: "#020617" },
    purple: { p: "#a855f7", bg: "#07040f", t: "#f5f3ff" },
    green: { p: "#22c55e", bg: "#030a06", t: "#ecfdf5" },
    red: { p: "#ef4444", bg: "#0a0404", t: "#fef2f2" },
    blue: { p: "#3b82f6", bg: "#04070f", t: "#eff6ff" }
  }

  const applyVars = ({ p, bg, t }) => {
    const root = document.documentElement
    root.style.setProperty("--primary", p)
    root.style.setProperty("--bg", bg)
    root.style.setProperty("--text", t)

    const rgb = Utils.hexToRgb(p)
    if (rgb) root.style.setProperty("--primary-rgb", `${rgb.r},${rgb.g},${rgb.b}`)

    root.style.setProperty("--shadow-lg", `0 20px 40px rgba(0,0,0,0.6)`)
    root.style.setProperty("--shadow-sm", `0 10px 20px rgba(0,0,0,0.4)`)
  }

  const apply = (key) => {
    const preset = presets[key] || presets.dark
    applyVars(preset)
    localStorage.setItem("theme", key)
  }

  const init = () => {
    const saved = localStorage.getItem("theme") || "dark"
    apply(saved)
  }

  window.ThemeManager = { init, apply, presets }
})()
