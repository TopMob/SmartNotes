const INLINE_TAGS = new Set(["a", "span", "strong", "b", "em", "i", "u", "s", "strike", "code", "mark", "small", "sub", "sup"])
const BLOCK_TAGS = new Set(["p", "ul", "ol", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "table"])

const isWhitespaceText = (node) => node?.nodeType === Node.TEXT_NODE && (node.textContent || "").replace(/[\s\u200b\u00a0]+/g, "") === ""

const isMediaWrapper = (node) => node?.nodeType === Node.ELEMENT_NODE
    && node.classList?.contains("media-wrapper")
    && node.getAttribute("contenteditable") === "false"

const isRootBlock = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false
    const tag = String(node.tagName || "").toLowerCase()
    return isMediaWrapper(node) || BLOCK_TAGS.has(tag)
}

const createParagraph = () => {
    const paragraph = document.createElement("p")
    paragraph.appendChild(document.createElement("br"))
    return paragraph
}

const ensureParagraphContent = (paragraph) => {
    if (!paragraph || String(paragraph.tagName || "").toLowerCase() !== "p") return
    const hasMedia = !!paragraph.querySelector("img,audio,video,table,hr,.media-wrapper")
    const text = (paragraph.textContent || "").replace(/[\s\u200b\u00a0]+/g, "")
    if (!hasMedia && !text && !paragraph.querySelector("br")) paragraph.appendChild(document.createElement("br"))
    if ((text || hasMedia) && paragraph.childNodes.length > 1) {
        Array.from(paragraph.querySelectorAll("br")).forEach(br => {
            if (br.parentNode === paragraph) br.remove()
        })
    }
}

const wrapInlineToParagraph = (node) => {
    const paragraph = document.createElement("p")
    paragraph.appendChild(node)
    ensureParagraphContent(paragraph)
    return paragraph
}

const transformNodeToRootBlocks = (node) => {
    if (!node) return []
    if (isWhitespaceText(node)) return []
    if (node.nodeType === Node.TEXT_NODE) {
        return [wrapInlineToParagraph(document.createTextNode(node.textContent || ""))]
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return []
    if (isMediaWrapper(node)) return [node]

    const tag = String(node.tagName || "").toLowerCase()

    if (tag === "br") return [createParagraph()]

    if (tag === "div" || tag === "section" || tag === "article" || tag === "main") {
        if (!node.childNodes.length) return [createParagraph()]
        const blocks = []
        let paragraphBuffer = null
        const flushParagraphBuffer = () => {
            if (!paragraphBuffer) return
            ensureParagraphContent(paragraphBuffer)
            blocks.push(paragraphBuffer)
            paragraphBuffer = null
        }
        Array.from(node.childNodes).forEach(child => {
            if (isRootBlock(child)) {
                flushParagraphBuffer()
                blocks.push(...transformNodeToRootBlocks(child))
                return
            }
            if (child.nodeType === Node.ELEMENT_NODE && String(child.tagName || "").toLowerCase() === "br") {
                if (!paragraphBuffer) {
                    blocks.push(createParagraph())
                } else {
                    flushParagraphBuffer()
                }
                return
            }
            if (!paragraphBuffer) paragraphBuffer = document.createElement("p")
            paragraphBuffer.appendChild(child)
        })
        flushParagraphBuffer()
        return blocks.length ? blocks : [createParagraph()]
    }

    if (BLOCK_TAGS.has(tag)) {
        if (tag === "p") ensureParagraphContent(node)
        return [node]
    }

    if (INLINE_TAGS.has(tag) || ["img", "audio", "video", "iframe", "canvas", "svg"].includes(tag)) {
        return [wrapInlineToParagraph(node)]
    }

    const paragraph = document.createElement("p")
    while (node.firstChild) paragraph.appendChild(node.firstChild)
    ensureParagraphContent(paragraph)
    return [paragraph]
}

const normalizeParagraphChildren = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return
    if (String(node.tagName || "").toLowerCase() !== "p") return
    const children = Array.from(node.childNodes)
    children.forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return
        const childTag = String(child.tagName || "").toLowerCase()
        if (childTag === "p") {
            while (child.firstChild) node.insertBefore(child.firstChild, child)
            child.remove()
        }
    })
    ensureParagraphContent(node)
}

export const normalizeParagraphModel = (container) => {
    if (!container) return false
    const sourceNodes = Array.from(container.childNodes || [])
    const normalized = []

    sourceNodes.forEach(node => {
        normalized.push(...transformNodeToRootBlocks(node))
    })

    if (!normalized.length) normalized.push(createParagraph())

    normalized.forEach(node => normalizeParagraphChildren(node))

    const sameLength = normalized.length === sourceNodes.length
    const sameOrder = sameLength && normalized.every((node, index) => node === sourceNodes[index])
    if (sameOrder) return false

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

export const ensureRangeWithinParagraphModel = (container, range) => {
    if (!container || !range) return null
    normalizeParagraphModel(container)
    const startNode = range.startContainer
    if (container.contains(startNode)) return range

    const fallback = document.createRange()
    const firstBlock = container.firstElementChild
    if (!firstBlock) {
        fallback.selectNodeContents(container)
        fallback.collapse(true)
        return fallback
    }
    fallback.selectNodeContents(firstBlock)
    fallback.collapse(true)
    return fallback
}
