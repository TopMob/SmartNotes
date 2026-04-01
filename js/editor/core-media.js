import { CONFIG } from "./core-state.js"

export const createMediaHandlers = (context) => {
    const { elements, state, getPages, queueSnapshot, alignText, restoreSelection } = context
    const isSupportedImageSource = (value) => {
        const normalizedValue = String(value || "").trim()
        return /^https?:\/\//i.test(normalizedValue) || /^data:image\//i.test(normalizedValue)
    }

    const resolveMediaService = () => window.ExternalMediaService || window.GoogleDriveMediaService

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
        const mediaService = resolveMediaService()
        if (!mediaService || typeof mediaService.uploadDataUrl !== "function") throw new Error("external-storage-unlinked")
        const currentUser = window.auth?.currentUser || (typeof StateStore !== "undefined" && typeof StateStore.read === "function" ? StateStore.read().user : null) || null
        if (!currentUser) throw new Error("external-storage-unlinked")
        if (typeof mediaService.handleSignedInUser === "function") {
            await mediaService.handleSignedInUser(currentUser, { syncStatus: true, interactiveAllowed: false })
        }
        const status = typeof mediaService.getStatus === "function" ? mediaService.getStatus() : null
        if (status && status.checked === true && (status.connected !== true || status.linked !== true)) {
            throw new Error("external-storage-unlinked")
        }
        const imageDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ""))
            reader.onerror = () => reject(new Error("file-read-failed"))
            reader.readAsDataURL(file)
        })
        const optimizedImageDataUrl = await optimizeImageDataUrl(imageDataUrl)
        return mediaService.uploadDataUrl(optimizedImageDataUrl, {
            fileNameBase: file?.name || "note_image",
            folderId: ""
        })
    }

    const fileToDataUrl = async (file) => uploadImageFile(file)

    const getActivePageElement = () => getPages()[state.pageIndex] || elements.content

    const ensureFloatingMediaPosition = (wrapper, { fallbackX = 16, fallbackY = 16 } = {}) => {
        if (!wrapper) return
        const page = wrapper.closest(".note-page") || getActivePageElement()
        if (!page) return
        const currentLeft = parseFloat(wrapper.dataset.left ?? wrapper.style.left ?? "")
        const currentTop = parseFloat(wrapper.dataset.top ?? wrapper.style.top ?? "")
        const resolvedLeft = Number.isFinite(currentLeft) ? currentLeft : fallbackX
        const resolvedTop = Number.isFinite(currentTop) ? currentTop : fallbackY
        wrapper.classList.add("media-floating")
        wrapper.style.position = "absolute"
        wrapper.style.left = `${Math.max(0, resolvedLeft)}px`
        wrapper.style.top = `${Math.max(0, resolvedTop)}px`
        wrapper.dataset.left = String(Math.max(0, resolvedLeft))
        wrapper.dataset.top = String(Math.max(0, resolvedTop))
    }

    const resolveInsertPosition = () => {
        const page = getActivePageElement()
        if (!page) return { left: 16, top: 16 }
        const pageRect = page.getBoundingClientRect()
        const selection = window.getSelection()
        const range = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null
        const caretRect = range ? range.getBoundingClientRect() : null
        const left = caretRect && Number.isFinite(caretRect.left)
            ? caretRect.left - pageRect.left
            : pageRect.width / 2 - 120
        const top = caretRect && Number.isFinite(caretRect.top)
            ? caretRect.top - pageRect.top + page.scrollTop
            : page.scrollTop + 24
        return {
            left: Math.max(8, Math.round(left)),
            top: Math.max(8, Math.round(top))
        }
    }

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
        const startLeft = parseFloat(wrapper.dataset.left ?? wrapper.style.left ?? "0") || 0
        const startTop = parseFloat(wrapper.dataset.top ?? wrapper.style.top ?? "0") || 0
        state.dragState = {
            wrapper,
            startX: event.clientX,
            startY: event.clientY,
            startLeft,
            startTop,
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
        const wrapper = state.dragState.wrapper
        const page = wrapper.closest(".note-page") || getActivePageElement()
        const pageRect = page?.getBoundingClientRect?.() || null
        const wrapperRect = wrapper.getBoundingClientRect()
        const maxLeft = pageRect ? Math.max(0, pageRect.width - wrapperRect.width) : Number.POSITIVE_INFINITY
        const maxTop = pageRect ? Math.max(0, pageRect.height - wrapperRect.height) : Number.POSITIVE_INFINITY
        const nextLeft = Utils.clamp(state.dragState.startLeft + dx, 0, maxLeft)
        const nextTop = Utils.clamp(state.dragState.startTop + dy, 0, maxTop)
        wrapper.style.left = `${nextLeft}px`
        wrapper.style.top = `${nextTop}px`
        wrapper.dataset.left = String(nextLeft)
        wrapper.dataset.top = String(nextTop)
        wrapper.style.zIndex = "12"
        event.preventDefault()
    }

    const handleMediaDragEnd = () => {
        if (!state.dragState) return
        const { wrapper, moved } = state.dragState
        wrapper.classList.remove("dragging")
        wrapper.style.zIndex = ""
        if (moved) {
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
        const page = getActivePageElement()
        if (!page) return
        const position = resolveInsertPosition()
        const html = `
        <div class="media-wrapper media-draggable-item media-floating" id="${id}" contenteditable="false" draggable="true" data-left="${position.left}" data-top="${position.top}">
            <img src="${Utils.escapeHtml(normalizedSource)}" alt="">
            <span class="media-resize-handle" aria-hidden="true"></span>
        </div>
    `
        page.insertAdjacentHTML("beforeend", html)
        const wrapper = page.querySelector(`#${id}`)
        ensureFloatingMediaPosition(wrapper, { fallbackX: position.left, fallbackY: position.top })
        makeMediaDraggable()
        syncMediaSizes()
        if (wrapper) selectMedia(wrapper)
    }

    const makeMediaDraggable = () => {
        elements.content.querySelectorAll(".media-wrapper").forEach(w => {
            w.classList.add("media-draggable-item")
            w.setAttribute("draggable", state.drawingState?.active ? "false" : "true")
            w.style.pointerEvents = state.drawingState?.active ? "none" : ""
            w.contentEditable = "false"
            ensureFloatingMediaPosition(w, { fallbackX: 16, fallbackY: 16 })
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
        selectedElement.remove()
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
