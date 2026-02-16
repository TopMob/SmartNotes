const EditorDrawing = (() => {
    const drawingState = {
        active: false,
        color: "#111111",
        size: 3,
        tool: "pen",
        canvas: null,
        ctx: null,
        pageElement: null,
        container: null,
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

    const updateMirrorState = () => {
        if (!engine) return
        const engineState = engine.getState()
        drawingState.canvas = engineState.canvasElement || null
        drawingState.ctx = engineState.canvasContext || null
        drawingState.pointerPreview = engineState.pointerPreviewElement || null
        drawingState.isDrawing = engineState.isPointerDown
        drawingState.pointerId = engineState.pointerIdentifier
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
        })

        engine.setHost(drawingState.container, drawingState.pageElement, drawingState.scrollContainer)
        engine.setTool(drawingState.tool)
        engine.setColor(drawingState.color)
        engine.setSize(drawingState.size)
        engine.setActive(drawingState.active)
        updateMirrorState()
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
                const nextSize = Number(event.target.value)
                drawingState.size = Number.isFinite(nextSize) ? Utils.clamp(nextSize, 1, 28) : 3
                engine?.setSize(drawingState.size)
                engine?.updatePointerPreviewStyle()
            })
        }

        if (elements.drawingControls) {
            elements.drawingControls.querySelectorAll("[data-drawing-tool]").forEach((buttonElement) => {
                const tool = buttonElement.dataset.drawingTool || "pen"
                if (!supportedTools.has(tool)) {
                    buttonElement.disabled = true
                    buttonElement.setAttribute("aria-disabled", "true")
                    return
                }
                buttonElement.addEventListener("click", () => setDrawingTool(tool))
            })

            elements.drawingControls.querySelectorAll("[data-drawing-color]").forEach((buttonElement) => {
                buttonElement.addEventListener("click", () => setDrawingColor(buttonElement.dataset.drawingColor || "#111111"))
            })

            if (typeof ColorPalette !== "undefined") ColorPalette.init(elements.drawingControls)
        }

        window.addEventListener("resize", () => engine?.refreshLayout())
        updateDrawingToolButtons()
        updateDrawingColorButtons()
    }

    const updateDrawingToolButtons = () => {
        const buttonElements = elements.drawingControls?.querySelectorAll("[data-drawing-tool]") || []
        buttonElements.forEach((buttonElement) => {
            buttonElement.classList.toggle("is-active", buttonElement.dataset.drawingTool === drawingState.tool)
        })
    }

    const updateDrawingColorButtons = () => {
        const activeColor = String(drawingState.color || "").toLowerCase()
        const colorButtons = elements.drawingControls?.querySelectorAll("[data-drawing-color]") || []
        colorButtons.forEach((buttonElement) => {
            const colorValue = String(buttonElement.dataset.drawingColor || "").toLowerCase()
            buttonElement.classList.toggle("is-active", colorValue === activeColor)
        })
    }

    const setDrawingTool = (tool) => {
        if (!supportedTools.has(tool)) return
        drawingState.tool = tool
        engine?.setTool(tool)
        engine?.updatePointerPreviewStyle()
        updateDrawingToolButtons()
    }

    const setDrawingColor = (color) => {
        if (!color) return
        drawingState.color = color
        if (elements.drawingColor) elements.drawingColor.value = color
        if (typeof ColorPalette !== "undefined" && elements.drawingColor) ColorPalette.syncInput(elements.drawingColor)
        engine?.setColor(color)
        updateDrawingColorButtons()
    }

    const refreshDrawingSurface = () => {
        engine?.setHost(drawingState.container, drawingState.pageElement, drawingState.scrollContainer)
        engine?.refreshLayout()
        updateMirrorState()
    }

    const setActivePage = (pageElement) => {
        drawingState.pageElement = pageElement || null
        engine?.setHost(drawingState.container, drawingState.pageElement, drawingState.scrollContainer)
        engine?.refreshLayout()
        updateMirrorState()
    }

    const getDrawingData = () => {
        if (!engine) return ""
        return engine.buildSnapshot()
    }

    const getDrawingSnapshot = () => {
        if (!engine) return ""
        return engine.getSnapshot()
    }

    const setDrawingData = (dataUrl, options = {}) => {
        const normalizedSnapshot = typeof dataUrl === "string" ? dataUrl : ""
        const shouldResetHistory = options.replaceHistory !== false
        refreshDrawingSurface()
        engine?.setSnapshot(normalizedSnapshot, { resetHistory: shouldResetHistory })
    }

    const toggleDrawingMode = () => {
        drawingState.active = !drawingState.active
        if (elements.drawingControls) {
            elements.drawingControls.classList.toggle("hidden", !drawingState.active)
        }
        engine?.setActive(drawingState.active)
        if (!drawingState.active) {
            const snapshot = engine?.buildSnapshot() || ""
            onDrawingChange(snapshot)
        }
        updateEditableState()
        buildToolbar()
        updateMirrorState()
    }

    const undo = async () => {
        if (!drawingState.active || !engine) return false
        await engine.undoStroke()
        return true
    }

    const redo = async () => {
        if (!drawingState.active || !engine) return false
        await engine.redoStroke()
        return true
    }

    const cleanup = () => {
        drawingState.active = false
        drawingState.isDrawing = false
        drawingState.pointerId = null
        if (elements.drawingControls) elements.drawingControls.classList.add("hidden")
        engine?.setActive(false)
        engine?.setSnapshot("", { resetHistory: true })
        engine?.hidePointerPreview()
        updateMirrorState()
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
        undo,
        redo,
        cleanup
    }
})()
