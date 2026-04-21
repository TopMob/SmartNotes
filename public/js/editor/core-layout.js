const MOBILE_QUERY = "(max-width: 760px)"
const DESKTOP_BOTTOM_EXTRA = 4
const MOBILE_BOTTOM_EXTRA = 44

export const createEditorLayoutHandlers = ({ elements }) => {
    let bottomPanelObserver = null
    let mobileMediaQuery = null
    let releaseViewportListener = null
    let savedBodyOverflow = null
    let savedBodyPaddingRight = null

    const getToolbarToggleButton = () => document.getElementById("toolbar-toggle")

    const getToolbar = () => elements.toolbar || document.getElementById("editor-toolbar")

    const getScrollArea = () => elements.scrollArea || document.querySelector(".editor-scroll-area")

    const getBottomPanel = () => document.querySelector(".editor-bottom-panel")

    const getSafeNumber = (value) => {
        const numeric = Number.parseFloat(String(value || "0"))
        return Number.isFinite(numeric) ? numeric : 0
    }

    const syncToolbarToggleState = () => {
        const toolbarElement = getToolbar()
        const toggleButton = getToolbarToggleButton()
        if (!toolbarElement || !toggleButton) return
        const hidden = toolbarElement.classList.contains("is-hidden")
        const iconElement = toggleButton.querySelector("i")
        if (iconElement) {
            iconElement.textContent = hidden ? "expand_more" : "expand_less"
        }
        const label = hidden
            ? UI.getText("toolbar_show", "Показать панель инструментов")
            : UI.getText("toolbar_hide", "Скрыть панель инструментов")
        toggleButton.setAttribute("aria-label", label)
    }

    const syncBottomOffset = () => {
        const scrollAreaElement = getScrollArea()
        if (!scrollAreaElement) return
        const bottomPanelElement = getBottomPanel()
        if (!bottomPanelElement) {
            scrollAreaElement.style.removeProperty("--editor-bottom-offset")
            return
        }
        const panelRect = bottomPanelElement.getBoundingClientRect()
        const computedPanelStyles = window.getComputedStyle(bottomPanelElement)
        const panelMarginTop = getSafeNumber(computedPanelStyles.marginTop)
        const panelMarginBottom = getSafeNumber(computedPanelStyles.marginBottom)
        const baseOffset = panelRect.height + panelMarginTop + panelMarginBottom + DESKTOP_BOTTOM_EXTRA
        const mobileOffset = panelRect.height + panelMarginTop + panelMarginBottom + MOBILE_BOTTOM_EXTRA
        const isMobile = window.matchMedia(MOBILE_QUERY).matches
        const nextOffset = Math.ceil(isMobile ? mobileOffset : baseOffset)
        scrollAreaElement.style.setProperty("--editor-bottom-offset", `${nextOffset}px`)
    }

    const releaseBodyLock = () => {
        if (savedBodyOverflow !== null) {
            document.body.style.overflow = savedBodyOverflow
            savedBodyOverflow = null
        }
        if (savedBodyPaddingRight !== null) {
            document.body.style.paddingRight = savedBodyPaddingRight
            savedBodyPaddingRight = null
        }
    }

    const lockBodyScroll = () => {
        if (savedBodyOverflow === null) {
            savedBodyOverflow = document.body.style.overflow || ""
            savedBodyPaddingRight = document.body.style.paddingRight || ""
        }
        const scrollbarCompensation = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
        document.body.style.overflow = "hidden"
        document.body.style.paddingRight = scrollbarCompensation > 0 ? `${scrollbarCompensation}px` : savedBodyPaddingRight
    }

    const installBottomPanelObserver = () => {
        if (bottomPanelObserver) return
        const panel = getBottomPanel()
        if (!panel) return
        bottomPanelObserver = new ResizeObserver(() => syncBottomOffset())
        bottomPanelObserver.observe(panel)
    }

    const installViewportListener = () => {
        if (!window.visualViewport || releaseViewportListener) return
        const listener = () => syncBottomOffset()
        window.visualViewport.addEventListener("resize", listener)
        window.visualViewport.addEventListener("scroll", listener)
        releaseViewportListener = () => {
            window.visualViewport.removeEventListener("resize", listener)
            window.visualViewport.removeEventListener("scroll", listener)
            releaseViewportListener = null
        }
    }

    const installMediaQueryListener = () => {
        if (mobileMediaQuery) return
        mobileMediaQuery = window.matchMedia(MOBILE_QUERY)
        mobileMediaQuery.addEventListener("change", syncBottomOffset)
    }

    const uninstallMediaQueryListener = () => {
        if (!mobileMediaQuery) return
        mobileMediaQuery.removeEventListener("change", syncBottomOffset)
        mobileMediaQuery = null
    }

    const activate = () => {
        lockBodyScroll()
        installBottomPanelObserver()
        installViewportListener()
        installMediaQueryListener()
        syncToolbarToggleState()
        syncBottomOffset()
    }

    const deactivate = () => {
        releaseBodyLock()
        if (bottomPanelObserver) {
            bottomPanelObserver.disconnect()
            bottomPanelObserver = null
        }
        if (releaseViewportListener) {
            releaseViewportListener()
        }
        uninstallMediaQueryListener()
        const scrollAreaElement = getScrollArea()
        if (scrollAreaElement) {
            scrollAreaElement.style.removeProperty("--editor-bottom-offset")
        }
    }

    const toggleToolbar = () => {
        const toolbarElement = getToolbar()
        if (!toolbarElement) return false
        toolbarElement.classList.toggle("is-hidden")
        syncToolbarToggleState()
        syncBottomOffset()
        return !toolbarElement.classList.contains("is-hidden")
    }

    return {
        activate,
        deactivate,
        syncBottomOffset,
        syncToolbarToggleState,
        toggleToolbar
    }
}

