export const createClipboardHandlers = (context) => {
    const {
        elements,
        queueSnapshot,
        fileToDataUrl,
        insertMedia,
        insertFragmentAtSelection,
        createFragmentFromHtml,
        getActiveRangeInContent,
        restoreSelection,
        storeSelection
    } = context

    const removableWrapperTags = new Set(["div", "section", "article", "main"])
    const structuralTags = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre"])
    const blockLikeTags = new Set(["p", "div", "section", "article", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"])

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

        Array.from(container.querySelectorAll("p,div")).forEach(block => {
            const hasMedia = !!block.querySelector("img,audio,video,table,hr,br")
            const text = (block.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
            if (!hasMedia && !text) block.remove()
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
                if (!text && !hasMeaningfulChildren && normalizedTag !== "p" && normalizedTag !== "li") return null
                if ((normalizedTag === "p" || normalizedTag === "li") && !text && !hasMeaningfulChildren) {
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
        return output
    }

    const collapseAlternatingEmptyRows = (rows) => {
        if (!Array.isArray(rows) || rows.length < 3) return rows
        let hasPattern = true
        let hasEmptyRows = false
        rows.forEach((row, index) => {
            const isEmpty = row.trim() === ""
            if (index % 2 === 1) {
                if (!isEmpty) hasPattern = false
                else hasEmptyRows = true
                return
            }
            if (isEmpty) hasPattern = false
        })
        if (!hasPattern || !hasEmptyRows) return rows
        return rows.filter((_, index) => index % 2 === 0)
    }

    const normalizeClipboardPlainText = (value) => {
        const normalized = String(value || "").replace(/\r\n?/g, "\n")
        const rows = collapseAlternatingEmptyRows(normalized.split("\n"))
        while (rows.length && rows[0].trim() === "") rows.shift()
        while (rows.length && rows[rows.length - 1].trim() === "") rows.pop()
        const compact = []
        let previousWasEmpty = false
        rows.forEach(row => {
            const isEmpty = row.trim() === ""
            if (isEmpty && previousWasEmpty) return
            compact.push(row)
            previousWasEmpty = isEmpty
        })
        return compact.join("\n")
    }

    const fragmentToPlainText = (fragment) => {
        const output = []
        const append = (value) => {
            if (!value) return
            output.push(value)
        }
        const appendLineBreak = () => {
            if (!output.length) return
            const last = output[output.length - 1]
            if (last === "\n") return
            output.push("\n")
        }
        const visit = (node) => {
            if (!node) return
            if (node.nodeType === Node.TEXT_NODE) {
                append(node.textContent || "")
                return
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return
            const tag = String(node.tagName || "").toLowerCase()
            if (tag === "br") {
                appendLineBreak()
                return
            }
            if (tag === "li") append("• ")
            Array.from(node.childNodes || []).forEach(visit)
            if (blockLikeTags.has(tag)) appendLineBreak()
        }
        Array.from(fragment.childNodes || []).forEach(visit)
        return normalizeClipboardPlainText(output.join(""))
    }

    const plainTextToFragment = (plainText) => {
        const fragment = document.createDocumentFragment()
        const normalizedText = String(plainText || "").replace(/\r\n?/g, "\n")
        const rows = normalizedText.split("\n")
        rows.forEach((line, index) => {
            if (index > 0) fragment.appendChild(document.createElement("br"))
            fragment.appendChild(document.createTextNode(line))
        })
        return fragment
    }

    const hasRenderableNodes = (fragment) => {
        if (!fragment) return false
        const text = (fragment.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
        if (text) return true
        if (fragment.querySelector && fragment.querySelector("br,hr,p,li,ul,ol,h1,h2,h3,h4,h5,h6,blockquote")) return true
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
                    queueSnapshot()
                    return
                }
            }
        }

        if (plainText && insertFragmentAtSelection(plainTextToFragment(plainText))) queueSnapshot()
    }

    const handleCopy = (event) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
        const range = getActiveRangeInContent()
        if (!range) return
        const fragment = range.cloneContents()
        const container = document.createElement("div")
        container.appendChild(fragment)
        const plainText = normalizeClipboardPlainText(fragmentToPlainText(fragment))
        if (!plainText.trim() && !container.querySelector("img,audio,video,table,hr")) return
        event.preventDefault()
        event.clipboardData?.setData("text/plain", plainText)
        event.clipboardData?.setData("text/html", container.innerHTML)
        event.clipboardData?.setData("application/x-smartnotes-html", container.innerHTML)
    }

    const handleCut = (event) => {
        const range = getActiveRangeInContent()
        if (!range || range.collapsed) return
        handleCopy(event)
        if (!event.defaultPrevented) event.preventDefault()
        const removedWithNative = (() => {
            if (typeof document.execCommand !== "function") return false
            try {
                restoreSelection()
                elements.content?.focus()
                return document.execCommand("delete", false, null)
            } catch {
                return false
            }
        })()
        if (!removedWithNative) range.deleteContents()
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
