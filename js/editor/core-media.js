const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ""))
    r.onerror = () => reject(new Error("File read failed"))
    r.readAsDataURL(file)
})

const handleResizeStart = (e) => {
    const handle = e.target.closest(".media-resize-handle")
    if (!handle) return

    const wrapper = e.target.closest(".media-wrapper")
    const img = wrapper?.querySelector("img")
    if (!wrapper || !img) return

    e.preventDefault()
    e.stopPropagation()

    const rect = img.getBoundingClientRect()
    const page = getPages()[pageIndex] || els.content
    const parentWidth = page.getBoundingClientRect().width - 40

    resizeState = {
        startX: e.clientX || e.touches?.[0].clientX,
        startWidth: rect.width,
        ratio: rect.width / Math.max(1, rect.height),
        maxWidth: Math.min(CONFIG.MAX_IMG_WIDTH, parentWidth),
        wrapper,
        img
    }

    handle.setPointerCapture?.(e.pointerId)
    document.addEventListener("pointermove", handleResizeMove, { passive: false })
    document.addEventListener("pointerup", handleResizeEnd, { once: true })
    document.addEventListener("pointercancel", handleResizeEnd, { once: true })
}

const handleResizeMove = (e) => {
    if (!resizeState) return
    e.preventDefault()

    const clientX = e.clientX
    const dx = clientX - resizeState.startX
    let w = resizeState.startWidth + dx

    w = Utils.clamp(Utils.snap(w, 8), CONFIG.MIN_IMG_WIDTH, resizeState.maxWidth)
    const h = w / resizeState.ratio

    resizeState.img.style.width = `${w}px`
    resizeState.img.style.height = `${h}px`
    resizeState.wrapper.dataset.width = w
    resizeState.wrapper.dataset.height = h
}

const handleResizeEnd = () => {
    resizeState = null
    document.removeEventListener("pointermove", handleResizeMove)
    queueSnapshot()
}

const handleMediaDragStart = (e) => {
    if (e.button && e.button !== 0) return
    if (e.target.closest(".media-resize-handle")) return
    const wrapper = e.target.closest(".media-wrapper")
    if (!wrapper || !els.content.contains(wrapper)) return
    dragState = {
        wrapper,
        trailingBreak: wrapper.nextSibling && wrapper.nextSibling.nodeName === "BR" ? wrapper.nextSibling : null,
        startX: e.clientX,
        startY: e.clientY,
        moved: false
    }
    wrapper.setPointerCapture?.(e.pointerId)
    document.addEventListener("pointermove", handleMediaDragMove, { passive: false })
    document.addEventListener("pointerup", handleMediaDragEnd, { once: true })
    document.addEventListener("pointercancel", handleMediaDragEnd, { once: true })
}

const handleMediaDragMove = (e) => {
    if (!dragState) return
    const dx = e.clientX - dragState.startX
    const dy = e.clientY - dragState.startY
    if (!dragState.moved && Math.hypot(dx, dy) < 6) return
    dragState.moved = true
    dragState.wrapper.classList.add("dragging")
    dragState.wrapper.style.transform = `translate(${dx}px, ${dy}px)`
    dragState.wrapper.style.pointerEvents = "none"
    e.preventDefault()
}

const handleMediaDragEnd = (e) => {
    if (!dragState) return
    const { wrapper, trailingBreak, moved } = dragState
    wrapper.classList.remove("dragging")
    wrapper.style.transform = ""
    wrapper.style.pointerEvents = ""
    if (moved) {
        const range = getDropRange(e.clientX, e.clientY)
        if (range && els.content.contains(range.commonAncestorContainer)) {
            const fragment = document.createDocumentFragment()
            fragment.appendChild(wrapper)
            if (trailingBreak) fragment.appendChild(trailingBreak)
            range.insertNode(fragment)
        } else {
            els.content.appendChild(wrapper)
            if (trailingBreak) els.content.appendChild(trailingBreak)
        }
        queueSnapshot()
    }
    dragState = null
    document.removeEventListener("pointermove", handleMediaDragMove)
}

const insertMedia = (src, type) => {
    if (type !== "image") return
    const id = Utils.generateId()
    const html = `
        <div class="media-wrapper" id="${id}" contenteditable="false" draggable="true">
            <img src="${Utils.escapeHtml(src)}" alt="">
            <span class="media-resize-handle" aria-hidden="true"></span>
        </div><br>
    `
    insertHtmlAtSelection(html)
    makeMediaDraggable()
    syncMediaSizes()
}

