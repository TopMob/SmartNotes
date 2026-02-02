;(() => {
  const existing = window.Utils
  if (existing) return

  const isHex6 = (s) => /^[0-9a-fA-F]{6}$/.test(s)
  const normalizeHex = (hex) => {
    let v = String(hex || "").trim()
    if (v.startsWith("#")) v = v.slice(1)
    if (v.length === 3) v = v.split("").map((x) => x + x).join("")
    if (!isHex6(v)) return null
    return v.toLowerCase()
  }

  const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    snap: (value, step) => Math.round(value / step) * step,
    debounce: (func, wait) => {
      let timeoutId = null
      return function (...args) {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => func.apply(this, args), wait)
      }
    },
    formatDate: (timestamp) => {
      if (!timestamp) return ""
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
      const lang = (window.state && window.state.config && window.state.config.lang) || "ru"
      try {
        return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
      } catch {
        return date.toLocaleDateString()
      }
    },
    stripHtml: (html) => {
      if (!html) return ""
      const tmp = document.createElement("div")
      tmp.innerHTML = String(html)
      return tmp.textContent || tmp.innerText || ""
    },
    escapeHtml: (value) => {
      if (value === null || value === undefined) return ""
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
    },
    hexToRgb: (hex) => {
      const v = normalizeHex(hex)
      if (!v) return null
      const num = parseInt(v, 16)
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
    },
    adjustColor: (hex, amt) => {
      const v = normalizeHex(hex)
      if (!v) return "#000000"
      const num = parseInt(v, 16)
      let r = ((num >> 16) & 255) + amt
      let g = ((num >> 8) & 255) + amt
      let b = (num & 255) + amt
      r = Math.min(255, Math.max(0, r))
      g = Math.min(255, Math.max(0, g))
      b = Math.min(255, Math.max(0, b))
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
    }
  }

  window.Utils = Utils
})()
