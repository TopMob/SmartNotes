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
