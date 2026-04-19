import { normalizeFragmentParagraphModel } from "./paragraph-model.js"

export const createClipboardHandlers = (context) => {
    const {
        queueSnapshot,
        fileToDataUrl,
        insertMedia,
        insertFragmentAtSelection,
        createFragmentFromHtml,
        getActiveRangeInContent,
        restoreSelection,
        storeSelection,
        normalizeActivePage
    } = context

    const removableWrapperTags = new Set(["div", "section", "article", "main"])
    const structuralTags = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre", "hr", "table", "tbody", "thead", "tr", "td", "th"])

    const resolveExternalMediaMessage = (error, options = {}) => {
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const descriptor = mediaService?.resolveUserFacingError?.(error, options) || (options.attachmentOnly
            ? { messageKey: "external_attachment_unavailable", fallbackMessage: "Disk is not connected, attachment unavailable" }
            : { messageKey: "external_storage_unlinked", fallbackMessage: "External storage is not connected" })
        return UI.getText(descriptor.messageKey, descriptor.fallbackMessage)
    }

    const stripOfficeNamespaces = (value) => String(value || "")
        .replace(/<\/?(?:o|v|w|m):[^>]*>/gi, "")
        .replace(/\s+xmlns(?::\w+)?="[^"]*"/gi, "")

    const normalizePastedHtml = (html) => {
        const container = document.createElement("div")
        container.innerHTML = stripOfficeNamespaces(html)

        Array.from(container.querySelectorAll("meta,link,style,script,title,xml")).forEach(node => node.remove())

        Array.from(container.querySelectorAll("span")).forEach(span => {
            const text = span.textContent || ""
            if (span.attributes.length === 0 && !text.includes("\u00a0")) {
                while (span.firstChild) span.parentNode?.insertBefore(span.firstChild, span)
                span.remove()
            }
        })

        ;["html", "body"].forEach(selector => {
            const wrapper = container.querySelector(selector)
            if (!wrapper) return
            const fragment = document.createDocumentFragment()
            while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild)
            wrapper.replaceWith(fragment)
        })

        if (container.childNodes.length === 1) {
            const onlyChild = container.firstChild
            if (onlyChild?.nodeType === Node.ELEMENT_NODE) {
                const tagName = onlyChild.tagName.toLowerCase()
                if (removableWrapperTags.has(tagName) && onlyChild.attributes.length === 0) {
                    const fragment = document.createDocumentFragment()
                    while (onlyChild.firstChild) fragment.appendChild(onlyChild.firstChild)
                    onlyChild.replaceWith(fragment)
                }
            }
        }

        return container.innerHTML
    }

    const sanitizePastedFragment = (fragment) => {
        const sanitizeNode = (node) => {
            if (!node) return null
            if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "")
            if (node.nodeType !== Node.ELEMENT_NODE) return null

            const sourceTag = String(node.tagName || "").toLowerCase()
            if (sourceTag === "br") return document.createElement("br")
            if (sourceTag === "hr") return document.createElement("hr")

            const normalizedTag = sourceTag === "div" ? "p" : sourceTag
            const keepTag = structuralTags.has(normalizedTag) ? normalizedTag : null
            const container = keepTag ? document.createElement(keepTag) : document.createDocumentFragment()

            if (keepTag === "a") {
                const href = String(node.getAttribute("href") || "").trim()
                if (/^(https?:|mailto:|tel:)/i.test(href)) {
                    container.setAttribute("href", href)
                    container.setAttribute("target", "_blank")
                    container.setAttribute("rel", "noopener noreferrer")
                }
            }

            Array.from(node.childNodes || []).forEach(child => {
                const sanitizedChild = sanitizeNode(child)
                if (sanitizedChild) container.appendChild(sanitizedChild)
            })

            if (keepTag && normalizedTag !== "br") {
                const text = (container.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
                const hasMeaningfulChildren = !!container.querySelector("img,audio,video,table,hr,br,li,ul,ol")
                if (!text && !hasMeaningfulChildren && !["p", "li", "td", "th"].includes(normalizedTag)) return null
                if (["p", "li"].includes(normalizedTag) && !text && !hasMeaningfulChildren) {
                    container.appendChild(document.createElement("br"))
                }
            }
            return container
        }

        const output = document.createDocumentFragment()
        Array.from(fragment.childNodes || []).forEach(child => {
            const sanitizedNode = sanitizeNode(child)
            if (sanitizedNode) output.appendChild(sanitizedNode)
        })
        return normalizeFragmentParagraphModel(output)
    }

    const normalizeClipboardPlainText = (value) => String(value || "")
        .replace(/\r\n?/g, "\n")
        .replace(/\u200b/g, "")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")

    const fragmentToPlainText = (node) => {
        if (!node) return ""
        const container = document.createElement("div")
        container.appendChild(node.cloneNode(true))
        const blocks = Array.from(container.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote"))
        if (!blocks.length) return normalizeClipboardPlainText(container.textContent || "")
        const lines = blocks.map(block => String(block.textContent || "").replace(/\u200b/g, "").trim())
        while (lines.length && lines[0] === "") lines.shift()
        while (lines.length && lines[lines.length - 1] === "") lines.pop()
        return lines.join("\n")
    }

    const hasRichContentWithoutText = (container) => !!container?.querySelector?.("img,audio,video,table,hr")

    const plainTextToFragment = (plainText) => {
        const fragment = document.createDocumentFragment()
        const normalizedText = String(plainText || "").replace(/\r\n?/g, "\n")
        const rows = normalizedText.split("\n")
        rows.forEach(line => {
            const paragraph = document.createElement("p")
            if (line) paragraph.textContent = line
            else paragraph.appendChild(document.createElement("br"))
            fragment.appendChild(paragraph)
        })
        return fragment
    }

    const hasRenderableNodes = (fragment) => {
        if (!fragment) return false
        const text = (fragment.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
        if (text) return true
        if (fragment.querySelector && fragment.querySelector("br,hr,p,li,ul,ol,h1,h2,h3,h4,h5,h6,blockquote,table")) return true
        return false
    }

    const handlePaste = async (event) => {
        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find(item => item.type && item.type.startsWith("image/"))
        if (imageItem) {
            event.preventDefault()
            const file = imageItem.getAsFile()
            if (!file) return
            try {
                const url = await fileToDataUrl(file)
                insertMedia(url, "image")
            } catch (error) {
                const errorCode = String(error?.message || error?.code || "")
                if (errorCode.includes("external-") || errorCode.startsWith("drive-")) {
                    UI.showToast(resolveExternalMediaMessage(error, { attachmentOnly: true }))
                    return
                }
                throw error
            }
            return
        }

        event.preventDefault()
        const ownHtml = event.clipboardData?.getData("application/x-smartnotes-html") || ""
        const html = ownHtml || event.clipboardData?.getData("text/html") || ""
        const plainText = normalizeClipboardPlainText(event.clipboardData?.getData("text/plain") || "")

        if (html) {
            const normalizedHtml = normalizePastedHtml(html)
            const sanitizedHtml = normalizedHtml ? Utils.sanitizeHtml(normalizedHtml) : ""
            if (sanitizedHtml) {
                const fragment = sanitizePastedFragment(createFragmentFromHtml(sanitizedHtml))
                if (hasRenderableNodes(fragment) && insertFragmentAtSelection(fragment)) {
                    normalizeActivePage()
                    queueSnapshot()
                    return
                }
            }
        }

        if (insertFragmentAtSelection(plainTextToFragment(plainText))) {
            normalizeActivePage()
            queueSnapshot()
        }
    }

    const handleCopy = (event) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
        const range = getActiveRangeInContent()
        if (!range) return
        const fragment = range.cloneContents()
        const container = document.createElement("div")
        container.appendChild(fragment)
        const plainText = fragmentToPlainText(container)
        if (!plainText.trim() && !hasRichContentWithoutText(container)) return
        event.preventDefault()
        event.clipboardData?.setData("text/plain", plainText)
        event.clipboardData?.setData("text/html", container.innerHTML)
        event.clipboardData?.setData("application/x-smartnotes-html", container.innerHTML)
    }

    const handleCut = (event) => {
        const range = restoreSelection() || getActiveRangeInContent()
        if (!range || range.collapsed) return
        handleCopy(event)
        if (!event.defaultPrevented) event.preventDefault()
        range.deleteContents()
        normalizeActivePage()
        storeSelection()
        queueSnapshot()
    }

    return {
        handlePaste,
        handleCopy,
        handleCut,
        normalizeClipboardPlainText,
        fragmentToPlainText
    }
}