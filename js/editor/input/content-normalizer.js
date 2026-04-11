const BLOCK_TAGS = new Set(["div", "p", "section", "article", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "li"])
const MEDIA_SELECTOR = "img,audio,video,table,hr,iframe,canvas,svg,.media-wrapper,.audio-block"

const normalizedText = (value) => String(value || "").replace(/[\s\u200b\u00a0]+/g, "").trim()

const isElement = (node) => node?.nodeType === Node.ELEMENT_NODE
const isText = (node) => node?.nodeType === Node.TEXT_NODE

const isEmptyTextNode = (node) => isText(node) && !normalizedText(node.textContent)

const isInlineBreak = (node) => isElement(node) && String(node.tagName || "").toLowerCase() === "br"

const isBlockLikeNode = (node) => isElement(node) && BLOCK_TAGS.has(String(node.tagName || "").toLowerCase())

const isVisuallyEmptyNode = (node) => {
    if (!node) return true
    if (isText(node)) return isEmptyTextNode(node)
    if (!isElement(node)) return true
    if (isInlineBreak(node)) return true
    const element = node
    if (element.matches(MEDIA_SELECTOR) || element.querySelector(MEDIA_SELECTOR)) return false
    if (element.querySelector("ul,ol,li")) return false
    return !normalizedText(element.textContent)
}

const trimEdgeEmptyNodes = (container) => {
    while (container.firstChild) {
        const node = container.firstChild
        if (!isVisuallyEmptyNode(node)) break
        if (!(isText(node) || isInlineBreak(node) || isBlockLikeNode(node))) break
        node.remove()
    }
    while (container.lastChild) {
        const node = container.lastChild
        if (!isVisuallyEmptyNode(node)) break
        if (!(isText(node) || isInlineBreak(node) || isBlockLikeNode(node))) break
        node.remove()
    }
}

export const normalizeEditableHtmlForStorage = (htmlValue) => {
    const container = document.createElement("div")
    container.innerHTML = String(htmlValue || "")
    Array.from(container.childNodes).forEach(node => {
        if (isEmptyTextNode(node)) node.remove()
    })
    trimEdgeEmptyNodes(container)
    const html = container.innerHTML.trim()
    if (!html) return ""
    const text = normalizedText(container.textContent)
    const hasMedia = !!container.querySelector(MEDIA_SELECTOR)
    if (!text && !hasMedia) return ""
    return html
}
