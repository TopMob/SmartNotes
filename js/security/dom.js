(() => {
    const identifierPattern = /^[A-Za-z0-9_-]{1,128}$/
    const allowedUrlProtocols = new Set(["http:", "https:", "mailto:", "tel:"])

    function toSafeString(value) {
        if (value == null) return ""
        return String(value)
    }

    function isValidIdentifier(value) {
        return identifierPattern.test(toSafeString(value))
    }

    function sanitizeIdentifier(value) {
        const normalizedValue = toSafeString(value).trim()
        return isValidIdentifier(normalizedValue) ? normalizedValue : null
    }

    function sanitizeInputValue(value, fallback = "") {
        const normalizedValue = toSafeString(value)
        return normalizedValue.replace(/[\u0000-\u001F\u007F]/g, "") || fallback
    }

    function setText(element, value) {
        if (!element) return
        element.textContent = toSafeString(value)
    }

    function sanitizeUrl(value) {
        const normalizedValue = toSafeString(value).trim()
        if (!normalizedValue) return null
        try {
            const parsedUrl = new URL(normalizedValue, window.location.origin)
            if (!allowedUrlProtocols.has(parsedUrl.protocol)) return null
            return parsedUrl.href
        } catch {
            return null
        }
    }

    function setUrlAttribute(element, attributeName, value) {
        if (!element || !attributeName) return false
        const sanitizedUrl = sanitizeUrl(value)
        if (!sanitizedUrl) {
            element.removeAttribute(attributeName)
            return false
        }
        element.setAttribute(attributeName, sanitizedUrl)
        return true
    }

    function setSafeAttribute(element, attributeName, value, validator) {
        if (!element || !attributeName) return false
        const normalizedValue = toSafeString(value)
        const isAllowed = typeof validator === "function" ? validator(normalizedValue) : true
        if (!isAllowed) {
            element.removeAttribute(attributeName)
            return false
        }
        element.setAttribute(attributeName, normalizedValue)
        return true
    }

    function sanitizeHtml(html) {
        const container = document.createElement("template")
        container.innerHTML = toSafeString(html)
        const blockedTags = new Set(["script", "style", "iframe", "object", "embed", "link", "meta"])
        const walker = document.createTreeWalker(container.content, NodeFilter.SHOW_ELEMENT)
        const elementsToRemove = []
        while (walker.nextNode()) {
            const element = walker.currentNode
            const tagName = element.tagName.toLowerCase()
            if (blockedTags.has(tagName)) {
                elementsToRemove.push(element)
                continue
            }
            Array.from(element.attributes).forEach(attribute => {
                const attributeName = attribute.name.toLowerCase()
                const attributeValue = attribute.value
                if (attributeName.startsWith("on")) {
                    element.removeAttribute(attribute.name)
                    return
                }
                if ((attributeName === "href" || attributeName === "src") && !sanitizeUrl(attributeValue)) {
                    element.removeAttribute(attribute.name)
                }
            })
        }
        elementsToRemove.forEach(element => element.remove())
        return container.innerHTML
    }

    function setSanitizedHtml(element, html) {
        if (!element) return
        element.innerHTML = sanitizeHtml(html)
    }

    window.DomSecurity = {
        sanitizeIdentifier,
        sanitizeInputValue,
        setText,
        sanitizeUrl,
        setUrlAttribute,
        setSafeAttribute,
        sanitizeHtml,
        setSanitizedHtml
    }
})()
