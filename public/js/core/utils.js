export const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    snap: (value, step) => Math.round(value / step) * step,
    debounce: (func, wait) => {
        let timeout = null
        const debounced = function (...args) {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => func.apply(this, args), wait)
        }
        debounced.cancel = () => {
            if (timeout) {
                clearTimeout(timeout)
                timeout = null
            }
        }
        return debounced
    },
    formatDate: (value) => {
        if (value === null || value === undefined || value === "") return ""
        let date = null
        if (value instanceof Date) {
            date = new Date(value.getTime())
        } else if (typeof value === "string") {
            const parsedTimestamp = Date.parse(value)
            date = new Date(parsedTimestamp)
        } else if (typeof value === "number") {
            date = new Date(value)
        } else {
            date = new Date(value)
        }
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ""
        const lang = (typeof StateStore !== "undefined" && StateStore.read().config && StateStore.read().config.lang) || "ru"
        try {
            return new Intl.DateTimeFormat(lang, {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }).format(date)
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
        return Date.now()
    },
    sanitizeHtml: (html) => {
        const allowedTags = new Set(["b", "strong", "i", "em", "u", "s", "del", "strike", "br", "hr", "p", "div", "ul", "ol", "li", "span", "img", "a", "audio", "source", "button", "input", "table", "thead", "tbody", "tfoot", "tr", "td", "th"])
        const allowedClasses = new Set([
            "media-wrapper",
            "media-resize-handle",
            "align-left",
            "align-right",
            "align-center",
            "audio-wrapper",
            "audio-player",
            "audio-icon",
            "audio-label",
            "audio-block",
            "audio-controls",
            "audio-play",
            "audio-play-icon",
            "audio-control-icon",
            "audio-drag-handle",
            "audio-delete",
            "audio-timeline",
            "audio-title-row",
            "audio-progress",
            "audio-time",
            "audio-current",
            "audio-duration",
            "audio-volume",
            "audio-title",
            "media-draggable-item",
            "playing",
            "note-page",
            "note-drawing"
        ])
        const allowAttrs = {
            a: new Set(["href", "target", "rel", "data-note-id"]),
            img: new Set(["src", "alt", "width", "height"]),
            div: new Set(["id", "contenteditable", "draggable", "data-width", "data-height", "data-align", "align", "style"]),
            p: new Set(["data-align", "align", "style"]),
            li: new Set(["data-align", "align", "style"]),
            h1: new Set(["data-align", "align", "style"]),
            h2: new Set(["data-align", "align", "style"]),
            h3: new Set(["data-align", "align", "style"]),
            h4: new Set(["data-align", "align", "style"]),
            h5: new Set(["data-align", "align", "style"]),
            h6: new Set(["data-align", "align", "style"]),
            blockquote: new Set(["data-align", "align", "style"]),
            audio: new Set(["src", "controls", "preload"]),
            source: new Set(["src", "type"]),
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
        const normalizeStyle = (tag, styleValue) => {
            const declarations = String(styleValue || "").split(";").map(part => part.trim()).filter(Boolean)
            if (!declarations.length) return ""
            const normalized = []
            declarations.forEach(declaration => {
                const separatorIndex = declaration.indexOf(":")
                if (separatorIndex < 0) return
                const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
                const value = declaration.slice(separatorIndex + 1).trim().toLowerCase()
                const textAlignAllowedTags = new Set(["div", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"])
                if (property === "text-align" && textAlignAllowedTags.has(tag) && ["left", "right", "center", "justify"].includes(value)) {
                    normalized.push(`text-align:${value}`)
                    return
                }
                if ((property === "width" || property === "height") && tag === "img") {
                    if (/^\d+(\.\d+)?px$/.test(value)) normalized.push(`${property}:${value}`)
                }
            })
            return normalized.join(";")
        }

        const sanitizeNumericDataAttribute = (element, attributeName) => {
            const rawValue = element.getAttribute(attributeName)
            if (rawValue === null) return
            const parsed = Number.parseFloat(rawValue)
            if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5000) {
                element.removeAttribute(attributeName)
                return
            }
            element.setAttribute(attributeName, String(Math.round(parsed * 100) / 100))
        }

        const sanitizeTextAlignmentAttribute = (element, attributeName) => {
            const value = String(element.getAttribute(attributeName) || "").trim().toLowerCase()
            if (!["left", "right", "center", "justify"].includes(value)) {
                element.removeAttribute(attributeName)
                return
            }
            element.setAttribute(attributeName, value)
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
                    if (name.startsWith("on")) {
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
                if (child.hasAttribute("style")) {
                    const normalizedStyle = normalizeStyle(tag, child.getAttribute("style"))
                    if (normalizedStyle) child.setAttribute("style", normalizedStyle)
                    else child.removeAttribute("style")
                }
                if (child.hasAttribute("align")) {
                    sanitizeTextAlignmentAttribute(child, "align")
                    const alignValue = child.getAttribute("align")
                    if (alignValue) {
                        const normalizedStyle = normalizeStyle(tag, `text-align:${alignValue}`)
                        if (normalizedStyle) child.setAttribute("style", normalizedStyle)
                    }
                    child.removeAttribute("align")
                }
                if (tag === "div" && child.classList.contains("media-wrapper")) {
                    sanitizeNumericDataAttribute(child, "data-width")
                    sanitizeNumericDataAttribute(child, "data-height")
                }
                if (child.hasAttribute("data-align")) sanitizeTextAlignmentAttribute(child, "data-align")

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
                    const width = Number.parseFloat(child.getAttribute("width") || "")
                    const height = Number.parseFloat(child.getAttribute("height") || "")
                    if (!Number.isFinite(width) || width <= 0 || width > 5000) child.removeAttribute("width")
                    if (!Number.isFinite(height) || height <= 0 || height > 5000) child.removeAttribute("height")
                }
                if (tag === "audio") {
                    const src = child.getAttribute("src")
                    const s = String(src || "")
                    if (!isSafeUrl(s) || (s.startsWith("data:") && !s.startsWith("data:audio")) || s.startsWith("http:")) {
                        child.removeAttribute("src")
                    }
                }
                if (tag === "source") {
                    const sourceParent = child.parentElement?.tagName?.toLowerCase()
                    if (sourceParent !== "audio") {
                        child.remove()
                        return
                    }
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