"use strict";

import { CONFIG, createEditorState } from "./core-state.js"
import { createAutosaveHandlers } from "./core-autosave.js"
import { createEditingHistoryHandlers } from "./input-handlers.js"

export { CONFIG, createEditorState }

const createHistoryHandlers = (context) => {
    const { state, applySnapshot } = context

    const undo = () => {
        if (state.history.length <= 1) return
        const current = state.history.pop()
        state.future.push(current)
        const prev = state.history[state.history.length - 1]
        applySnapshot(prev)
    }

    const redo = () => {
        const next = state.future.pop()
        if (!next) return
        state.history.push(next)
        applySnapshot(next)
    }

    return { undo, redo }
}

export const createCoreEngine = (context) => {
    const autosave = createAutosaveHandlers(context)
    const history = createHistoryHandlers({ state: context.state, applySnapshot: context.applySnapshot })
    const editingHistory = createEditingHistoryHandlers({ undo: history.undo, redo: history.redo })

    return {
        autosave,
        history,
        editingHistory,
        undo: history.undo,
        redo: history.redo,
        queueSnapshot: autosave.queueSnapshot,
        captureSnapshot: autosave.captureSnapshot,
        persistDrawing: autosave.persistDrawing
    }
}

export const CONFIG = {
    MAX_HISTORY: 100,
    SNAPSHOT_DELAY: 300,
    MIN_IMG_WIDTH: 100,
    MAX_IMG_WIDTH: 860
}

export const createEditorState = () => ({
    elements: {},
    history: [],
    future: [],
    selectedMediaElement: null,
    resizeState: null,
    dragState: null,
    observer: null,
    abortController: null,
    recordingStream: null,
    savedSelectionRange: null,
    savedSelectionBookmark: null,
    alignMenuTarget: null,
    pageIndex: 0,
    titleTouched: false,
    autoSaveSnapshot: null,
    initialEditorState: null,
    isRenderingState: false,
    isApplyingSnapshot: false,
    snapshotToken: 0,
    snapshotFrame: null,
    manualSaveInProgress: false,
    isSaving: false,
    drawingState: typeof EditorDrawing === "undefined"
        ? { active: false, isDrawing: false }
        : EditorDrawing.state
})

import { CONFIG } from "./core-state.js"
import { createMediaHtml, resolveMediaDropPlacement, insertMediaAtPlacement, getMarkerRectFromPlacement } from "./media-placement.js"

