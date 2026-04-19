export const createMediaHtml = ({ id, src }) => {
    const normalizedId = String(id || "")
    const normalizedSrc = String(src || "")
    return `
        <div class="media-wrapper media-draggable-item" id="${normalizedId}" contenteditable="false" draggable="true">
            <img src="${normalizedSrc}" alt="">
            <span class="media-resize-handle" aria-hidden="true"></span>
        </div><br>
    `
}

const getCaretRange = (x, y) => {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y)
    if (document.caretPositionFromPoint) {
        const position = document.caretPositionFromPoint(x, y)
        if (!position) return null
        const range = document.createRange()
        range.setStart(position.offsetNode, position.offset)
        range.collapse(true)
        return range
    }
    return null
}

const getPageFromPoint = (pages, x, y) => {
    const pointed = document.elementFromPoint(x, y)
    const pointedPage = pointed?.closest?.(".note-page") || null
    if (pointedPage && pages.includes(pointedPage)) return pointedPage
    return null
}

const createBoundaryRange = (node, before) => {
    if (!node || !node.parentNode) return null
    const range = document.createRange()
    if (before) range.setStartBefore(node)
    else range.setStartAfter(node)
    range.collapse(true)
    return range
}

const getFlowNodes = (container, ignoredNodes) => Array.from(container.childNodes || [])
    .filter(node => !ignoredNodes.has(node))
    .filter(node => {
        if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").trim().length > 0
        if (node.nodeType !== Node.ELEMENT_NODE) return false
        const element = node
        if (element.matches("script,style")) return false
        return true
    })

const resolvePlacementFromFlowNodes = (container, y, ignoredNodes) => {
    const nodes = getFlowNodes(container, ignoredNodes)
    if (!nodes.length) return { container, range: null, target: null, mode: "append" }
    for (const node of nodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        const rect = node.getBoundingClientRect()
        const middle = rect.top + rect.height / 2
        if (y < middle) {
            return {
                container,
                target: node,
                mode: "before",
                range: createBoundaryRange(node, true)
            }
        }
    }
    const lastNode = nodes[nodes.length - 1]
    return {
        container,
        target: lastNode.nodeType === Node.ELEMENT_NODE ? lastNode : null,
        mode: "after",
        range: createBoundaryRange(lastNode, false)
    }
}

const resolvePlacementFromCaret = (container, x, y, ignoredNodes) => {
    const range = getCaretRange(x, y)
    if (!range) return null
    const startNode = range.startContainer
    if (!container.contains(startNode)) return null
    for (const node of ignoredNodes) {
        if (node && node.contains && node.contains(startNode)) return null
    }
    const block = startNode.nodeType === Node.ELEMENT_NODE
        ? startNode.closest?.(".media-wrapper,p,div,section,article,blockquote,ul,ol,li,h1,h2,h3,h4,h5,h6,pre,hr")
        : startNode.parentElement?.closest?.(".media-wrapper,p,div,section,article,blockquote,ul,ol,li,h1,h2,h3,h4,h5,h6,pre,hr")
    if (block && container.contains(block) && !ignoredNodes.has(block)) {
        return {
            container,
            target: block,
            mode: "range",
            range
        }
    }
    return {
        container,
        target: null,
        mode: "range",
        range
    }
}

export const resolveMediaDropPlacement = ({ editorRoot, pages, activePage, x, y, ignoredNodes = [] }) => {
    const normalizedPages = Array.isArray(pages) ? pages.filter(Boolean) : []
    const targetPage = getPageFromPoint(normalizedPages, x, y) || activePage || normalizedPages[0] || editorRoot
    if (!targetPage) return null
    const ignoredSet = new Set(ignoredNodes.filter(Boolean))
    const fromCaret = resolvePlacementFromCaret(targetPage, x, y, ignoredSet)
    if (fromCaret) return fromCaret
    return resolvePlacementFromFlowNodes(targetPage, y, ignoredSet)
}

export const insertMediaAtPlacement = ({ wrapper, trailingBreak, placement, fallbackRoot }) => {
    if (!wrapper) return
    const range = placement?.range
    const container = placement?.container || fallbackRoot
    if (range) {
        const fragment = document.createDocumentFragment()
        fragment.appendChild(wrapper)
        if (trailingBreak) fragment.appendChild(trailingBreak)
        range.insertNode(fragment)
        return
    }
    container.appendChild(wrapper)
    if (trailingBreak) container.appendChild(trailingBreak)
}

export const getMarkerRectFromPlacement = (placement) => {
    const range = placement?.range
    if (range) {
        const rect = range.getBoundingClientRect()
        if (rect.width || rect.height) {
            return {
                left: rect.left,
                top: rect.top - 2,
                width: Math.max(24, rect.width)
            }
        }
    }
    const target = placement?.target
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return null
    const rect = target.getBoundingClientRect()
    const before = placement.mode === "before"
    return {
        left: rect.left,
        top: before ? rect.top - 3 : rect.bottom - 3,
        width: rect.width
    }
}
