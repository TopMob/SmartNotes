const EditorDrawing = (() => {
    const drawingState = {
        active: false,
        color: "#111111",
        size: 3,
        tool: "pen",
        isDrawing: false,
        pointerId: null,
        lastPoint: null,
        canvas: null,
        ctx: null,
        image: null,
        scale: 1,
        resizeObserver: null,
        mutationObserver: null,
        refreshFrame: null
    }
    let elements = {}
    let buildToolbar = () => {}
    let updateEditableState = () => {}
    let getDrawingContainer = () => null

    const configure = ({ elements: nextElements, buildToolbar: nextBuildToolbar, updateEditableState: nextUpdateEditableState } = {}) => {
        elements = nextElements || {}
        if (typeof nextBuildToolbar === "function") buildToolbar = nextBuildToolbar
        if (typeof nextUpdateEditableState === "function") updateEditableState = nextUpdateEditableState
        getDrawingContainer = () => elements.content || null
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
                const tool = btn.dataset.drawingTool || "pen"
                if (tool === "pen") {
                    btn.addEventListener("click", () => setDrawingTool("pen"))
                } else {
                    btn.disabled = true
                    btn.setAttribute("aria-disabled", "true")
                }
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

    const updateDrawingToolButtons = () => {
        const toolButtons = elements.drawingControls?.querySelectorAll("[data-drawing-tool]") || []
        toolButtons.forEach(btn => {
            btn.classList.toggle("is-active", btn.dataset.drawingTool === drawingState.tool)
            if (btn.dataset.drawingTool !== "pen") {
                btn.disabled = true
                btn.setAttribute("aria-disabled", "true")
            }
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
        drawingState.tool = tool === "pen" ? "pen" : "pen"
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
        const maxX = drawingState.canvas.width / drawingState.scale
        const maxY = drawingState.canvas.height / drawingState.scale
        const x = Utils.clamp(event.clientX - rect.left, 0, maxX)
        const y = Utils.clamp(event.clientY - rect.top, 0, maxY)
        return { x, y }
    }

    const applyPenStyle = () => {
        if (!drawingState.ctx) return
        drawingState.ctx.globalCompositeOperation = "source-over"
        drawingState.ctx.globalAlpha = 1
        drawingState.ctx.strokeStyle = drawingState.color
        drawingState.ctx.lineWidth = drawingState.size
        drawingState.ctx.lineCap = "round"
        drawingState.ctx.lineJoin = "round"
    }

    const drawSegment = (point) => {
        if (!drawingState.ctx || !drawingState.lastPoint) return
        drawingState.ctx.beginPath()
        drawingState.ctx.moveTo(drawingState.lastPoint.x, drawingState.lastPoint.y)
        drawingState.ctx.lineTo(point.x, point.y)
        drawingState.ctx.stroke()
        drawingState.lastPoint = point
    }

    const ensureDrawingLayer = () => {
        const container = getDrawingContainer()
        if (!container) return null
        let layer = container.querySelector(".note-drawing-layer")
        let image = layer ? layer.querySelector(".note-drawing-image") : null
        if (!layer) {
            layer = document.createElement("div")
            layer.className = "note-drawing-layer"
            layer.setAttribute("contenteditable", "false")
            container.appendChild(layer)
        }
        if (!image) {
            image = document.createElement("img")
            image.className = "note-drawing-image"
            image.alt = ""
            image.draggable = false
            layer.appendChild(image)
        }
        drawingState.image = image
        return { container, layer, image }
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

    const updateDrawingCanvasSize = (container) => {
        if (!drawingState.canvas || !drawingState.ctx || !container) return
        const rect = container.getBoundingClientRect()
        const cssWidth = Math.max(1, Math.floor(rect.width))
        const cssHeight = Math.max(1, Math.floor(container.scrollHeight))
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
            drawingState.ctx.clearRect(0, 0, width, height)
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
        const container = getDrawingContainer()
        if (!container) return
        const layer = container.querySelector(".note-drawing-layer")
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

    const scheduleRefresh = () => {
        if (!drawingState.active) return
        if (drawingState.refreshFrame) return
        drawingState.refreshFrame = requestAnimationFrame(() => {
            drawingState.refreshFrame = null
            refreshDrawingSurface()
        })
    }

    const observeDrawingContainer = (container) => {
        if (drawingState.resizeObserver) drawingState.resizeObserver.disconnect()
        drawingState.resizeObserver = null
        if (drawingState.mutationObserver) drawingState.mutationObserver.disconnect()
        drawingState.mutationObserver = null
        if (!container) return
        if (typeof ResizeObserver !== "undefined") {
            drawingState.resizeObserver = new ResizeObserver(() => scheduleRefresh())
            drawingState.resizeObserver.observe(container)
        }
        drawingState.mutationObserver = new MutationObserver(() => scheduleRefresh())
        drawingState.mutationObserver.observe(container, { childList: true, subtree: true, characterData: true })
    }

    const refreshDrawingSurface = () => {
        const data = ensureDrawingLayer()
        if (!data) return
        const canvas = ensureDrawingCanvas()
        if (!canvas.parentElement) data.container.appendChild(canvas)
        updateDrawingCanvasSize(data.container)
        syncCanvasFromImage()
        observeDrawingContainer(data.container)
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
            if (drawingState.resizeObserver) drawingState.resizeObserver.disconnect()
            drawingState.resizeObserver = null
            if (drawingState.mutationObserver) drawingState.mutationObserver.disconnect()
            drawingState.mutationObserver = null
            if (drawingState.refreshFrame) cancelAnimationFrame(drawingState.refreshFrame)
            drawingState.refreshFrame = null
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
        applyPenStyle()
        drawingState.ctx.beginPath()
        drawingState.ctx.moveTo(point.x, point.y)
        drawingState.ctx.lineTo(point.x + 0.01, point.y + 0.01)
        drawingState.ctx.stroke()
    }

    const drawLine = (event) => {
        if (!drawingState.isDrawing || !drawingState.ctx || !drawingState.lastPoint || !drawingState.canvas) return
        if (drawingState.pointerId !== event.pointerId) return
        event.preventDefault()
        const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event]
        events.forEach(pointerEvent => {
            const point = getCanvasPoint(pointerEvent)
            if (!point) return
            drawSegment(point)
        })
    }

    const endDrawing = (event) => {
        if (event) event.preventDefault()
        if (!drawingState.isDrawing) return
        if (event && drawingState.pointerId !== event.pointerId) return
        drawingState.isDrawing = false
        drawingState.lastPoint = null
        drawingState.pointerId = null
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
