const DrawingSurfaceEngine = (() => {
    const supportedTools = new Set(["pen", "marker", "eraser"])

    const createEngineState = () => ({
        containerElement: null,
        pageElement: null,
        scrollElement: null,
        canvasElement: null,
        canvasContext: null,
        pointerPreviewElement: null,
        pointerMovePreviewHandler: null,
        enabled: false,
        currentTool: "pen",
        currentColor: "#111111",
        currentSize: 3,
        activePointerIdentifier: null,
        isPointerDown: false,
        pixelRatio: 1,
        currentSnapshot: "",
        historyStack: [""],
        redoStack: [],
        layoutFrame: 0,
        scrollFrame: 0,
        loadToken: 0,
        onSnapshotChange: () => {},
        resizeObserver: null,
        mutationObserver: null,
        scrollSyncHandler: null
    })

    const createStrokeStyle = (tool, color, size) => {
        if (tool === "eraser") {
            return {
                compositeOperation: "destination-out",
                color: "#000000",
                alpha: 1,
                width: Math.max(12, size * 2)
            }
        }
        if (tool === "marker") {
            return {
                compositeOperation: "source-over",
                color,
                alpha: 0.4,
                width: Math.max(6, size * 2)
            }
        }
        return {
            compositeOperation: "source-over",
            color,
            alpha: 1,
            width: Math.max(1, size)
        }
    }

    const createEngine = () => {
        const state = createEngineState()

        const ensureCanvasElement = () => {
            if (!state.containerElement) return
            if (!state.canvasElement) {
                const canvasElement = document.createElement("canvas")
                canvasElement.className = "note-drawing-canvas"
                canvasElement.setAttribute("aria-hidden", "true")
                canvasElement.tabIndex = -1
                canvasElement.style.pointerEvents = "none"
                state.canvasElement = canvasElement
                state.canvasContext = canvasElement.getContext("2d")
                bindCanvasEvents()
            }
            if (state.canvasElement.parentElement !== state.containerElement) {
                state.containerElement.appendChild(state.canvasElement)
            }
        }

        const ensurePointerPreviewElement = () => {
            if (state.pointerPreviewElement) return
            const pointerPreviewElement = document.createElement("div")
            pointerPreviewElement.className = "drawing-pointer-preview"
            pointerPreviewElement.setAttribute("aria-hidden", "true")
            document.body.appendChild(pointerPreviewElement)
            state.pointerPreviewElement = pointerPreviewElement
        }

        const applyContextScale = () => {
            if (!state.canvasContext) return
            state.canvasContext.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0)
        }

        const clearCanvas = () => {
            if (!state.canvasElement || !state.canvasContext) return
            state.canvasContext.setTransform(1, 0, 0, 1, 0, 0)
            state.canvasContext.clearRect(0, 0, state.canvasElement.width, state.canvasElement.height)
            applyContextScale()
        }

        const getCanvasPoint = (pointerEvent) => {
            if (!state.canvasElement) return null
            const canvasRectangle = state.canvasElement.getBoundingClientRect()
            if (!canvasRectangle.width || !canvasRectangle.height) return null
            const x = Utils.clamp(pointerEvent.clientX - canvasRectangle.left, 0, canvasRectangle.width)
            const y = Utils.clamp(pointerEvent.clientY - canvasRectangle.top, 0, canvasRectangle.height)
            return { x, y }
        }

        const updatePointerPreviewStyle = () => {
            if (!state.pointerPreviewElement) return
            const strokeStyle = createStrokeStyle(state.currentTool, state.currentColor, state.currentSize)
            state.pointerPreviewElement.style.width = `${strokeStyle.width}px`
            state.pointerPreviewElement.style.height = `${strokeStyle.width}px`
            if (state.currentTool === "eraser") {
                state.pointerPreviewElement.style.borderColor = "rgba(248, 113, 113, 0.9)"
                state.pointerPreviewElement.style.background = "rgba(248, 113, 113, 0.2)"
                return
            }
            if (state.currentTool === "marker") {
                state.pointerPreviewElement.style.borderColor = "rgba(37, 99, 235, 0.9)"
                state.pointerPreviewElement.style.background = "rgba(37, 99, 235, 0.18)"
                return
            }
            state.pointerPreviewElement.style.borderColor = "rgba(59, 130, 246, 0.9)"
            state.pointerPreviewElement.style.background = "rgba(59, 130, 246, 0.16)"
        }

        const movePointerPreview = (pointerEvent) => {
            if (!state.enabled || !state.pointerPreviewElement || !state.canvasElement) return
            const canvasPoint = getCanvasPoint(pointerEvent)
            if (!canvasPoint) return
            const canvasRectangle = state.canvasElement.getBoundingClientRect()
            state.pointerPreviewElement.style.transform = `translate(${canvasRectangle.left + canvasPoint.x}px, ${canvasRectangle.top + canvasPoint.y}px) translate(-50%, -50%)`
            state.pointerPreviewElement.style.opacity = "1"
        }

        const hidePointerPreview = () => {
            if (!state.pointerPreviewElement) return
            state.pointerPreviewElement.style.opacity = "0"
        }

        const applyStrokeStyle = () => {
            if (!state.canvasContext) return
            const strokeStyle = createStrokeStyle(state.currentTool, state.currentColor, state.currentSize)
            state.canvasContext.globalCompositeOperation = strokeStyle.compositeOperation
            state.canvasContext.strokeStyle = strokeStyle.color
            state.canvasContext.globalAlpha = strokeStyle.alpha
            state.canvasContext.lineWidth = strokeStyle.width
            state.canvasContext.lineCap = "round"
            state.canvasContext.lineJoin = "round"
            updatePointerPreviewStyle()
        }

        const syncCanvasPosition = () => {
            if (!state.canvasElement || !state.pageElement) return
            state.canvasElement.style.top = `${state.pageElement.offsetTop}px`
            state.canvasElement.style.left = `${state.pageElement.offsetLeft}px`
        }

        const syncCanvasLayout = () => {
            if (!state.canvasElement || !state.canvasContext || !state.pageElement) return
            const cssWidth = Math.max(1, Math.floor(state.pageElement.clientWidth))
            const cssHeight = Math.max(1, Math.floor(state.pageElement.scrollHeight))
            const nextPixelRatio = window.devicePixelRatio || 1
            const pixelWidth = Math.max(1, Math.floor(cssWidth * nextPixelRatio))
            const pixelHeight = Math.max(1, Math.floor(cssHeight * nextPixelRatio))
            const hasSizeChange = state.canvasElement.width !== pixelWidth || state.canvasElement.height !== pixelHeight || state.pixelRatio !== nextPixelRatio
            if (hasSizeChange) {
                const previousCanvas = document.createElement("canvas")
                previousCanvas.width = state.canvasElement.width
                previousCanvas.height = state.canvasElement.height
                const previousContext = previousCanvas.getContext("2d")
                if (previousContext && previousCanvas.width && previousCanvas.height) {
                    previousContext.drawImage(state.canvasElement, 0, 0)
                }
                state.canvasElement.width = pixelWidth
                state.canvasElement.height = pixelHeight
                state.pixelRatio = nextPixelRatio
                state.canvasElement.style.width = `${cssWidth}px`
                state.canvasElement.style.height = `${cssHeight}px`
                applyContextScale()
                if (previousCanvas.width && previousCanvas.height) {
                    state.canvasContext.setTransform(1, 0, 0, 1, 0, 0)
                    state.canvasContext.drawImage(previousCanvas, 0, 0, previousCanvas.width, previousCanvas.height, 0, 0, pixelWidth, pixelHeight)
                    applyContextScale()
                }
            } else {
                state.canvasElement.style.width = `${cssWidth}px`
                state.canvasElement.style.height = `${cssHeight}px`
            }
            syncCanvasPosition()
        }

        const scheduleLayoutSync = () => {
            if (state.layoutFrame) return
            state.layoutFrame = requestAnimationFrame(() => {
                state.layoutFrame = 0
                syncCanvasLayout()
            })
        }

        const scheduleScrollSync = () => {
            if (state.scrollFrame) return
            state.scrollFrame = requestAnimationFrame(() => {
                state.scrollFrame = 0
                syncCanvasPosition()
            })
        }

        const buildSnapshotFromCanvas = () => {
            if (!state.canvasElement || !state.canvasContext) return ""
            const sourceWidth = state.canvasElement.width
            const sourceHeight = state.canvasElement.height
            if (!sourceWidth || !sourceHeight) return ""
            const imageData = state.canvasContext.getImageData(0, 0, sourceWidth, sourceHeight).data
            let hasVisiblePixels = false
            for (let pixelIndex = 3; pixelIndex < imageData.length; pixelIndex += 4) {
                if (imageData[pixelIndex] !== 0) {
                    hasVisiblePixels = true
                    break
                }
            }
            if (!hasVisiblePixels) return ""
            let snapshot = state.canvasElement.toDataURL("image/webp", 0.82)
            if (!snapshot.startsWith("data:image/webp")) snapshot = state.canvasElement.toDataURL("image/png")
            return snapshot
        }

        const pushHistorySnapshot = (snapshot) => {
            const normalizedSnapshot = typeof snapshot === "string" ? snapshot : ""
            const currentHistorySnapshot = state.historyStack[state.historyStack.length - 1] || ""
            if (currentHistorySnapshot === normalizedSnapshot) return
            state.historyStack.push(normalizedSnapshot)
            if (state.historyStack.length > 120) state.historyStack.shift()
            state.redoStack = []
        }

        const drawSnapshotOnCanvas = (snapshot) => {
            const normalizedSnapshot = typeof snapshot === "string" ? snapshot : ""
            state.currentSnapshot = normalizedSnapshot
            state.loadToken += 1
            const drawToken = state.loadToken
            if (!normalizedSnapshot) {
                clearCanvas()
                return Promise.resolve("")
            }
            return new Promise((resolve) => {
                const imageElement = new Image()
                imageElement.onload = () => {
                    if (drawToken !== state.loadToken || !state.canvasElement || !state.canvasContext) {
                        resolve(state.currentSnapshot)
                        return
                    }
                    state.canvasContext.setTransform(1, 0, 0, 1, 0, 0)
                    state.canvasContext.clearRect(0, 0, state.canvasElement.width, state.canvasElement.height)
                    const targetWidth = Math.min(imageElement.naturalWidth || imageElement.width, state.canvasElement.width)
                    const targetHeight = Math.min(imageElement.naturalHeight || imageElement.height, state.canvasElement.height)
                    state.canvasContext.drawImage(imageElement, 0, 0, targetWidth, targetHeight)
                    applyContextScale()
                    resolve(state.currentSnapshot)
                }
                imageElement.onerror = () => {
                    if (drawToken === state.loadToken) {
                        state.currentSnapshot = ""
                        clearCanvas()
                    }
                    resolve(state.currentSnapshot)
                }
                imageElement.src = normalizedSnapshot
            })
        }

        const setInteractionState = () => {
            if (state.canvasElement) {
                state.canvasElement.style.pointerEvents = state.enabled ? "auto" : "none"
            }
            if (state.scrollElement) {
                state.scrollElement.style.overflow = state.enabled ? "hidden" : ""
                state.scrollElement.style.touchAction = state.enabled ? "none" : ""
            }
        }

        const startStroke = (pointerEvent) => {
            if (!state.enabled || !state.canvasContext || !state.canvasElement) return
            pointerEvent.preventDefault()
            state.canvasElement.setPointerCapture?.(pointerEvent.pointerId)
            const point = getCanvasPoint(pointerEvent)
            if (!point) return
            state.activePointerIdentifier = pointerEvent.pointerId
            state.isPointerDown = true
            applyStrokeStyle()
            state.canvasContext.beginPath()
            state.canvasContext.moveTo(point.x, point.y)
            movePointerPreview(pointerEvent)
        }

        const continueStroke = (pointerEvent) => {
            if (!state.enabled || !state.canvasContext || !state.isPointerDown) return
            if (state.activePointerIdentifier !== pointerEvent.pointerId) return
            pointerEvent.preventDefault()
            const pointerEvents = typeof pointerEvent.getCoalescedEvents === "function" ? pointerEvent.getCoalescedEvents() : [pointerEvent]
            pointerEvents.forEach((eventItem) => {
                const point = getCanvasPoint(eventItem)
                if (!point) return
                state.canvasContext.lineTo(point.x, point.y)
            })
            state.canvasContext.stroke()
            movePointerPreview(pointerEvent)
        }

        const finishStroke = (pointerEvent) => {
            if (!state.isPointerDown || !state.canvasContext) return
            if (pointerEvent && state.activePointerIdentifier !== pointerEvent.pointerId) return
            pointerEvent?.preventDefault()
            state.isPointerDown = false
            state.activePointerIdentifier = null
            const snapshot = buildSnapshotFromCanvas()
            state.currentSnapshot = snapshot
            pushHistorySnapshot(snapshot)
            state.onSnapshotChange(snapshot)
        }

        const bindCanvasEvents = () => {
            if (!state.canvasElement) return
            state.canvasElement.onpointerdown = startStroke
            state.canvasElement.onpointermove = continueStroke
            state.canvasElement.onpointerup = finishStroke
            state.canvasElement.onpointercancel = finishStroke
            state.canvasElement.onpointerleave = () => hidePointerPreview()
            if (!state.pointerMovePreviewHandler) {
                state.pointerMovePreviewHandler = (pointerEvent) => movePointerPreview(pointerEvent)
            }
            state.canvasElement.removeEventListener("pointermove", state.pointerMovePreviewHandler)
            state.canvasElement.addEventListener("pointermove", state.pointerMovePreviewHandler)
        }

        const reconnectObservers = (previousScrollElement) => {
            if (state.resizeObserver) state.resizeObserver.disconnect()
            if (state.mutationObserver) state.mutationObserver.disconnect()
            if (state.scrollSyncHandler && previousScrollElement) previousScrollElement.removeEventListener("scroll", state.scrollSyncHandler)
            state.resizeObserver = null
            state.mutationObserver = null
            if (!state.pageElement) return
            if (typeof ResizeObserver !== "undefined") {
                state.resizeObserver = new ResizeObserver(() => scheduleLayoutSync())
                state.resizeObserver.observe(state.pageElement)
            }
            state.mutationObserver = new MutationObserver(() => scheduleLayoutSync())
            state.mutationObserver.observe(state.pageElement, { childList: true, subtree: true, characterData: true })
            state.scrollSyncHandler = () => scheduleScrollSync()
            state.scrollElement?.addEventListener("scroll", state.scrollSyncHandler, { passive: true })
        }

        return {
            setHostElements(containerElement, pageElement, scrollElement) {
                const previousScrollElement = state.scrollElement
                state.containerElement = containerElement || null
                state.pageElement = pageElement || null
                state.scrollElement = scrollElement || containerElement || null
                ensureCanvasElement()
                ensurePointerPreviewElement()
                reconnectObservers(previousScrollElement)
                scheduleLayoutSync()
                setInteractionState()
                applyStrokeStyle()
            },
            setEnabled(enabled) {
                state.enabled = !!enabled
                if (!state.enabled) {
                    state.isPointerDown = false
                    state.activePointerIdentifier = null
                    hidePointerPreview()
                }
                setInteractionState()
            },
            setTool(tool) {
                if (!supportedTools.has(tool)) return
                state.currentTool = tool
                applyStrokeStyle()
            },
            setColor(color) {
                if (!color) return
                state.currentColor = color
                applyStrokeStyle()
            },
            setSize(size) {
                const normalizedSize = Number.isFinite(size) ? Utils.clamp(size, 1, 28) : 3
                state.currentSize = normalizedSize
                applyStrokeStyle()
            },
            async setSnapshot(snapshot, options = {}) {
                scheduleLayoutSync()
                await new Promise(resolve => requestAnimationFrame(resolve))
                const normalizedSnapshot = typeof snapshot === "string" ? snapshot : ""
                await drawSnapshotOnCanvas(normalizedSnapshot)
                if (options.resetHistory) {
                    state.historyStack = [normalizedSnapshot]
                    state.redoStack = []
                }
                state.currentSnapshot = normalizedSnapshot
                hidePointerPreview()
            },
            getSnapshot() {
                return state.currentSnapshot
            },
            buildSnapshot() {
                return buildSnapshotFromCanvas()
            },
            async undo() {
                if (state.historyStack.length <= 1) return state.currentSnapshot
                const removedSnapshot = state.historyStack.pop()
                state.redoStack.push(removedSnapshot || "")
                const previousSnapshot = state.historyStack[state.historyStack.length - 1] || ""
                await drawSnapshotOnCanvas(previousSnapshot)
                state.currentSnapshot = previousSnapshot
                state.onSnapshotChange(previousSnapshot)
                return previousSnapshot
            },
            async redo() {
                if (!state.redoStack.length) return state.currentSnapshot
                const nextSnapshot = state.redoStack.pop() || ""
                state.historyStack.push(nextSnapshot)
                await drawSnapshotOnCanvas(nextSnapshot)
                state.currentSnapshot = nextSnapshot
                state.onSnapshotChange(nextSnapshot)
                return nextSnapshot
            },
            refreshLayout() {
                scheduleLayoutSync()
            },
            setSnapshotChangeHandler(handler) {
                state.onSnapshotChange = typeof handler === "function" ? handler : () => {}
            },
            hidePointerPreview() {
                hidePointerPreview()
            },
            getState() {
                return {
                    canvasElement: state.canvasElement,
                    canvasContext: state.canvasContext,
                    pointerPreviewElement: state.pointerPreviewElement,
                    isPointerDown: state.isPointerDown,
                    activePointerIdentifier: state.activePointerIdentifier
                }
            },
            async reset() {
                state.enabled = false
                setInteractionState()
                state.historyStack = [""]
                state.redoStack = []
                state.currentSnapshot = ""
                await drawSnapshotOnCanvas("")
                hidePointerPreview()
            }
        }
    }

    return { createEngine }
})()
