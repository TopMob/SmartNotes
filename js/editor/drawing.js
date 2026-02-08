const EditorDrawing = (() => {
    const drawingState = {
        active: false,
        color: "#111111",
        size: 3,
        tool: "pen",
        isDrawing: false,
        lastPoint: null,
        pointerId: null,
        pendingPoints: [],
        drawFrame: null,
        canvas: null,
        ctx: null,
        image: null,
        scale: 1,
        resizeObserver: null,
        resizeFrame: null
    }
    let elements = {}
    let getPages = () => []
    let getActivePage = () => null
    let buildToolbar = () => {}
    let updateEditableState = () => {}

    const configure = ({ elements: nextElements, getPages: nextGetPages, getActivePage: nextGetActivePage, buildToolbar: nextBuildToolbar, updateEditableState: nextUpdateEditableState } = {}) => {
        elements = nextElements || {}
        if (typeof nextGetPages === "function") getPages = nextGetPages
        if (typeof nextGetActivePage === "function") getActivePage = nextGetActivePage
        if (typeof nextBuildToolbar === "function") buildToolbar = nextBuildToolbar
        if (typeof nextUpdateEditableState === "function") updateEditableState = nextUpdateEditableState
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
                drawingState.size = Number.isFinite(next) ? Utils.clamp(next, 1, 24) : 3
            })
        }
        if (elements.drawingControls) {
            elements.drawingControls.querySelectorAll("[data-drawing-tool]").forEach(btn => {
                btn.addEventListener("click", () => setDrawingTool(btn.dataset.drawingTool || "pen"))
            })
            elements.drawingControls.querySelectorAll("[data-drawing-color]").forEach(btn => {
                btn.addEventListener("click", () => setDrawingColor(btn.dataset.drawingColor || "#111111"))
            })
            if (window.ColorPalette) window.ColorPalette.init(elements.drawingControls)
        }
        updateDrawingToolButtons()
        updateDrawingColorButtons()
        window.addEventListener("resize", () => {
            if (drawingState.active) refreshDrawingSurface()
        })
    }

    const getDrawingToolSettings = () => {
        if (drawingState.tool === "eraser") {
            return { composite: "destination-out", opacity: 1, color: "#000000" }
        }
        if (drawingState.tool === "marker") {
            return { composite: "source-over", opacity: 0.4, color: drawingState.color }
        }
        return { composite: "source-over", opacity: 1, color: drawingState.color }
    }

    const updateDrawingToolButtons = () => {
        const toolButtons = elements.drawingControls?.querySelectorAll("[data-drawing-tool]") || []
        toolButtons.forEach(btn => {
            btn.classList.toggle("is-active", btn.dataset.drawingTool === drawingState.tool)
        })
        const isEraser = drawingState.tool === "eraser"
        if (elements.drawingColor) elements.drawingColor.disabled = isEraser
        const colorButtons = elements.drawingControls?.querySelectorAll("[data-drawing-color]") || []
        colorButtons.forEach(btn => {
            btn.disabled = isEraser
        })
        const colorPicker = elements.drawingControls?.querySelector("[data-color-picker]")
        if (colorPicker) {
            colorPicker.classList.toggle("is-disabled", isEraser)
            colorPicker.setAttribute("aria-disabled", String(isEraser))
        }
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
        const nextTool = tool === "marker" || tool === "eraser" ? tool : "pen"
        drawingState.tool = nextTool
        updateDrawingToolButtons()
    }

    const setDrawingColor = (color) => {
        if (!color) return
        drawingState.color = color
        if (elements.drawingColor) elements.drawingColor.value = color
        if (window.ColorPalette && elements.drawingColor) window.ColorPalette.syncInput(elements.drawingColor)
        updateDrawingColorButtons()
    }

    const applyCanvasScale = (scale) => {
        if (!drawingState.ctx) return
        drawingState.scale = scale
        drawingState.ctx.setTransform(scale, 0, 0, scale, 0, 0)
    }

    const getCanvasPoint = (event) => {
        if (!drawingState.canvas) return null
        const rect = drawingState.canvas.getBoundingClientRect()
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        }
    }

    const applyDrawingToolToContext = () => {
        if (!drawingState.ctx) return
        const tool = getDrawingToolSettings()
        drawingState.ctx.globalCompositeOperation = tool.composite
        drawingState.ctx.globalAlpha = tool.opacity
        drawingState.ctx.strokeStyle = tool.color
        drawingState.ctx.lineWidth = drawingState.size
        drawingState.ctx.lineCap = "round"
        drawingState.ctx.lineJoin = "round"
    }

    const drawPendingPoints = () => {
        if (!drawingState.ctx || !drawingState.isDrawing || !drawingState.lastPoint) return
        if (!drawingState.pendingPoints.length) return
        drawingState.ctx.beginPath()
        drawingState.ctx.moveTo(drawingState.lastPoint.x, drawingState.lastPoint.y)
        drawingState.pendingPoints.forEach(point => {
            const samePoint = point.x === drawingState.lastPoint.x && point.y === drawingState.lastPoint.y
            const targetX = samePoint ? point.x + 0.01 : point.x
            const targetY = samePoint ? point.y + 0.01 : point.y
            drawingState.ctx.lineTo(targetX, targetY)
            drawingState.lastPoint = point
        })
        drawingState.pendingPoints = []
        drawingState.ctx.stroke()
    }

    const scheduleDraw = () => {
        if (!drawingState.active) return
        if (drawingState.drawFrame) return
        drawingState.drawFrame = requestAnimationFrame(() => {
            drawingState.drawFrame = null
            drawPendingPoints()
        })
    }

    const scheduleDrawingRefresh = () => {
        if (!drawingState.active) return
        if (drawingState.resizeFrame) return
        drawingState.resizeFrame = requestAnimationFrame(() => {
            drawingState.resizeFrame = null
            refreshDrawingSurface()
        })
    }

    const observeDrawingPage = (page) => {
        if (drawingState.resizeObserver) drawingState.resizeObserver.disconnect()
        drawingState.resizeObserver = null
        if (!page || typeof ResizeObserver === "undefined") return
        drawingState.resizeObserver = new ResizeObserver(() => scheduleDrawingRefresh())
        drawingState.resizeObserver.observe(page)
        if (elements.content) drawingState.resizeObserver.observe(elements.content)
    }

    const ensureDrawingLayer = () => {
        const page = getActivePage()
        if (!page) return null
        let layer = page.querySelector(".note-drawing-layer")
        let image = layer ? layer.querySelector(".note-drawing-image") : null
        if (!layer) {
            layer = document.createElement("div")
            layer.className = "note-drawing-layer"
            layer.setAttribute("contenteditable", "false")
            image = document.createElement("img")
            image.className = "note-drawing-image"
            image.alt = ""
            image.draggable = false
            layer.appendChild(image)
            page.prepend(layer)
        }
        drawingState.image = image
        return { page, layer, image }
    }

    const ensureDrawingCanvas = () => {
        if (!drawingState.canvas) {
            const canvas = document.createElement("canvas")
            canvas.className = "note-drawing-canvas"
            canvas.setAttribute("aria-hidden", "true")
            canvas.tabIndex = -1
            canvas.addEventListener("pointerdown", startDrawing)
            canvas.addEventListener("pointermove", drawLine)
            canvas.addEventListener("pointerup", endDrawing)
            canvas.addEventListener("pointerleave", endDrawing)
            canvas.addEventListener("pointercancel", endDrawing)
            drawingState.canvas = canvas
            drawingState.ctx = canvas.getContext("2d")
        }
        return drawingState.canvas
    }

    const updateDrawingCanvasSize = (page) => {
        if (!drawingState.canvas || !drawingState.ctx || !page) return
        const rect = page.getBoundingClientRect()
        const cssWidth = Math.max(1, Math.floor(rect.width))
        const cssHeight = Math.max(1, Math.floor(Math.max(rect.height, page.scrollHeight)))
        const scale = window.devicePixelRatio || 1
        const width = Math.max(1, Math.floor(cssWidth * scale))
        const height = Math.max(1, Math.floor(cssHeight * scale))
        if (drawingState.canvas.width === width && drawingState.canvas.height === height && drawingState.scale === scale) return
        const snapshot = drawingState.canvas.toDataURL("image/png")
        drawingState.canvas.width = width
        drawingState.canvas.height = height
        drawingState.canvas.style.width = `${cssWidth}px`
        drawingState.canvas.style.height = `${cssHeight}px`
        drawingState.ctx.setTransform(1, 0, 0, 1, 0, 0)
        if (snapshot) {
            const image = new Image()
            image.onload = () => {
                drawingState.ctx.clearRect(0, 0, width, height)
                drawingState.ctx.drawImage(image, 0, 0, width, height)
                applyCanvasScale(scale)
            }
            image.src = snapshot
        } else {
            applyCanvasScale(scale)
        }
    }

    const syncCanvasFromImage = () => {
        if (!drawingState.ctx || !drawingState.canvas || !drawingState.image) return
        const src = drawingState.image.getAttribute("src")
        drawingState.ctx.setTransform(1, 0, 0, 1, 0, 0)
        drawingState.ctx.clearRect(0, 0, drawingState.canvas.width, drawingState.canvas.height)
        if (!src) {
            applyCanvasScale(drawingState.scale)
            return
        }
        const image = new Image()
        image.onload = () => {
            drawingState.ctx.drawImage(image, 0, 0, drawingState.canvas.width, drawingState.canvas.height)
            applyCanvasScale(drawingState.scale)
        }
        image.src = src
    }

    const canvasHasDrawing = () => {
        if (!drawingState.ctx || !drawingState.canvas) return false
        const { width, height } = drawingState.canvas
        if (!width || !height) return false
        const data = drawingState.ctx.getImageData(0, 0, width, height).data
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) return true
        }
        return false
    }

    const removeDrawingLayerIfEmpty = () => {
        const page = getActivePage()
        if (!page) return
        const layer = page.querySelector(".note-drawing-layer")
        if (!layer) return
        const image = layer.querySelector(".note-drawing-image")
        const hasImage = !!image?.getAttribute("src")
        if (!hasImage) {
            layer.remove()
            drawingState.image = null
        }
    }

    const updateImageFromCanvas = () => {
        if (!drawingState.image || !drawingState.canvas) return
        if (!canvasHasDrawing()) {
            drawingState.image.removeAttribute("src")
            return
        }
        drawingState.image.src = drawingState.canvas.toDataURL("image/png")
    }

    const refreshDrawingSurface = () => {
        const data = ensureDrawingLayer()
        if (!data) return
        const canvas = ensureDrawingCanvas()
        if (!canvas.parentElement) data.page.appendChild(canvas)
        updateDrawingCanvasSize(data.page)
        syncCanvasFromImage()
        observeDrawingPage(data.page)
    }

    const toggleDrawingMode = () => {
        drawingState.active = !drawingState.active
        if (elements.drawingControls) {
            elements.drawingControls.classList.toggle("hidden", !drawingState.active)
        }
        if (drawingState.active) {
            refreshDrawingSurface()
        } else {
            updateImageFromCanvas()
            if (drawingState.canvas?.parentElement) {
                drawingState.canvas.parentElement.removeChild(drawingState.canvas)
            }
            drawingState.isDrawing = false
            drawingState.lastPoint = null
            drawingState.pointerId = null
            drawingState.pendingPoints = []
            if (drawingState.drawFrame) cancelAnimationFrame(drawingState.drawFrame)
            drawingState.drawFrame = null
            if (drawingState.resizeObserver) drawingState.resizeObserver.disconnect()
            drawingState.resizeObserver = null
            if (drawingState.resizeFrame) cancelAnimationFrame(drawingState.resizeFrame)
            drawingState.resizeFrame = null
            removeDrawingLayerIfEmpty()
        }
        updateEditableState()
        buildToolbar()
    }

    const startDrawing = (event) => {
        if (!drawingState.active || !drawingState.ctx || !drawingState.canvas) return
        event.preventDefault()
        event.stopPropagation()
        drawingState.canvas.setPointerCapture?.(event.pointerId)
        const point = getCanvasPoint(event)
        if (!point) return
        drawingState.isDrawing = true
        drawingState.pointerId = event.pointerId
        drawingState.lastPoint = point
        drawingState.pendingPoints = [point]
        applyDrawingToolToContext()
        scheduleDraw()
    }

    const drawLine = (event) => {
        if (!drawingState.isDrawing || !drawingState.ctx || !drawingState.lastPoint || !drawingState.canvas) return
        if (drawingState.pointerId !== event.pointerId) return
        event.preventDefault()
        const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event]
        events.forEach(pointerEvent => {
            const point = getCanvasPoint(pointerEvent)
            if (!point) return
            drawingState.pendingPoints.push(point)
        })
        scheduleDraw()
    }

    const endDrawing = (event) => {
        if (event) event.preventDefault()
        if (!drawingState.isDrawing) return
        if (event && drawingState.pointerId !== event.pointerId) return
        drawPendingPoints()
        drawingState.isDrawing = false
        drawingState.lastPoint = null
        drawingState.pointerId = null
        drawingState.pendingPoints = []
        updateImageFromCanvas()
    }

    return {
        configure,
        state: drawingState,
        setupControls,
        refreshDrawingSurface,
        updateImageFromCanvas,
        removeDrawingLayerIfEmpty,
        toggleDrawingMode
    }
})()

window.EditorDrawing = EditorDrawing