const insertAudio = (src) => {
    if (typeof EditorAudio === "undefined") return
    const html = EditorAudio.createAudioBlockHtml(src)
    insertHtmlAtSelection(html)
    EditorAudio.sync(els.content)
}

const makeMediaDraggable = () => {
    els.content.querySelectorAll(".media-wrapper").forEach(w => {
        w.setAttribute("draggable", "true")
        w.contentEditable = "false"
    })
}

const syncMediaSizes = () => {
    if (!els.content) return
    const page = getPages()[pageIndex] || els.content
    const parentWidth = page.getBoundingClientRect().width - 40
    const maxWidth = Math.min(CONFIG.MAX_IMG_WIDTH, parentWidth)
    els.content.querySelectorAll(".media-wrapper").forEach(wrapper => {
        const img = wrapper.querySelector("img")
        if (!img) return
        const apply = () => {
            const width = parseFloat(wrapper.dataset.width || "")
            const height = parseFloat(wrapper.dataset.height || "")
            if (width && height) {
                img.style.width = `${width}px`
                img.style.height = `${height}px`
                return
            }
            const naturalWidth = img.naturalWidth || img.width
            const naturalHeight = img.naturalHeight || img.height
            if (!naturalWidth || !naturalHeight) return
            const ratio = naturalWidth / Math.max(1, naturalHeight)
            const targetWidth = Utils.clamp(naturalWidth, CONFIG.MIN_IMG_WIDTH, maxWidth)
            const targetHeight = targetWidth / ratio
            img.style.width = `${targetWidth}px`
            img.style.height = `${targetHeight}px`
            wrapper.dataset.width = targetWidth
            wrapper.dataset.height = targetHeight
        }
        if (img.complete) apply()
        else img.addEventListener("load", apply, { once: true })
    })
}

const selectMedia = (el) => {
    deselectMedia()
    selectedMedia = el
    selectedMedia.classList.add("selected")

    const menu = els.ctxMenu
    if (!menu) return

    menu.classList.remove("hidden")
    const rect = el.getBoundingClientRect()
    const top = rect.top - 60
    const left = rect.left + (rect.width / 2) - (menu.offsetWidth / 2)

    menu.style.top = `${Math.max(10, top)}px`
    menu.style.left = `${Math.max(10, Math.min(window.innerWidth - menu.offsetWidth - 10, left))}px`
}

const deselectMedia = () => {
    if (selectedMedia) selectedMedia.classList.remove("selected")
    selectedMedia = null
    els.ctxMenu?.classList.add("hidden")
}

const resetMediaTransform = () => {
    if (!selectedMedia) return
    const img = selectedMedia.querySelector("img")
    if (img) {
        img.style.width = ""
        img.style.height = ""
        delete selectedMedia.dataset.width
        delete selectedMedia.dataset.height
    }
}

const alignMediaOrText = (side) => {
    if (selectedMedia) {
        selectedMedia.classList.remove("align-left", "align-right")
        if (side !== "center") selectedMedia.classList.add(`align-${side}`)
    } else {
        const cmd = side === "center" ? "justifyCenter" : (side === "right" ? "justifyRight" : "justifyLeft")
        document.execCommand(cmd)
    }
    closeAlignMenu()
}

const toggleAlignMenu = (btn) => {
    const menu = els.alignMenu
    if (!menu || !btn) return
    if (menu.classList.contains("active") && alignMenuTarget === btn) {
        closeAlignMenu()
        return
    }
    alignMenuTarget = btn
    const rect = btn.getBoundingClientRect()
    menu.classList.remove("hidden")
    menu.classList.add("active")
    const left = Math.min(window.innerWidth - menu.offsetWidth - 10, rect.left)
    menu.style.left = `${Math.max(10, left)}px`
    menu.style.top = `${rect.bottom + 8}px`
}

const closeAlignMenu = () => {
    const menu = els.alignMenu
    if (!menu) return
    menu.classList.remove("active")
    menu.classList.add("hidden")
    alignMenuTarget = null
}

const deleteSelectedMedia = () => {
    selectedMedia?.remove()
    deselectMedia()
}

const getDropRange = (x, y) => {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y)
    if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y)
        if (!pos) return null
        const range = document.createRange()
        range.setStart(pos.offsetNode, pos.offset)
        range.collapse(true)
        return range
    }
    return null
}