export const createMediaHandlers = (context) => {
    const { elements, state, getPages, queueSnapshot, insertHtmlAtSelection, alignText, restoreSelection } = context

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

    const ensureDropMarker = () => {
        if (state.dropMarkerElement && document.body.contains(state.dropMarkerElement)) return state.dropMarkerElement
        const marker = document.createElement("div")
        marker.className = "media-drop-marker"
        document.body.appendChild(marker)
        state.dropMarkerElement = marker
        return marker
    }

    const clearDropMarker = () => {
        if (!state.dropMarkerElement) return
        state.dropMarkerElement.remove()
        state.dropMarkerElement = null
    }

    const updateDropMarker = (placement) => {
        const markerRect = getMarkerRectFromPlacement(placement)
        if (!markerRect) {
            clearDropMarker()
            return
        }
        const marker = ensureDropMarker()
        marker.style.left = `${markerRect.left}px`
        marker.style.top = `${markerRect.top}px`
        marker.style.width = `${markerRect.width}px`
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
        const placement = resolveMediaDropPlacement({
            editorRoot: elements.content,
            pages: getPages(),
            activePage: getPages()[state.pageIndex] || elements.content,
            x: event.clientX,
            y: event.clientY,
            ignoredNodes: [state.dragState.wrapper, state.dragState.trailingBreak]
        })
        state.dragState.dropPlacement = placement
        updateDropMarker(placement)
        event.preventDefault()
    }

    const handleMediaDragEnd = (event) => {
        if (!state.dragState) return
        const { wrapper, trailingBreak, moved, dropPlacement } = state.dragState
        wrapper.classList.remove("dragging")
        wrapper.style.transform = ""
        wrapper.style.pointerEvents = ""
        wrapper.style.zIndex = ""
        if (moved) {
            placeDraggedMedia(wrapper, trailingBreak, event.clientX, event.clientY, dropPlacement)
            queueSnapshot()
        }
        clearDropMarker()
        state.dragState = null
        document.removeEventListener("pointermove", handleMediaDragMove)
    }

    const handleNativeDragStart = (event) => {
        if (!event.target.closest(".media-draggable-item")) return
        event.preventDefault()
    }

    const isImageSourceAllowed = (source) => /^https:\/\//i.test(source)
        || /^data:image\//i.test(source)
        || /^blob:/i.test(source)

    const insertMedia = (src, type) => {
        const normalizedSource = String(src || "").trim()
        if (type !== "image" || !isImageSourceAllowed(normalizedSource)) return ""
        const id = Utils.generateId()
        const html = createMediaHtml({
            id,
            src: Utils.escapeHtml(normalizedSource)
        })
        insertHtmlAtSelection(html)
        makeMediaDraggable()
        syncMediaSizes()
        return id
    }

    const replaceMediaSource = (mediaId, nextSource) => {
        const normalizedId = String(mediaId || "").trim()
        const normalizedSource = String(nextSource || "").trim()
        if (!normalizedId || !normalizedSource) return false
        const wrapper = document.getElementById(normalizedId)
        if (!wrapper) return false
        const imageElement = wrapper.querySelector("img")
        if (!imageElement) return false
        imageElement.src = normalizedSource
        return true
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
        clearDropMarker()
        document.removeEventListener("pointermove", handleResizeMove)
        document.removeEventListener("pointerup", handleResizeEnd)
        document.removeEventListener("pointercancel", handleResizeEnd)
        document.removeEventListener("pointermove", handleMediaDragMove)
        document.removeEventListener("pointerup", handleMediaDragEnd)
        document.removeEventListener("pointercancel", handleMediaDragEnd)
    }


    const placeDraggedMedia = (wrapper, trailingBreak, clientX, clientY, cachedPlacement) => {
        const placement = cachedPlacement || resolveMediaDropPlacement({
            editorRoot: elements.content,
            pages: getPages(),
            activePage: getPages()[state.pageIndex] || elements.content,
            x: clientX,
            y: clientY,
            ignoredNodes: [wrapper, trailingBreak]
        })
        insertMediaAtPlacement({
            wrapper,
            trailingBreak,
            placement,
            fallbackRoot: getPages()[state.pageIndex] || elements.content
        })
    }

    return {
        fileToDataUrl,
        handleResizeStart,
        handleMediaDragStart,
        handleNativeDragStart,
        insertMedia,
        replaceMediaSource,
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

export const createLinkHandlers = (context) => {
    const { getActiveRangeInContent, restoreSelection, openFromList, getEditorCommands } = context

    const normalizeUrl = (value) => {
        const url = String(value || "").trim()
        if (!url) return ""
        if (/^https?:\/\//i.test(url)) return url
        if (/^mailto:/i.test(url)) return url
        if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) return `https://${url}`
        return url
    }

    const applyLink = (value) => {
        const url = normalizeUrl(value)
        if (!url) return
        if (typeof restoreSelection === "function") restoreSelection()
        const range = getActiveRangeInContent()
        if (!range || range.collapsed) {
            UI.showToast(UI.getText("link_selection_required", "Select text to link"))
            return
        }
        getEditorCommands()?.insertLink(url)
    }

    const openNoteById = (noteId) => {
        const note = StateStore.read().notes.find(item => item.id === noteId)
        if (!note) {
            UI.showToast(UI.getText("note_link_not_found", "Note not found"))
            return
        }
        openFromList(note)
    }

    return {
        applyLink,
        openNoteById
    }
}

export const createMathHandlers = (context) => {
    const {
        elements,
        state,
        getActiveRangeInContent,
        getBlockFromRange,
        getCaretOffsetInBlock,
        createRangeFromOffsets,
        getPages,
        queueSnapshot
    } = context

    const confirmEquationAtCaret = () => {
        const range = getActiveRangeInContent()
        if (!range || !range.collapsed) return false
        const target = getBlockFromRange(range) || getPages()[state.pageIndex] || elements.content
        if (!target) return false
        const caretOffset = getCaretOffsetInBlock(target, range)
        if (caretOffset === null) return false
        const fullText = target.textContent || ""
        const expressionData = window.Calculator?.findExpressionAroundCaret?.(fullText, caretOffset)
        if (!expressionData) return false
        const result = window.Calculator?.evaluateExpression?.(expressionData.expression)
        if (!Number.isFinite(result)) return false
        const replaceRange = createRangeFromOffsets(target, expressionData.start, expressionData.end)
        if (!replaceRange) return false
        replaceRange.deleteContents()
        const formatted = window.Calculator?.formatResult?.(result) ?? String(result)
        replaceRange.insertNode(document.createTextNode(formatted))
        replaceRange.collapse(false)
        const sel = window.getSelection()
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(replaceRange)
        }
        queueSnapshot()
        return true
    }

    const confirmEquation = () => {
        confirmEquationAtCaret()
    }

    return { confirmEquationAtCaret, confirmEquation }
}

"use strict";

import {
    createSelectionHandlers,
    createClipboardHandlers,
    createTagHandlers,
    createEnterHandlers,
    normalizeParagraphModel,
    createEditingHistoryHandlers
} from "./input-handlers.js"

export const createInputEngine = (context) => {
    const { elements, state, queueSnapshot, fileToDataUrl, insertMedia, undo, redo, confirmEquationAtCaret } = context
    const selectionHandlers = createSelectionHandlers({ elements, state })

    const normalizeActivePage = () => {
        const page = selectionHandlers.getActivePage()
        if (!page) return false
        return normalizeParagraphModel(page)
    }

    const clipboardHandlers = createClipboardHandlers({
        queueSnapshot,
        fileToDataUrl,
        insertMedia,
        insertFragmentAtSelection: selectionHandlers.insertFragmentAtSelection,
        createFragmentFromHtml: selectionHandlers.createFragmentFromHtml,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        getActivePage: selectionHandlers.getActivePage,
        restoreSelection: selectionHandlers.restoreSelection,
        storeSelection: selectionHandlers.storeSelection,
        normalizeActivePage
    })

    const enterHandlers = createEnterHandlers({
        elements,
        queueSnapshot,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        getActiveBlock: selectionHandlers.getActiveBlock,
        placeCaretAtStart: selectionHandlers.placeCaretAtStart,
        setSelectionRange: selectionHandlers.setSelectionRange
    })

    const tagHandlers = createTagHandlers({ elements, queueSnapshot })
    const editingHistoryHandlers = createEditingHistoryHandlers({ undo, redo })

    const handleInput = () => {
        if (state.isApplyingSnapshot) return
        queueSnapshot()
    }

    const handleKeydown = (event) => {
        if (event.defaultPrevented) return
        if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            enterHandlers.handleEnter(event)
            if (event.defaultPrevented) return
        }
        if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            if (confirmEquationAtCaret?.()) event.preventDefault()
            if (event.defaultPrevented) return
        }
        editingHistoryHandlers.handleKeydown(event)
    }

    const handleBeforeInput = (event) => {
        if (editingHistoryHandlers.handleBeforeInput(event)) return
        enterHandlers.handleBeforeInput(event)
    }

    const handleEvent = (event) => {
        if (!elements.content || !elements.content.contains(event.target) && event.target !== elements.content) return
        if (event.type === "paste") {
            clipboardHandlers.handlePaste(event)
            return
        }
        if (event.type === "copy") {
            clipboardHandlers.handleCopy(event)
            return
        }
        if (event.type === "cut") {
            clipboardHandlers.handleCut(event)
            return
        }
        if (event.type === "beforeinput") {
            handleBeforeInput(event)
            return
        }
        if (event.type === "keydown") {
            handleKeydown(event)
            return
        }
        if (event.type === "input") {
            handleInput(event)
            return
        }
        if (event.type === "keyup" || event.type === "mouseup" || event.type === "touchend") {
            selectionHandlers.storeSelection()
        }
    }

    const attachDelegatedHandlers = (container, signal) => {
        const delegatedEvents = ["paste", "copy", "cut", "beforeinput", "keydown", "input", "keyup", "mouseup", "touchend"]
        delegatedEvents.forEach(type => container.addEventListener(type, handleEvent, { signal }))
    }

    const createMutationObserver = (scheduleSnapshotFrame) => new MutationObserver((mutations) => {
        const hasStructuralChange = mutations.some(mutation => {
            if (mutation.type === "childList") return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0
            if (mutation.type === "attributes") return mutation.attributeName !== "style" || mutation.target.classList?.contains("media-wrapper")
            return false
        })
        if (hasStructuralChange) scheduleSnapshotFrame()
    })

    return {
        ...selectionHandlers,
        ...tagHandlers,
        handlePaste: clipboardHandlers.handlePaste,
        handleCopy: clipboardHandlers.handleCopy,
        handleCut: clipboardHandlers.handleCut,
        handleBeforeInput,
        handleKeydown,
        handleInput,
        attachDelegatedHandlers,
        createMutationObserver
    }
}

