import { CONFIG } from "./core-state.js"

export const createMediaHandlers = (context) => {
    const { elements, state, getPages, queueSnapshot, insertHtmlAtSelection } = context

    const fileToDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("File read failed"))
        reader.readAsDataURL(file)
    })

    const handleResizeStart = (event) => {
        const handle = event.target.closest(".media-resize-handle")
        if (!handle) return

        const wrapper = event.target.closest(".media-wrapper")
        const img = wrapper?.querySelector("img")
        if (!wrapper || !img) return

        event.preventDefault()
        event.stopPropagation()

        const rect = img.getBoundingClientRect()
        const page = getPages()[state.pageIndex] || elements.content
        const parentWidth = page.getBoundingClientRect().width - 40

        state.resizeState = {
            startX: event.clientX || event.touches?.[0].clientX,
            startWidth: rect.width,
            ratio: rect.width / Math.max(1, rect.height),
            maxWidth: Math.min(CONFIG.MAX_IMG_WIDTH, parentWidth),
            wrapper,
            img
        }

        handle.setPointerCapture?.(event.pointerId)
        document.addEventListener("pointermove", handleResizeMove, { passive: false })
        document.addEventListener("pointerup", handleResizeEnd, { once: true })
        document.addEventListener("pointercancel", handleResizeEnd, { once: true })
    }

    const handleResizeMove = (event) => {
        if (!state.resizeState) return
        event.preventDefault()

        const clientX = event.clientX
        const dx = clientX - state.resizeState.startX
        let width = state.resizeState.startWidth + dx

        width = Utils.clamp(Utils.snap(width, 8), CONFIG.MIN_IMG_WIDTH, state.resizeState.maxWidth)
        const height = width / state.resizeState.ratio

        state.resizeState.img.style.width = `${width}px`
        state.resizeState.img.style.height = `${height}px`
        state.resizeState.wrapper.dataset.width = width
        state.resizeState.wrapper.dataset.height = height
    }

    const handleResizeEnd = () => {
        state.resizeState = null
        document.removeEventListener("pointermove", handleResizeMove)
        queueSnapshot()
    }

    const handleMediaDragStart = (event) => {
        if (event.button && event.button !== 0) return
        if (event.target.closest(".media-resize-handle")) return
        const wrapper = event.target.closest(".media-wrapper")
        if (!wrapper || !elements.content.contains(wrapper)) return
        state.dragState = {
            wrapper,
            trailingBreak: wrapper.nextSibling && wrapper.nextSibling.nodeName === "BR" ? wrapper.nextSibling : null,
            startX: event.clientX,
            startY: event.clientY,
            moved: false
        }
        wrapper.setPointerCapture?.(event.pointerId)
        document.addEventListener("pointermove", handleMediaDragMove, { passive: false })
        document.addEventListener("pointerup", handleMediaDragEnd, { once: true })
        document.addEventListener("pointercancel", handleMediaDragEnd, { once: true })
    }

    const handleMediaDragMove = (event) => {
        if (!state.dragState) return
        const dx = event.clientX - state.dragState.startX
        const dy = event.clientY - state.dragState.startY
        if (!state.dragState.moved && Math.hypot(dx, dy) < 6) return
        state.dragState.moved = true
        state.dragState.wrapper.classList.add("dragging")
        state.dragState.wrapper.style.transform = `translate(${dx}px, ${dy}px)`
        state.dragState.wrapper.style.pointerEvents = "none"
        event.preventDefault()
    }

    const handleMediaDragEnd = (event) => {
        if (!state.dragState) return
        const { wrapper, trailingBreak, moved } = state.dragState
        wrapper.classList.remove("dragging")
        wrapper.style.transform = ""
        wrapper.style.pointerEvents = ""
        if (moved) {
            const range = getDropRange(event.clientX, event.clientY)
            if (range && elements.content.contains(range.commonAncestorContainer)) {
                const fragment = document.createDocumentFragment()
                fragment.appendChild(wrapper)
                if (trailingBreak) fragment.appendChild(trailingBreak)
                range.insertNode(fragment)
            } else {
                elements.content.appendChild(wrapper)
                if (trailingBreak) elements.content.appendChild(trailingBreak)
            }
            queueSnapshot()
        }
        state.dragState = null
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
        EditorAudio.sync(elements.content)
    }

    const makeMediaDraggable = () => {
        elements.content.querySelectorAll(".media-wrapper").forEach(w => {
            w.setAttribute("draggable", "true")
            w.contentEditable = "false"
        })
    }

    const syncMediaSizes = () => {
        if (!elements.content) return
        const page = getPages()[state.pageIndex] || elements.content
        const parentWidth = page.getBoundingClientRect().width - 40
        const maxWidth = Math.min(CONFIG.MAX_IMG_WIDTH, parentWidth)
        elements.content.querySelectorAll(".media-wrapper").forEach(wrapper => {
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
        state.selectedMediaElement = el
        state.selectedMediaElement.classList.add("selected")

        const menu = elements.ctxMenu
        if (!menu) return

        menu.classList.remove("hidden")
        const rect = el.getBoundingClientRect()
        const top = rect.top - 60
        const left = rect.left + (rect.width / 2) - (menu.offsetWidth / 2)

        menu.style.top = `${Math.max(10, top)}px`
        menu.style.left = `${Math.max(10, Math.min(window.innerWidth - menu.offsetWidth - 10, left))}px`
    }

    const deselectMedia = () => {
        if (state.selectedMediaElement) state.selectedMediaElement.classList.remove("selected")
        state.selectedMediaElement = null
        elements.ctxMenu?.classList.add("hidden")
    }

    const resetMediaTransform = () => {
        if (!state.selectedMediaElement) return
        const img = state.selectedMediaElement.querySelector("img")
        if (img) {
            img.style.width = ""
            img.style.height = ""
            delete state.selectedMediaElement.dataset.width
            delete state.selectedMediaElement.dataset.height
        }
    }

    const alignMediaOrText = (side) => {
        if (state.selectedMediaElement) {
            state.selectedMediaElement.classList.remove("align-left", "align-right")
            if (side !== "center") state.selectedMediaElement.classList.add(`align-${side}`)
        } else {
            const cmd = side === "center" ? "justifyCenter" : (side === "right" ? "justifyRight" : "justifyLeft")
            document.execCommand(cmd)
        }
        closeAlignMenu()
    }

    const toggleAlignMenu = (btn) => {
        const menu = elements.alignMenu
        if (!menu || !btn) return
        if (menu.classList.contains("active") && state.alignMenuTarget === btn) {
            closeAlignMenu()
            return
        }
        state.alignMenuTarget = btn
        const rect = btn.getBoundingClientRect()
        menu.classList.remove("hidden")
        menu.classList.add("active")
        const left = Math.min(window.innerWidth - menu.offsetWidth - 10, rect.left)
        menu.style.left = `${Math.max(10, left)}px`
        menu.style.top = `${rect.bottom + 8}px`
    }

    const closeAlignMenu = () => {
        const menu = elements.alignMenu
        if (!menu) return
        menu.classList.remove("active")
        menu.classList.add("hidden")
        state.alignMenuTarget = null
    }

    const deleteSelectedMedia = () => {
        state.selectedMediaElement?.remove()
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

    return {
        fileToDataUrl,
        handleResizeStart,
        handleMediaDragStart,
        insertMedia,
        insertAudio,
        makeMediaDraggable,
        syncMediaSizes,
        selectMedia,
        deselectMedia,
        resetMediaTransform,
        alignMediaOrText,
        toggleAlignMenu,
        closeAlignMenu,
        deleteSelectedMedia
    }
}
