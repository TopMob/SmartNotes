import { CONFIG } from "./core-state.js"

export const createMediaHandlers = (context) => {
    const { elements, state, getPages, queueSnapshot, insertHtmlAtSelection, alignText, restoreSelection } = context
    const isSupportedImageSource = (value) => {
        const normalizedValue = String(value || "").trim()
        return /^https?:\/\//i.test(normalizedValue) || /^data:image\//i.test(normalizedValue)
    }

    const optimizeImageDataUrl = (dataUrl, options = {}) => new Promise((resolve) => {
        const source = String(dataUrl || "")
        if (!source.startsWith("data:image/")) {
            resolve(source)
            return
        }
        const maxDimension = Number.isFinite(options.maxDimension) ? options.maxDimension : 1600
        const quality = Number.isFinite(options.quality) ? options.quality : 0.82
        const image = new Image()
        image.onload = () => {
            const width = image.naturalWidth || image.width
            const height = image.naturalHeight || image.height
            if (!width || !height) {
                resolve(source)
                return
            }
            const scale = Math.min(1, maxDimension / Math.max(width, height))
            const targetWidth = Math.max(1, Math.round(width * scale))
            const targetHeight = Math.max(1, Math.round(height * scale))
            const canvas = document.createElement("canvas")
            canvas.width = targetWidth
            canvas.height = targetHeight
            const context = canvas.getContext("2d")
            if (!context) {
                resolve(source)
                return
            }
            context.drawImage(image, 0, 0, targetWidth, targetHeight)
            const optimized = canvas.toDataURL("image/jpeg", quality)
            resolve(optimized.length < source.length ? optimized : source)
        }
        image.onerror = () => resolve(source)
        image.src = source
    })

    const uploadImageFile = async (file) => {
        if (!navigator.onLine) {
            throw new Error("drive-offline")
        }
        const reader = new FileReader()
        const imageDataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result || ""))
            reader.onerror = () => reject(new Error("file-read-failed"))
            reader.readAsDataURL(file)
        })
        const optimizedImageDataUrl = await optimizeImageDataUrl(imageDataUrl)
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        if (!mediaService) {
            throw new Error("external-storage-unlinked")
        }
        return mediaService.uploadDataUrl(optimizedImageDataUrl, {
            fileNameBase: file?.name || "note_image"
        })
    }

    const fileToDataUrl = async (file) => uploadImageFile(file)

    const handleResizeStart = (event) => {
        if (state.drawingState?.active) {
            event.preventDefault()
            return
        }
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
        if (state.drawingState?.active) {
            event.preventDefault()
            return
        }
        if (typeof event.button === "number" && event.button > 0) return
        if (event.target.closest(".media-resize-handle")) return
        const wrapper = event.target.closest(".media-draggable-item")
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
        state.dragState.wrapper.style.zIndex = "12"
        event.preventDefault()
    }

    const handleMediaDragEnd = (event) => {
        if (!state.dragState) return
        const { wrapper, trailingBreak, moved } = state.dragState
        wrapper.classList.remove("dragging")
        wrapper.style.transform = ""
        wrapper.style.pointerEvents = ""
        wrapper.style.zIndex = ""
        if (moved) {
            placeDraggedMedia(wrapper, trailingBreak, event.clientX, event.clientY)
            queueSnapshot()
        }
        state.dragState = null
        document.removeEventListener("pointermove", handleMediaDragMove)
    }

    const handleNativeDragStart = (event) => {
        if (!event.target.closest(".media-draggable-item")) return
        event.preventDefault()
    }

    const insertMedia = (src, type) => {
        const normalizedSource = String(src || "").trim()
        if (type !== "image" || !isSupportedImageSource(normalizedSource)) return
        const id = Utils.generateId()
        const html = `
        <div class="media-wrapper media-draggable-item" id="${id}" contenteditable="false" draggable="true">
            <img src="${Utils.escapeHtml(normalizedSource)}" alt="">
            <span class="media-resize-handle" aria-hidden="true"></span>
        </div><br>
    `
        insertHtmlAtSelection(html)
        makeMediaDraggable()
        syncMediaSizes()
    }

    const makeMediaDraggable = () => {
        elements.content.querySelectorAll(".media-wrapper").forEach(w => {
            w.classList.add("media-draggable-item")
            w.setAttribute("draggable", state.drawingState?.active ? "false" : "true")
            w.style.pointerEvents = state.drawingState?.active ? "none" : ""
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
        if (state.drawingState?.active) return
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
            queueSnapshot()
            closeAlignMenu()
            return
        }
        restoreSelection?.()
        alignText(side)
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
        const selectedElement = state.selectedMediaElement
        if (!selectedElement) return
        const siblingBreak = selectedElement.nextSibling
        selectedElement.remove()
        if (siblingBreak && siblingBreak.nodeName === "BR") siblingBreak.remove()
        deselectMedia()
        queueSnapshot()
    }

    const cleanupPointerInteractions = () => {
        state.resizeState = null
        state.dragState = null
        document.removeEventListener("pointermove", handleResizeMove)
        document.removeEventListener("pointerup", handleResizeEnd)
        document.removeEventListener("pointercancel", handleResizeEnd)
        document.removeEventListener("pointermove", handleMediaDragMove)
        document.removeEventListener("pointerup", handleMediaDragEnd)
        document.removeEventListener("pointercancel", handleMediaDragEnd)
    }


    const resolveDropTargetWrapper = (x, y, draggedWrapper) => {
        const element = document.elementFromPoint(x, y)
        const targetWrapper = element?.closest?.(".media-wrapper") || null
        if (!targetWrapper || targetWrapper === draggedWrapper) return null
        if (!elements.content.contains(targetWrapper)) return null
        return targetWrapper
    }

    const insertMediaFragmentAtRange = (wrapper, trailingBreak, range) => {
        const fragment = document.createDocumentFragment()
        fragment.appendChild(wrapper)
        if (trailingBreak) fragment.appendChild(trailingBreak)
        range.insertNode(fragment)
    }

    const placeDraggedMedia = (wrapper, trailingBreak, clientX, clientY) => {
        const targetWrapper = resolveDropTargetWrapper(clientX, clientY, wrapper)
        if (targetWrapper) {
            const targetRect = targetWrapper.getBoundingClientRect()
            const insertBeforeTarget = clientY < (targetRect.top + targetRect.height / 2)
            if (insertBeforeTarget) targetWrapper.before(wrapper)
            else targetWrapper.after(wrapper)
            if (trailingBreak) wrapper.after(trailingBreak)
            return
        }
        const range = getDropRange(clientX, clientY)
        if (range && elements.content.contains(range.commonAncestorContainer)) {
            insertMediaFragmentAtRange(wrapper, trailingBreak, range)
            return
        }
        const activePage = getPages()[state.pageIndex]
        if (activePage && elements.content.contains(activePage)) {
            activePage.appendChild(wrapper)
            if (trailingBreak) activePage.appendChild(trailingBreak)
            return
        }
        elements.content.appendChild(wrapper)
        if (trailingBreak) elements.content.appendChild(trailingBreak)
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
        handleNativeDragStart,
        insertMedia,
        makeMediaDraggable,
        syncMediaSizes,
        selectMedia,
        deselectMedia,
        resetMediaTransform,
        alignMediaOrText,
        toggleAlignMenu,
        closeAlignMenu,
        deleteSelectedMedia,
        cleanupPointerInteractions
    }
}
