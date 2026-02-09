export const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    snap: (value, step) => Math.round(value / step) * step,
    debounce: (func, wait) => {
        let timeout = null
        return function (...args) {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => func.apply(this, args), wait)
        }
    },
    formatDate: (timestamp) => {
        if (!timestamp) return ""
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
        const lang = (typeof StateStore !== "undefined" && StateStore.read().config && StateStore.read().config.lang) || "ru"
        try {
            return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
        } catch {
            return date.toLocaleDateString()
        }
    },
    stripHtml: (html) => {
        if (!html) return ""
        const tmp = document.createElement("div")
        tmp.innerHTML = html
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
    serverTimestamp: () => {
        if (typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue) {
            return firebase.firestore.FieldValue.serverTimestamp()
        }
        return Date.now()
    },
    sanitizeHtml: (html) => {
        const allowedTags = new Set(["b", "strong", "i", "em", "u", "s", "del", "br", "hr", "p", "div", "ul", "ol", "li", "span", "img", "a", "audio", "button", "input", "table", "thead", "tbody", "tfoot", "tr", "td", "th"])
        const allowedClasses = new Set([
            "media-wrapper",
            "media-resize-handle",
            "align-left",
            "align-right",
            "audio-wrapper",
            "audio-player",
            "audio-icon",
            "audio-label",
            "audio-block",
            "audio-controls",
            "audio-play",
            "audio-play-icon",
            "audio-timeline",
            "audio-progress",
            "audio-time",
            "audio-current",
            "audio-duration",
            "audio-volume",
            "audio-title",
            "playing",
            "note-page"
        ])
        const allowAttrs = {
            a: new Set(["href", "target", "rel", "data-note-id"]),
            img: new Set(["src", "alt"]),
            audio: new Set(["src", "controls", "preload"]),
            button: new Set(["type", "aria-label"]),
            input: new Set(["type", "checked", "aria-label"]),
            td: new Set(["colspan", "rowspan"]),
            th: new Set(["colspan", "rowspan"])
        }
        const wrapper = document.createElement("div")
        wrapper.innerHTML = String(html || "")
        const isSafeUrl = (value) => {
            const v = String(value || "").trim()
            if (!v) return false
            if (v.startsWith("data:image")) return true
            if (v.startsWith("data:audio")) return true
            if (v.startsWith("https://")) return true
            if (v.startsWith("http://")) return true
            if (v.startsWith("mailto:")) return true
            return false
        }
        const walk = (node) => {
            const children = Array.from(node.childNodes)
            children.forEach(child => {
                if (child.nodeType !== Node.ELEMENT_NODE) return
                const tag = child.tagName.toLowerCase()
                if (!allowedTags.has(tag)) {
                    const textNode = document.createTextNode(child.textContent || "")
                    child.replaceWith(textNode)
                    return
                }
                Array.from(child.attributes).forEach(attr => {
                    const name = attr.name.toLowerCase()
                    if (name.startsWith("on") || name === "style") {
                        child.removeAttribute(attr.name)
                        return
                    }
                    if (name === "class") {
                        const safe = String(attr.value || "")
                            .split(/\s+/)
                            .filter(cls => allowedClasses.has(cls))
                        if (safe.length) child.setAttribute("class", safe.join(" "))
                        else child.removeAttribute("class")
                        return
                    }
                    const allowed = allowAttrs[tag]
                    if (!allowed || !allowed.has(name)) child.removeAttribute(attr.name)
                })
                if (tag === "a") {
                    const href = child.getAttribute("href")
                    if (!isSafeUrl(href) || String(href || "").startsWith("data:")) {
                        child.removeAttribute("href")
                    } else if (String(href || "").startsWith("http")) {
                        child.setAttribute("rel", "noopener noreferrer")
                        child.setAttribute("target", "_blank")
                    }
                }
                if (tag === "input") {
                    const type = String(child.getAttribute("type") || "").toLowerCase()
                    if (type !== "checkbox") {
                        child.remove()
                        return
                    }
                }
                if (tag === "img") {
                    const src = child.getAttribute("src")
                    const s = String(src || "")
                    if (!isSafeUrl(s) || (s.startsWith("data:") && !s.startsWith("data:image")) || s.startsWith("http:")) {
                        child.removeAttribute("src")
                    }
                }
                if (tag === "audio") {
                    const src = child.getAttribute("src")
                    const s = String(src || "")
                    if (!isSafeUrl(s) || (s.startsWith("data:") && !s.startsWith("data:audio")) || s.startsWith("http:")) {
                        child.removeAttribute("src")
                    }
                }
                walk(child)
            })
        }
        walk(wrapper)
        return wrapper.innerHTML
    }
}