"use strict";

import { createMediaHandlers } from "./core-media.js"
import { createLinkHandlers, createMathHandlers } from "./links-math.js"
import { createEditorCommands } from "./editor-commands.js"
import { ensureDrawingLoaded } from "./drawing-loader.js"

export const createFeatureEngine = (context) => {
    const media = createMediaHandlers(context.media)
    const commands = createEditorCommands(context.commands)
    const links = createLinkHandlers({
        getActiveRangeInContent: context.commands.getActiveRangeInContent,
        restoreSelection: context.commands.restoreSelection,
        getEditorCommands: () => commands,
        openFromList: context.openFromList
    })

    let mathHandlersPromise = null
    let mathHandlers = null
    const loadMath = async () => {
        if (!mathHandlersPromise) {
            mathHandlersPromise = Promise.resolve().then(() => {
                mathHandlers = createMathHandlers(context.math)
                return mathHandlers
            })
        }
        return mathHandlersPromise
    }

    const commandDispatcher = (type, payload) => {
        const handlers = {
            bold: () => commands.toggleBold(),
            italic: () => commands.toggleItalic(),
            underline: () => commands.toggleUnderline(),
            strike: () => commands.toggleStrike(),
            bullet: () => commands.toggleBulletedList(),
            number: () => commands.toggleNumberedList(),
            clear: () => commands.clearFormatting(),
            link: () => commands.insertLink(payload?.url || "", payload || {}),
            align: () => commands.alignText(payload?.side)
        }
        const execute = handlers[type]
        if (!execute) return false
        return !!execute()
    }

    const confirmEquationAtCaret = () => {
        if (mathHandlers) return mathHandlers.confirmEquationAtCaret()
        loadMath()
        return false
    }

    const drawing = {
        ensureLoaded: async () => ensureDrawingLoaded(),
        configure: async (config) => {
            const instance = await ensureDrawingLoaded()
            instance?.configure?.(config)
            return instance
        },
        setupControls: async () => {
            const instance = await ensureDrawingLoaded()
            instance?.setupControls?.()
            return instance
        },
        toggleMode: async () => {
            const instance = await ensureDrawingLoaded()
            instance?.toggleDrawingMode?.()
            return instance
        },
        isReady: () => typeof window.EditorDrawing !== "undefined",
        getInstance: () => window.EditorDrawing
    }

    return {
        media,
        links,
        commands,
        commandDispatcher,
        confirmEquationAtCaret,
        loadMath,
        drawing
    }
}

