const INLINE_TAGS = new Set(["a", "span", "strong", "b", "em", "i", "u", "s", "strike", "code", "mark", "small", "sub", "sup"])
const BLOCK_TAGS = new Set(["p", "ul", "ol", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "table"])

const isWhitespaceText = (node) => node?.nodeType === Node.TEXT_NODE && (node.textContent || "").replace(/[\s\u200b\u00a0]+/g, "") === ""

const isMediaWrapper = (node) => node?.nodeType === Node.ELEMENT_NODE
    && node.classList?.contains("media-wrapper")
    && node.getAttribute("contenteditable") === "false"

const createParagraph = () => {
    const paragraph = document.createElement("p")
    paragraph.appendChild(document.createElement("br"))
    return paragraph
}

const ensureParagraphContent = (paragraph) => {
    if (!paragraph) return
    const hasMedia = !!paragraph.querySelector("img,audio,video,table,hr,.media-wrapper")
    const text = (paragraph.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
    if (!hasMedia && !text && !paragraph.querySelector("br")) paragraph.appendChild(document.createElement("br"))
}

const transformNodeToRootBlock = (node) => {
    if (!node) return null
    if (isWhitespaceText(node)) return null
    if (node.nodeType === Node.TEXT_NODE) {
        const paragraph = document.createElement("p")
        paragraph.textContent = node.textContent || ""
        ensureParagraphContent(paragraph)
        return paragraph
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const tag = String(node.tagName || "").toLowerCase()
    if (isMediaWrapper(node)) return node
    if (tag === "div") {
        const paragraph = document.createElement("p")
        while (node.firstChild) paragraph.appendChild(node.firstChild)
        ensureParagraphContent(paragraph)
        return paragraph
    }
    if (tag === "br") return createParagraph()
    if (BLOCK_TAGS.has(tag)) {
        if (tag === "p") ensureParagraphContent(node)
        return node
    }
    if (INLINE_TAGS.has(tag) || tag === "img" || tag === "audio" || tag === "video" || tag === "iframe" || tag === "canvas" || tag === "svg") {
        const paragraph = document.createElement("p")
        paragraph.appendChild(node)
        ensureParagraphContent(paragraph)
        return paragraph
    }
    const paragraph = document.createElement("p")
    while (node.firstChild) paragraph.appendChild(node.firstChild)
    ensureParagraphContent(paragraph)
    return paragraph
}

export const normalizeParagraphModel = (container) => {
    if (!container) return false
    const nodes = Array.from(container.childNodes || [])
    const normalized = []
    let changed = false

    nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && !isWhitespaceText(node)) {
            const previous = normalized[normalized.length - 1]
            if (previous?.nodeType === Node.ELEMENT_NODE && String(previous.tagName || "").toLowerCase() === "p") {
                previous.appendChild(document.createTextNode(node.textContent || ""))
                changed = true
                return
            }
        }
        const transformed = transformNodeToRootBlock(node)
        if (!transformed) {
            if (node.parentNode === container) node.remove()
            changed = true
            return
        }
        if (transformed !== node) changed = true
        normalized.push(transformed)
    })

    if (!normalized.length) {
        container.replaceChildren(createParagraph())
        return true
    }

    const sameLength = normalized.length === nodes.length
    const sameOrder = sameLength && normalized.every((node, index) => node === nodes[index])
    if (!changed && sameOrder) return false

    const fragment = document.createDocumentFragment()
    normalized.forEach(node => fragment.appendChild(node))
    container.replaceChildren(fragment)
    return true
}

export const normalizeFragmentParagraphModel = (fragment) => {
    if (!fragment) return fragment
    const container = document.createElement("div")
    container.appendChild(fragment.cloneNode(true))
    normalizeParagraphModel(container)
    const output = document.createDocumentFragment()
    while (container.firstChild) output.appendChild(container.firstChild)
    return output
}
