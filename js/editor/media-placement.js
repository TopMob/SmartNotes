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

const getCenterY = (rect) => rect.top + rect.height / 2

const getDistanceScore = (rect, x, y) => {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return Math.hypot(x - centerX, y - centerY)
}

const createRange = (node, before) => {
    if (!node || !node.parentNode) return null
    const range = document.createRange()
    if (before) range.setStartBefore(node)
    else range.setStartAfter(node)
    range.collapse(true)
    return range
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

const isInsideRoot = (root, node) => {
    if (!root || !node) return false
    return root === node || root.contains(node)
}

const getDropCandidateFromCaret = (root, x, y) => {
    const caretRange = getCaretRange(x, y)
    if (!caretRange) return null
    const container = caretRange.startContainer
    if (!isInsideRoot(root, container)) return null
    const elementNode = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement
    if (!elementNode) return null
    const mediaWrapper = elementNode.closest(".media-wrapper")
    if (mediaWrapper && isInsideRoot(root, mediaWrapper)) {
        const rect = mediaWrapper.getBoundingClientRect()
        return {
            type: "wrapper",
            node: mediaWrapper,
            before: y < getCenterY(rect),
            score: getDistanceScore(rect, x, y)
        }
    }
    const blockNode = elementNode.closest("p,div,section,article,blockquote,ul,ol,li,h1,h2,h3,h4,h5,h6,pre,hr")
    if (blockNode && isInsideRoot(root, blockNode) && !blockNode.classList.contains("note-page")) {
        const rect = blockNode.getBoundingClientRect()
        return {
            type: "block",
            node: blockNode,
            before: y < getCenterY(rect),
            score: getDistanceScore(rect, x, y)
        }
    }
    return null
}

const getDropCandidateFromElements = (root, x, y, draggedWrapper) => {
    const candidates = Array.from(root.querySelectorAll(".media-wrapper,p,div,section,article,blockquote,ul,ol,li,h1,h2,h3,h4,h5,h6,pre,hr"))
        .filter(node => node !== draggedWrapper && !node.classList.contains("note-page"))
        .map(node => {
            const rect = node.getBoundingClientRect()
            return {
                node,
                rect,
                score: getDistanceScore(rect, x, y),
                before: y < getCenterY(rect)
            }
        })
        .filter(item => Number.isFinite(item.score))
    if (!candidates.length) return null
    candidates.sort((a, b) => a.score - b.score)
    const best = candidates[0]
    return {
        type: best.node.classList.contains("media-wrapper") ? "wrapper" : "block",
        node: best.node,
        before: best.before,
        score: best.score
    }
}

export const resolveMediaDropPlacement = ({ root, x, y, draggedWrapper }) => {
    if (!root) return null
    const fromCaret = getDropCandidateFromCaret(root, x, y)
    const fromElements = getDropCandidateFromElements(root, x, y, draggedWrapper)
    const best = [fromCaret, fromElements]
        .filter(Boolean)
        .sort((a, b) => a.score - b.score)[0] || null
    if (!best?.node) {
        return {
            range: null,
            mode: "append"
        }
    }
    return {
        range: createRange(best.node, best.before),
        mode: best.before ? "before" : "after",
        target: best.node
    }
}

export const insertMediaAtPlacement = ({ wrapper, trailingBreak, placement, fallbackRoot }) => {
    if (!wrapper) return
    const root = fallbackRoot
    const range = placement?.range
    if (range) {
        const fragment = document.createDocumentFragment()
        fragment.appendChild(wrapper)
        if (trailingBreak) fragment.appendChild(trailingBreak)
        range.insertNode(fragment)
        return
    }
    root.appendChild(wrapper)
    if (trailingBreak) root.appendChild(trailingBreak)
}

export const getMarkerRectFromPlacement = (placement) => {
    const target = placement?.target
    if (!target) return null
    const rect = target.getBoundingClientRect()
    const before = placement.mode === "before"
    return {
        left: rect.left,
        width: rect.width,
        top: before ? rect.top - 3 : rect.bottom - 3
    }
}
