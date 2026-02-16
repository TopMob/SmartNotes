const EditorDrawing = (() => {
    const drawingState = {
        active: false,
        color: "#111111",
        size: 3,
        tool: "pen",
        isDrawing: false,
        pointerId: null,
        canvas: null,
        ctx: null,
        scale: 1,
        container: null,
        content: null,
        pageElement: null,
        scrollContainer: null,
        resizeObserver: null,
        mutationObserver: null,
        scrollFrame: null,
        layoutFrame: null,
        pointerPreview: null
    }
    const drawingHistory = []
    let lastDrawingSnapshot = ""
    const historyLimit = 100
    let elements = {}
    let buildToolbar = () => {}
    let updateEditableState = () => {}
    let onDrawingChange = () => {}

    const configure = ({ elements: nextElements, buildToolbar: nextBuildToolbar, updateEditableState: nextUpdateEditableState, onDrawingChange: nextOnDrawingChange } = {}) => {
        elements = nextElements || {}
        if (typeof nextBuildToolbar === "function") buildToolbar = nextBuildToolbar
        if (typeof nextUpdateEditableState === "function") updateEditableState = nextUpdateEditableState
        if (typeof nextOnDrawingChange === "function") onDrawingChange = nextOnDrawingChange
        drawingState.content = elements.content || null
        drawingState.container = elements.content || null
        drawingState.scrollContainer = elements.content || null
        drawingState.pageElement = elements.content?.querySelector(".note-page.is-active") || null
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
                const next = Number(event.target.value)
                drawingState.size = Number.isFinite(next) ? Utils.clamp(next, 1, 28) : 3
                updatePointerPreviewSize()
            })
        }
        if (elements.drawingControls) {
            elements.drawingControls.querySelectorAll("[data-drawing-tool]").forEach(btn => {
                const tool = btn.dataset.drawingTool || "pen"
                if (isSupportedTool(tool)) {
                    btn.addEventListener("click", () => setDrawingTool(tool))
                } else {
                    btn.disabled = true
                    btn.setAttribute("aria-disabled", "true")
                }
            })
            elements.drawingControls.querySelectorAll("[data-drawing-color]").forEach(btn => {
                btn.addEventListener("click", () => setDrawingColor(btn.dataset.drawingColor || "#111111"))
            })
            if (typeof ColorPalette !== "undefined") ColorPalette.init(elements.drawingControls)
        }
        updateDrawingToolButtons()
        updateDrawingColorButtons()
        window.addEventListener("resize", () => scheduleLayoutSync())
    }

    const isSupportedTool = (tool) => ["pen", "eraser"].includes(tool)

    const updateDrawingToolButtons = () => {
        const toolButtons = elements.drawingControls?.querySelectorAll("[data-drawing-tool]") || []
        toolButtons.forEach(btn => {
            btn.classList.toggle("is-active", btn.dataset.drawingTool === drawingState.tool)
        })
    }

    const updateDrawingColorButtons = () => {
        const current = String(drawingState.color || "").toLowerCase()
        const colorButtons = elements.drawingControls?.querySelectorAll("[data-drawing-color]") || []
        colorButtons.forEach(btn => {
            const value = String(btn.dataset.drawingColor || "").toLowerCase()
            btn.classList.toggle("is-active", value === current)
        })
    }

    const setDrawingTool = (tool) => {
        if (!isSupportedTool(tool)) return
        drawingState.tool = tool
        applyToolStyle()
        updatePointerPreviewSize()
        updateDrawingToolButtons()
    }

    const setDrawingColor = (color) => {
        if (!color) return
        drawingState.color = color
        if (elements.drawingColor) elements.drawingColor.value = color
        if (typeof ColorPalette !== "undefined" && elements.drawingColor) ColorPalette.syncInput(elements.drawingColor)
        updateDrawingColorButtons()
    }

    const ensureCanvas = () => {
        if (!drawingState.container || !drawingState.content) return null
        if (drawingState.canvas) return drawingState.canvas
        const canvas = document.createElement("canvas")
        canvas.className = "note-drawing-canvas"
        canvas.setAttribute("aria-hidden", "true")
        canvas.tabIndex = -1
        canvas.style.pointerEvents = "none"
        canvas.addEventListener("pointerdown", startDrawing)
        canvas.addEventListener("pointermove", drawLine)
        canvas.addEventListener("pointermove", movePointerPreview)
        canvas.addEventListener("pointerup", endDrawing)
        canvas.addEventListener("pointercancel", endDrawing)
        canvas.addEventListener("pointerleave", hidePointerPreview)
        drawingState.container.appendChild(canvas)
        drawingState.canvas = canvas
        drawingState.ctx = canvas.getContext("2d")
        attachObservers()
        scheduleLayoutSync()
        return canvas
    }

    const attachObservers = () => {
        const target = drawingState.pageElement || drawingState.content
        if (!target || !drawingState.scrollContainer) return
        if (drawingState.resizeObserver) drawingState.resizeObserver.disconnect()
        drawingState.resizeObserver = null
        if (drawingState.mutationObserver) drawingState.mutationObserver.disconnect()
        drawingState.mutationObserver = null
        drawingState.scrollContainer.removeEventListener("scroll", scheduleScrollSync)
        if (typeof ResizeObserver !== "undefined") {
            drawingState.resizeObserver = new ResizeObserver(() => scheduleLayoutSync())
            drawingState.resizeObserver.observe(target)
        }
        drawingState.mutationObserver = new MutationObserver(() => scheduleLayoutSync())
        drawingState.mutationObserver.observe(target, { childList: true, subtree: true, characterData: true })
        drawingState.scrollContainer.addEventListener("scroll", scheduleScrollSync, { passive: true })
    }

    const detachObservers = () => {
        if (drawingState.resizeObserver) drawingState.resizeObserver.disconnect()
        drawingState.resizeObserver = null
        if (drawingState.mutationObserver) drawingState.mutationObserver.disconnect()
        drawingState.mutationObserver = null
        drawingState.scrollContainer?.removeEventListener("scroll", scheduleScrollSync)
    }

    const scheduleScrollSync = () => {
        if (drawingState.scrollFrame) return
        drawingState.scrollFrame = requestAnimationFrame(() => {
            drawingState.scrollFrame = null
            syncCanvasPosition()
        })
    }

    const scheduleLayoutSync = () => {
        if (drawingState.layoutFrame) return
        drawingState.layoutFrame = requestAnimationFrame(() => {
            drawingState.layoutFrame = null
            syncCanvasLayout()
        })
    }

    const syncCanvasPosition = () => {
        if (!drawingState.canvas || !drawingState.pageElement || !drawingState.scrollContainer) return
        const top = drawingState.pageElement.offsetTop
        const left = drawingState.pageElement.offsetLeft
        drawingState.canvas.style.top = `${top}px`
        drawingState.canvas.style.left = `${left}px`
    }

    const syncCanvasLayout = () => {
        if (!drawingState.canvas || !drawingState.ctx) return
        const target = drawingState.pageElement || drawingState.content
        if (!target) return
        const cssWidth = Math.max(1, Math.floor(target.clientWidth))
        const cssHeight = Math.max(1, Math.floor(target.scrollHeight))
        const scale = window.devicePixelRatio || 1
        const width = Math.max(1, Math.floor(cssWidth * scale))
        const height = Math.max(1, Math.floor(cssHeight * scale))
        const sizeChanged = drawingState.canvas.width !== width || drawingState.canvas.height !== height || drawingState.scale !== scale
        if (sizeChanged) {
            const previousCanvas = document.createElement("canvas")
            previousCanvas.width = drawingState.canvas.width
            previousCanvas.height = drawingState.canvas.height
            const previousContext = previousCanvas.getContext("2d")
            if (previousContext && drawingState.canvas.width && drawingState.canvas.height) {
                previousContext.drawImage(drawingState.canvas, 0, 0)
            }
            drawingState.canvas.width = width
            drawingState.canvas.height = height
            drawingState.canvas.style.width = `${cssWidth}px`
            drawingState.canvas.style.height = `${cssHeight}px`
            drawingState.ctx.setTransform(1, 0, 0, 1, 0, 0)
            if (previousCanvas.width && previousCanvas.height) {
                drawingState.ctx.drawImage(previousCanvas, 0, 0)
            }
            applyCanvasScale(scale)
        } else {
            drawingState.canvas.style.width = `${cssWidth}px`
            drawingState.canvas.style.height = `${cssHeight}px`
        }
        syncCanvasPosition()
    }

    const applyCanvasScale = (scale) => {
        if (!drawingState.ctx) return
        drawingState.scale = scale
        drawingState.ctx.setTransform(scale, 0, 0, scale, 0, 0)
    }

    const normalizeDrawingData = (value) => typeof value === "string" ? value : ""

    const replaceDrawingHistory = (dataUrl) => {
        drawingHistory.length = 0
        drawingHistory.push(dataUrl)
        lastDrawingSnapshot = dataUrl
    }

    const pushDrawingHistory = (dataUrl) => {
        if (dataUrl === lastDrawingSnapshot) return
        drawingHistory.push(dataUrl)
        if (drawingHistory.length > historyLimit) drawingHistory.shift()
        lastDrawingSnapshot = dataUrl
    }

    const getCanvasPoint = (event) => {
        if (!drawingState.canvas) return null
        const rect = drawingState.canvas.getBoundingClientRect()
        const x = Utils.clamp(event.clientX - rect.left, 0, rect.width)
        const y = Utils.clamp(event.clientY - rect.top, 0, rect.height)
        return { x, y }
    }

    const resolveCurrentToolSize = () => drawingState.tool === "eraser" ? Math.max(10, drawingState.size * 2) : drawingState.size

    const applyToolStyle = () => {
        if (!drawingState.ctx) return
        if (drawingState.tool === "eraser") {
            drawingState.ctx.globalCompositeOperation = "destination-out"
            drawingState.ctx.globalAlpha = 1
            drawingState.ctx.strokeStyle = "#000000"
        } else {
            drawingState.ctx.globalCompositeOperation = "source-over"
            drawingState.ctx.globalAlpha = 1
            drawingState.ctx.strokeStyle = drawingState.color
        }
        drawingState.ctx.lineWidth = resolveCurrentToolSize()
        drawingState.ctx.lineCap = "round"
        drawingState.ctx.lineJoin = "round"
    }


    const updatePointerPreviewSize = () => {
        const preview = drawingState.pointerPreview
        if (!preview) return
        const size = resolveCurrentToolSize()
        preview.style.width = `${size}px`
        preview.style.height = `${size}px`
        preview.style.borderColor = drawingState.tool === "eraser" ? "rgba(248, 113, 113, 0.9)" : "rgba(59, 130, 246, 0.9)"
        preview.style.background = drawingState.tool === "eraser" ? "rgba(248, 113, 113, 0.2)" : "rgba(59, 130, 246, 0.18)"
    }

    const movePointerPreview = (event) => {
        if (!drawingState.active || !drawingState.pointerPreview) return
        const point = getCanvasPoint(event)
        if (!point || !drawingState.canvas) return
        const rect = drawingState.canvas.getBoundingClientRect()
        drawingState.pointerPreview.style.transform = `translate(${rect.left + point.x}px, ${rect.top + point.y}px) translate(-50%, -50%)`
        drawingState.pointerPreview.style.opacity = "1"
    }

    const hidePointerPreview = () => {
        if (!drawingState.pointerPreview) return
        drawingState.pointerPreview.style.opacity = "0"
    }

    const ensurePointerPreview = () => {
        if (drawingState.pointerPreview) return
        const preview = document.createElement("div")
        preview.className = "drawing-pointer-preview"
        preview.setAttribute("aria-hidden", "true")
        document.body.appendChild(preview)
        drawingState.pointerPreview = preview
        updatePointerPreviewSize()
    }

    const refreshDrawingSurface = () => {
        ensureCanvas()
        scheduleLayoutSync()
    }

    const setActivePage = (pageElement) => {
        if (pageElement && drawingState.pageElement === pageElement) return
        drawingState.pageElement = pageElement
        attachObservers()
        scheduleLayoutSync()
    }

    const clearCanvas = () => {
        if (!drawingState.canvas || !drawingState.ctx) return
        drawingState.ctx.setTransform(1, 0, 0, 1, 0, 0)
        drawingState.ctx.clearRect(0, 0, drawingState.canvas.width, drawingState.canvas.height)
        applyCanvasScale(drawingState.scale)
        lastDrawingSnapshot = ""
    }

    const getDrawingData = () => {
        if (!drawingState.canvas || !drawingState.ctx) return ""
        const sourceCanvas = drawingState.canvas
        const width = sourceCanvas.width
        const height = sourceCanvas.height
        if (!width || !height) return ""
        const imageData = drawingState.ctx.getImageData(0, 0, width, height).data
        let minX = width
        let minY = height
        let maxX = -1
        let maxY = -1
        for (let pixelIndex = 3, pointIndex = 0; pixelIndex < imageData.length; pixelIndex += 4, pointIndex++) {
            if (imageData[pixelIndex] === 0) continue
            const x = pointIndex % width
            const y = Math.floor(pointIndex / width)
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
        }
        if (maxX < minX || maxY < minY) return ""
        const padding = Math.ceil(Math.max(2, drawingState.size))
        const cropX = Math.max(0, minX - padding)
        const cropY = Math.max(0, minY - padding)
        const cropWidth = Math.min(width - cropX, (maxX - minX + 1) + padding * 2)
        const cropHeight = Math.min(height - cropY, (maxY - minY + 1) + padding * 2)

        const exportCanvas = document.createElement("canvas")
        exportCanvas.width = Math.max(1, cropWidth)
        exportCanvas.height = Math.max(1, cropHeight)
        const exportContext = exportCanvas.getContext("2d")
        if (!exportContext) return ""
        exportContext.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

        const createCompressedDataUrl = (canvas) => {
            const webpDataUrl = canvas.toDataURL("image/webp", 0.82)
            if (webpDataUrl.startsWith("data:image/webp")) return webpDataUrl
            return canvas.toDataURL("image/png")
        }
        let dataUrl = createCompressedDataUrl(exportCanvas)
        const maxLength = 180000
        let currentCanvas = exportCanvas
        while (dataUrl.length > maxLength && currentCanvas.width > 320 && currentCanvas.height > 320) {
            const scaledCanvas = document.createElement("canvas")
            scaledCanvas.width = Math.max(1, Math.floor(currentCanvas.width * 0.85))
            scaledCanvas.height = Math.max(1, Math.floor(currentCanvas.height * 0.85))
            const scaledContext = scaledCanvas.getContext("2d")
            if (!scaledContext) break
            scaledContext.drawImage(currentCanvas, 0, 0, currentCanvas.width, currentCanvas.height, 0, 0, scaledCanvas.width, scaledCanvas.height)
            currentCanvas = scaledCanvas
            dataUrl = createCompressedDataUrl(currentCanvas)
        }
        return dataUrl
    }

    const getDrawingSnapshot = () => lastDrawingSnapshot

    const setDrawingData = (dataUrl, options = {}) => {
        const { recordHistory = false, replaceHistory = false } = options
        refreshDrawingSurface()
        const normalized = normalizeDrawingData(dataUrl)
        lastDrawingSnapshot = normalized
        if (!normalized) {
            clearCanvas()
            if (recordHistory) {
                if (replaceHistory) replaceDrawingHistory("")
                else pushDrawingHistory("")
            }
            return
        }
        if (recordHistory) {
            if (replaceHistory) replaceDrawingHistory(normalized)
            else pushDrawingHistory(normalized)
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!drawingState.canvas || !drawingState.ctx) return
                const image = new Image()
                image.onload = () => {
                    if (!drawingState.canvas || !drawingState.ctx) return
                    drawingState.ctx.setTransform(1, 0, 0, 1, 0, 0)
                    drawingState.ctx.clearRect(0, 0, drawingState.canvas.width, drawingState.canvas.height)
                    drawingState.ctx.drawImage(image, 0, 0, drawingState.canvas.width, drawingState.canvas.height)
                    applyCanvasScale(drawingState.scale)
                }
                image.src = normalized
            })
        })
    }

    const toggleDrawingMode = () => {
        drawingState.active = !drawingState.active
        if (elements.drawingControls) {
            elements.drawingControls.classList.toggle("hidden", !drawingState.active)
        }
        ensureCanvas()
        if (drawingState.canvas) {
            drawingState.canvas.style.pointerEvents = drawingState.active ? "auto" : "none"
        }
        if (drawingState.active) {
            ensurePointerPreview()
            updatePointerPreviewSize()
        } else {
            hidePointerPreview()
        }
        if (drawingState.scrollContainer) {
            drawingState.scrollContainer.style.overflow = drawingState.active ? "hidden" : ""
            drawingState.scrollContainer.style.touchAction = drawingState.active ? "none" : ""
        }
        drawingState.isDrawing = false
        drawingState.pointerId = null
        if (!drawingState.active) {
            const snapshot = getDrawingData()
            if (snapshot !== lastDrawingSnapshot) {
                lastDrawingSnapshot = snapshot
                onDrawingChange(snapshot)
            }
        }
        updateEditableState()
        buildToolbar()
    }

    const cleanup = () => {
        drawingState.active = false
        drawingState.isDrawing = false
        drawingState.pointerId = null
        if (drawingState.canvas) drawingState.canvas.style.pointerEvents = "none"
        if (drawingState.scrollContainer) {
            drawingState.scrollContainer.style.overflow = ""
            drawingState.scrollContainer.style.touchAction = ""
        }
        detachObservers()
        if (drawingState.scrollFrame) cancelAnimationFrame(drawingState.scrollFrame)
        drawingState.scrollFrame = null
        hidePointerPreview()
        if (drawingState.layoutFrame) cancelAnimationFrame(drawingState.layoutFrame)
        drawingState.layoutFrame = null
        if (drawingState.pointerPreview) {
            drawingState.pointerPreview.remove()
            drawingState.pointerPreview = null
        }
        replaceDrawingHistory("")
    }

    const startDrawing = (event) => {
        if (!drawingState.active || !drawingState.ctx) return
        event.preventDefault()
        drawingState.canvas?.setPointerCapture?.(event.pointerId)
        const point = getCanvasPoint(event)
        if (!point) return
        drawingState.isDrawing = true
        drawingState.pointerId = event.pointerId
        applyToolStyle()
        drawingState.ctx.beginPath()
        drawingState.ctx.moveTo(point.x, point.y)
        movePointerPreview(event)
    }

    const drawLine = (event) => {
        if (!drawingState.isDrawing || !drawingState.ctx) return
        if (drawingState.pointerId !== event.pointerId) return
        event.preventDefault()
        const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event]
        events.forEach(pointerEvent => {
            const point = getCanvasPoint(pointerEvent)
            if (!point) return
            drawingState.ctx.lineTo(point.x, point.y)
        })
        drawingState.ctx.stroke()
        movePointerPreview(event)
    }

    const endDrawing = (event) => {
        if (!drawingState.isDrawing || !drawingState.ctx) return
        if (event && drawingState.pointerId !== event.pointerId) return
        event?.preventDefault()
        drawingState.isDrawing = false
        drawingState.pointerId = null
        const snapshot = getDrawingData()
        lastDrawingSnapshot = snapshot
        pushDrawingHistory(snapshot)
        onDrawingChange(snapshot)
    }

    return {
        configure,
        state: drawingState,
        setupControls,
        refreshDrawingSurface,
        setActivePage,
        getDrawingData,
        getDrawingSnapshot,
        setDrawingData,
        toggleDrawingMode,
        cleanup
    }
})()
