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
        resizeObserver: null,
        mutationObserver: null,
        scrollFrame: null,
        layoutFrame: null
    }
    let elements = {}
    let buildToolbar = () => {}
    let updateEditableState = () => {}

    const configure = ({ elements: nextElements, buildToolbar: nextBuildToolbar, updateEditableState: nextUpdateEditableState } = {}) => {
        elements = nextElements || {}
        if (typeof nextBuildToolbar === "function") buildToolbar = nextBuildToolbar
        if (typeof nextUpdateEditableState === "function") updateEditableState = nextUpdateEditableState
        drawingState.container = elements.contentWrapper || null
        drawingState.content = elements.content || null
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
            if (window.ColorPalette) window.ColorPalette.init(elements.drawingControls)
        }
        updateDrawingToolButtons()
        updateDrawingColorButtons()
        window.addEventListener("resize", () => scheduleLayoutSync())
    }

    const isSupportedTool = (tool) => ["pen", "marker", "eraser"].includes(tool)

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
        updateDrawingToolButtons()
    }

    const setDrawingColor = (color) => {
        if (!color) return
        drawingState.color = color
        if (elements.drawingColor) elements.drawingColor.value = color
        if (window.ColorPalette && elements.drawingColor) window.ColorPalette.syncInput(elements.drawingColor)
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
        canvas.addEventListener("pointerup", endDrawing)
        canvas.addEventListener("pointercancel", endDrawing)
        drawingState.container.appendChild(canvas)
        drawingState.canvas = canvas
        drawingState.ctx = canvas.getContext("2d")
        attachObservers()
        scheduleLayoutSync()
        return canvas
    }

    const attachObservers = () => {
        if (!drawingState.content) return
        if (drawingState.resizeObserver) drawingState.resizeObserver.disconnect()
        drawingState.resizeObserver = null
        if (drawingState.mutationObserver) drawingState.mutationObserver.disconnect()
        drawingState.mutationObserver = null
        if (typeof ResizeObserver !== "undefined") {
            drawingState.resizeObserver = new ResizeObserver(() => scheduleLayoutSync())
            drawingState.resizeObserver.observe(drawingState.content)
        }
        drawingState.mutationObserver = new MutationObserver(() => scheduleLayoutSync())
        drawingState.mutationObserver.observe(drawingState.content, { childList: true, subtree: true, characterData: true })
        drawingState.content.addEventListener("scroll", scheduleScrollSync, { passive: true })
    }

    const detachObservers = () => {
        if (drawingState.resizeObserver) drawingState.resizeObserver.disconnect()
        drawingState.resizeObserver = null
        if (drawingState.mutationObserver) drawingState.mutationObserver.disconnect()
        drawingState.mutationObserver = null
        drawingState.content?.removeEventListener("scroll", scheduleScrollSync)
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
        if (!drawingState.canvas || !drawingState.content) return
        const top = drawingState.content.offsetTop - drawingState.content.scrollTop
        const left = drawingState.content.offsetLeft
        drawingState.canvas.style.top = `${top}px`
        drawingState.canvas.style.left = `${left}px`
    }

    const syncCanvasLayout = () => {
        if (!drawingState.canvas || !drawingState.ctx || !drawingState.content) return
        const cssWidth = Math.max(1, Math.floor(drawingState.content.clientWidth))
        const cssHeight = Math.max(1, Math.floor(drawingState.content.scrollHeight))
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

    const getCanvasPoint = (event) => {
        if (!drawingState.canvas) return null
        const rect = drawingState.canvas.getBoundingClientRect()
        const x = Utils.clamp(event.clientX - rect.left, 0, rect.width)
        const y = Utils.clamp(event.clientY - rect.top, 0, rect.height)
        return { x, y }
    }

    const applyToolStyle = () => {
        if (!drawingState.ctx) return
        if (drawingState.tool === "marker") {
            drawingState.ctx.globalCompositeOperation = "source-over"
            drawingState.ctx.globalAlpha = 0.6
            drawingState.ctx.strokeStyle = drawingState.color
        } else if (drawingState.tool === "eraser") {
            drawingState.ctx.globalCompositeOperation = "destination-out"
            drawingState.ctx.globalAlpha = 1
            drawingState.ctx.strokeStyle = "#000000"
        } else {
            drawingState.ctx.globalCompositeOperation = "source-over"
            drawingState.ctx.globalAlpha = 1
            drawingState.ctx.strokeStyle = drawingState.color
        }
        drawingState.ctx.lineWidth = drawingState.size
        drawingState.ctx.lineCap = "round"
        drawingState.ctx.lineJoin = "round"
    }

    const refreshDrawingSurface = () => {
        ensureCanvas()
        scheduleLayoutSync()
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
        drawingState.isDrawing = false
        drawingState.pointerId = null
        updateEditableState()
        buildToolbar()
    }

    const cleanup = () => {
        drawingState.active = false
        drawingState.isDrawing = false
        drawingState.pointerId = null
        if (drawingState.canvas) drawingState.canvas.style.pointerEvents = "none"
        detachObservers()
        if (drawingState.scrollFrame) cancelAnimationFrame(drawingState.scrollFrame)
        drawingState.scrollFrame = null
        if (drawingState.layoutFrame) cancelAnimationFrame(drawingState.layoutFrame)
        drawingState.layoutFrame = null
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
    }

    const endDrawing = (event) => {
        if (!drawingState.isDrawing || !drawingState.ctx) return
        if (event && drawingState.pointerId !== event.pointerId) return
        event?.preventDefault()
        drawingState.isDrawing = false
        drawingState.pointerId = null
    }

    return {
        configure,
        state: drawingState,
        setupControls,
        refreshDrawingSurface,
        toggleDrawingMode,
        cleanup
    }
})()

window.EditorDrawing = EditorDrawing