const EditorDrawing = (() => {
    const drawingState = {
        active: false,
        color: "#111111",
        size: 3,
        tool: "pen",
        canvas: null,
        ctx: null,
        container: null,
        pageElement: null,
        scrollContainer: null,
        pointerPreview: null,
        isDrawing: false,
        pointerId: null
    }

    const supportedTools = new Set(["pen", "marker", "eraser"])

    let elements = {}
    let buildToolbar = () => {}
    let updateEditableState = () => {}
    let onDrawingChange = () => {}

    const engine = typeof DrawingSurfaceEngine === "undefined" ? null : DrawingSurfaceEngine.createEngine()

    const syncDrawingStateFromEngine = () => {
        if (!engine) return
        const engineState = engine.getState()
        drawingState.canvas = engineState.canvasElement || null
        drawingState.ctx = engineState.canvasContext || null
        drawingState.pointerPreview = engineState.pointerPreviewElement || null
        drawingState.isDrawing = !!engineState.isPointerDown
        drawingState.pointerId = engineState.activePointerIdentifier ?? null
    }

    const setActiveControlsState = () => {
        if (elements.drawingControls) elements.drawingControls.classList.toggle("hidden", !drawingState.active)
    }

    const updateToolButtons = () => {
        const toolButtonElements = elements.drawingControls?.querySelectorAll("[data-drawing-tool]") || []
        toolButtonElements.forEach((buttonElement) => {
            buttonElement.classList.toggle("is-active", buttonElement.dataset.drawingTool === drawingState.tool)
        })
    }

    const updateColorButtons = () => {
        const selectedColor = String(drawingState.color || "").toLowerCase()
        const colorButtonElements = elements.drawingControls?.querySelectorAll("[data-drawing-color]") || []
        colorButtonElements.forEach((buttonElement) => {
            const buttonColor = String(buttonElement.dataset.drawingColor || "").toLowerCase()
            buttonElement.classList.toggle("is-active", buttonColor === selectedColor)
        })
    }

    const setDrawingTool = (tool) => {
        if (!supportedTools.has(tool)) return
        drawingState.tool = tool
        engine?.setTool(tool)
        updateToolButtons()
        syncDrawingStateFromEngine()
    }

    const setDrawingColor = (color) => {
        if (!color) return
        drawingState.color = color
        if (elements.drawingColor) elements.drawingColor.value = color
        if (typeof ColorPalette !== "undefined" && elements.drawingColor) ColorPalette.syncInput(elements.drawingColor)
        engine?.setColor(color)
        updateColorButtons()
    }

    const setDrawingSize = (size) => {
        const normalizedSize = Number.isFinite(size) ? Utils.clamp(size, 1, 28) : 3
        drawingState.size = normalizedSize
        if (elements.drawingSize) elements.drawingSize.value = String(normalizedSize)
        engine?.setSize(normalizedSize)
        syncDrawingStateFromEngine()
    }

    const setupControls = () => {
        if (elements.drawingColor) {
            elements.drawingColor.value = drawingState.color
            elements.drawingColor.addEventListener("input", (event) => {
                setDrawingColor(String(event.target.value || "#111111"))
            })
        }

        if (elements.drawingSize) {
            elements.drawingSize.value = String(drawingState.size)
            elements.drawingSize.addEventListener("input", (event) => {
                setDrawingSize(Number(event.target.value))
            })
        }

        if (elements.drawingControls) {
            elements.drawingControls.querySelectorAll("[data-drawing-tool]").forEach((buttonElement) => {
                const tool = String(buttonElement.dataset.drawingTool || "pen")
                if (!supportedTools.has(tool)) {
                    buttonElement.disabled = true
                    buttonElement.setAttribute("aria-disabled", "true")
                    return
                }
                buttonElement.disabled = false
                buttonElement.setAttribute("aria-disabled", "false")
                buttonElement.addEventListener("click", () => setDrawingTool(tool))
            })

            elements.drawingControls.querySelectorAll("[data-drawing-color]").forEach((buttonElement) => {
                buttonElement.addEventListener("click", () => {
                    setDrawingColor(buttonElement.dataset.drawingColor || "#111111")
                })
            })

            if (typeof ColorPalette !== "undefined") ColorPalette.init(elements.drawingControls)
        }

        window.addEventListener("resize", () => {
            engine?.refreshLayout()
            syncDrawingStateFromEngine()
        })

        updateToolButtons()
        updateColorButtons()
        setActiveControlsState()
    }

    const attachEngineHost = () => {
        if (!engine) return
        engine.setHostElements(drawingState.container, drawingState.pageElement, drawingState.scrollContainer)
        engine.setTool(drawingState.tool)
        engine.setColor(drawingState.color)
        engine.setSize(drawingState.size)
        engine.setEnabled(drawingState.active)
        syncDrawingStateFromEngine()
    }

    const configure = ({ elements: nextElements, buildToolbar: nextBuildToolbar, updateEditableState: nextUpdateEditableState, onDrawingChange: nextOnDrawingChange } = {}) => {
        elements = nextElements || {}
        if (typeof nextBuildToolbar === "function") buildToolbar = nextBuildToolbar
        if (typeof nextUpdateEditableState === "function") updateEditableState = nextUpdateEditableState
        if (typeof nextOnDrawingChange === "function") onDrawingChange = nextOnDrawingChange

        drawingState.container = elements.content || null
        drawingState.scrollContainer = elements.scrollArea || elements.content || null
        drawingState.pageElement = elements.content?.querySelector(".note-page.is-active") || null

        if (!engine) return
        engine.setSnapshotChangeHandler((snapshot) => {
            onDrawingChange(snapshot)
            syncDrawingStateFromEngine()
        })
        attachEngineHost()
    }

    const refreshDrawingSurface = () => {
        attachEngineHost()
        engine?.refreshLayout()
        syncDrawingStateFromEngine()
    }

    const setActivePage = (pageElement) => {
        drawingState.pageElement = pageElement || null
        attachEngineHost()
        engine?.refreshLayout()
        syncDrawingStateFromEngine()
    }

    const getDrawingSnapshot = () => {
        if (!engine) return ""
        return engine.getSnapshot()
    }

    const getDrawingData = () => {
        if (!engine) return ""
        return engine.buildSnapshot()
    }

    const setDrawingData = (dataUrl, options = {}) => {
        const snapshot = typeof dataUrl === "string" ? dataUrl : ""
        refreshDrawingSurface()
        engine?.setSnapshot(snapshot, { resetHistory: options.replaceHistory !== false })
    }

    const toggleDrawingMode = () => {
        drawingState.active = !drawingState.active
        engine?.setEnabled(drawingState.active)
        if (!drawingState.active) {
            const snapshot = engine?.buildSnapshot() || ""
            onDrawingChange(snapshot)
            engine?.hidePointerPreview()
        }
        setActiveControlsState()
        updateEditableState()
        buildToolbar()
        syncDrawingStateFromEngine()
    }

    const undo = async () => {
        if (!drawingState.active || !engine) return false
        await engine.undo()
        syncDrawingStateFromEngine()
        return true
    }

    const redo = async () => {
        if (!drawingState.active || !engine) return false
        await engine.redo()
        syncDrawingStateFromEngine()
        return true
    }

    const cleanup = () => {
        drawingState.active = false
        drawingState.isDrawing = false
        drawingState.pointerId = null
        setActiveControlsState()
        engine?.reset()
        syncDrawingStateFromEngine()
    }

    return {
        configure,
        setupControls,
        state: drawingState,
        refreshDrawingSurface,
        setActivePage,
        setDrawingData,
        getDrawingSnapshot,
        getDrawingData,
        toggleDrawingMode,
        undo,
        redo,
        cleanup
    }
})()

window.EditorDrawing = EditorDrawing
let drawingReadyPromise = null

const loadScript = (src) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dynamic-src="${src}"]`)
    if (existing) {
        if (existing.dataset.loaded === "true") {
            resolve()
            return
        }
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener("error", () => reject(new Error(`failed:${src}`)), { once: true })
        return
    }
    const script = document.createElement("script")
    script.src = src
    script.defer = true
    script.dataset.dynamicSrc = src
    script.addEventListener("load", () => {
        script.dataset.loaded = "true"
        resolve()
    }, { once: true })
    script.addEventListener("error", () => reject(new Error(`failed:${src}`)), { once: true })
    document.head.appendChild(script)
})

export const ensureDrawingLoaded = async () => {
    if (!drawingReadyPromise) {
        drawingReadyPromise = (async () => {
            await loadScript("js/editor/drawing-engine.js?v=2026-04-19-final")
            await loadScript("js/editor/drawing.js?v=2026-04-19-final")
            return window.EditorDrawing || null
        })()
    }
    return drawingReadyPromise
}
