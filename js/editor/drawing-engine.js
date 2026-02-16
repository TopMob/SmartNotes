const DrawingSurfaceEngine = (() => {
    const createState = () => ({
        canvasElement: null,
        canvasContext: null,
        hostElement: null,
        pageElement: null,
        scrollElement: null,
        isActive: false,
        isPointerDown: false,
        pointerIdentifier: null,
        pointerPreviewElement: null,
        pixelRatio: 1,
        activeTool: "pen",
        activeColor: "#111111",
        activeSize: 3,
        historyStack: [""],
        redoStack: [],
        currentSnapshot: "",
        layoutFrame: 0,
        scrollFrame: 0,
        resizeObserver: null,
        mutationObserver: null,
        loadToken: 0,
        onSnapshotChange: () => {},
        canvasEventsBound: false,
        handleScroll: null
    })

    const buildStrokeStyle = (tool, color, size) => {
        if (tool === "eraser") {
            return {
                compositeOperation: "destination-out",
                color: "#000000",
                alpha: 1,
                width: Math.max(12, size * 2.2)
            }
        }
        if (tool === "marker") {
            return {
                compositeOperation: "source-over",
                color,
                alpha: 0.35,
                width: Math.max(6, size * 2.1)
            }
        }
        return {
            compositeOperation: "source-over",
            color,
            alpha: 1,
            width: Math.max(1, size)
        }
    }

    const getCanvasPoint = (state, pointerEvent) => {
        if (!state.canvasElement) return null
        const canvasRect = state.canvasElement.getBoundingClientRect()
        if (!canvasRect.width || !canvasRect.height) return null
        const localX = Utils.clamp(pointerEvent.clientX - canvasRect.left, 0, canvasRect.width)
        const localY = Utils.clamp(pointerEvent.clientY - canvasRect.top, 0, canvasRect.height)
        return { x: localX, y: localY }
    }

    const ensureCanvas = (state) => {
        if (state.canvasElement || !state.hostElement) return state.canvasElement
        const canvasElement = document.createElement("canvas")
        canvasElement.className = "note-drawing-canvas"
        canvasElement.setAttribute("aria-hidden", "true")
        canvasElement.tabIndex = -1
        canvasElement.style.pointerEvents = "none"
        state.hostElement.appendChild(canvasElement)
        state.canvasElement = canvasElement
        state.canvasContext = canvasElement.getContext("2d")
        return canvasElement
    }

    const ensurePointerPreview = (state) => {
        if (state.pointerPreviewElement) return
        const pointerPreviewElement = document.createElement("div")
        pointerPreviewElement.className = "drawing-pointer-preview"
        pointerPreviewElement.setAttribute("aria-hidden", "true")
        document.body.appendChild(pointerPreviewElement)
        state.pointerPreviewElement = pointerPreviewElement
    }

    const applyContextScale = (state) => {
        if (!state.canvasContext) return
        state.canvasContext.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0)
    }

    const syncCanvasPosition = (state) => {
        if (!state.canvasElement || !state.pageElement) return
        state.canvasElement.style.top = `${state.pageElement.offsetTop}px`
        state.canvasElement.style.left = `${state.pageElement.offsetLeft}px`
    }

    const syncCanvasLayout = (state) => {
        if (!state.canvasElement || !state.canvasContext || !state.pageElement) return
        const cssWidth = Math.max(1, Math.floor(state.pageElement.clientWidth))
        const cssHeight = Math.max(1, Math.floor(state.pageElement.scrollHeight))
        const nextPixelRatio = window.devicePixelRatio || 1
        const pixelWidth = Math.max(1, Math.floor(cssWidth * nextPixelRatio))
        const pixelHeight = Math.max(1, Math.floor(cssHeight * nextPixelRatio))
        const canvasChanged = state.canvasElement.width !== pixelWidth || state.canvasElement.height !== pixelHeight || state.pixelRatio !== nextPixelRatio

        if (canvasChanged) {
            const backupCanvas = document.createElement("canvas")
            backupCanvas.width = state.canvasElement.width
            backupCanvas.height = state.canvasElement.height
            const backupContext = backupCanvas.getContext("2d")
            if (backupContext && backupCanvas.width > 0 && backupCanvas.height > 0) {
                backupContext.drawImage(state.canvasElement, 0, 0)
            }
            state.canvasElement.width = pixelWidth
            state.canvasElement.height = pixelHeight
            state.pixelRatio = nextPixelRatio
            state.canvasElement.style.width = `${cssWidth}px`
            state.canvasElement.style.height = `${cssHeight}px`
            applyContextScale(state)
            if (backupCanvas.width > 0 && backupCanvas.height > 0) {
                state.canvasContext.setTransform(1, 0, 0, 1, 0, 0)
                state.canvasContext.drawImage(backupCanvas, 0, 0, backupCanvas.width, backupCanvas.height, 0, 0, pixelWidth, pixelHeight)
                applyContextScale(state)
            }
        } else {
            state.canvasElement.style.width = `${cssWidth}px`
            state.canvasElement.style.height = `${cssHeight}px`
        }
        syncCanvasPosition(state)
    }

    const scheduleLayoutSync = (state) => {
        if (state.layoutFrame) return
        state.layoutFrame = requestAnimationFrame(() => {
            state.layoutFrame = 0
            syncCanvasLayout(state)
        })
    }

    const scheduleScrollSync = (state) => {
        if (state.scrollFrame) return
        state.scrollFrame = requestAnimationFrame(() => {
            state.scrollFrame = 0
            syncCanvasPosition(state)
        })
    }

    const clearCanvas = (state) => {
        if (!state.canvasElement || !state.canvasContext) return
        state.canvasContext.setTransform(1, 0, 0, 1, 0, 0)
        state.canvasContext.clearRect(0, 0, state.canvasElement.width, state.canvasElement.height)
        applyContextScale(state)
    }

    const drawSnapshotToCanvas = (state, snapshot) => {
        const normalizedSnapshot = typeof snapshot === "string" ? snapshot : ""
        state.currentSnapshot = normalizedSnapshot
        state.loadToken += 1
        const currentLoadToken = state.loadToken
        if (!normalizedSnapshot) {
            clearCanvas(state)
            return Promise.resolve("")
        }
        return new Promise((resolve) => {
            const imageElement = new Image()
            imageElement.onload = () => {
                if (state.loadToken !== currentLoadToken || !state.canvasElement || !state.canvasContext) {
                    resolve(state.currentSnapshot)
                    return
                }
                state.canvasContext.setTransform(1, 0, 0, 1, 0, 0)
                state.canvasContext.clearRect(0, 0, state.canvasElement.width, state.canvasElement.height)
                state.canvasContext.drawImage(imageElement, 0, 0, state.canvasElement.width, state.canvasElement.height)
                applyContextScale(state)
                resolve(state.currentSnapshot)
            }
            imageElement.onerror = () => {
                if (state.loadToken === currentLoadToken) {
                    state.currentSnapshot = ""
                    clearCanvas(state)
                }
                resolve(state.currentSnapshot)
            }
            imageElement.src = normalizedSnapshot
        })
    }

    const updatePointerPreview = (state, pointerEvent) => {
        if (!state.pointerPreviewElement || !state.canvasElement || !state.isActive) return
        const point = getCanvasPoint(state, pointerEvent)
        if (!point) return
        const canvasRect = state.canvasElement.getBoundingClientRect()
        state.pointerPreviewElement.style.transform = `translate(${canvasRect.left + point.x}px, ${canvasRect.top + point.y}px) translate(-50%, -50%)`
        state.pointerPreviewElement.style.opacity = "1"
    }

    const hidePointerPreview = (state) => {
        if (!state.pointerPreviewElement) return
        state.pointerPreviewElement.style.opacity = "0"
    }

    const updatePointerPreviewStyle = (state) => {
        if (!state.pointerPreviewElement) return
        const strokeStyle = buildStrokeStyle(state.activeTool, state.activeColor, state.activeSize)
        state.pointerPreviewElement.style.width = `${strokeStyle.width}px`
        state.pointerPreviewElement.style.height = `${strokeStyle.width}px`
        if (state.activeTool === "eraser") {
            state.pointerPreviewElement.style.borderColor = "rgba(248, 113, 113, 0.9)"
            state.pointerPreviewElement.style.background = "rgba(248, 113, 113, 0.22)"
            return
        }
        if (state.activeTool === "marker") {
            state.pointerPreviewElement.style.borderColor = "rgba(37, 99, 235, 0.9)"
            state.pointerPreviewElement.style.background = "rgba(37, 99, 235, 0.18)"
            return
        }
        state.pointerPreviewElement.style.borderColor = "rgba(59, 130, 246, 0.9)"
        state.pointerPreviewElement.style.background = "rgba(59, 130, 246, 0.16)"
    }

    const buildExportSnapshot = (state) => {
        if (!state.canvasElement || !state.canvasContext) return ""
        const sourceWidth = state.canvasElement.width
        const sourceHeight = state.canvasElement.height
        if (!sourceWidth || !sourceHeight) return ""
        const pixelData = state.canvasContext.getImageData(0, 0, sourceWidth, sourceHeight).data
        let minX = sourceWidth
        let minY = sourceHeight
        let maxX = -1
        let maxY = -1

        for (let pixelIndex = 3, pointIndex = 0; pixelIndex < pixelData.length; pixelIndex += 4, pointIndex += 1) {
            if (pixelData[pixelIndex] === 0) continue
            const x = pointIndex % sourceWidth
            const y = Math.floor(pointIndex / sourceWidth)
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
        }

        if (maxX < minX || maxY < minY) return ""

        const padding = Math.ceil(Math.max(4, state.activeSize * 2))
        const cropX = Math.max(0, minX - padding)
        const cropY = Math.max(0, minY - padding)
        const cropWidth = Math.min(sourceWidth - cropX, maxX - minX + 1 + padding * 2)
        const cropHeight = Math.min(sourceHeight - cropY, maxY - minY + 1 + padding * 2)

        const exportCanvas = document.createElement("canvas")
        exportCanvas.width = Math.max(1, cropWidth)
        exportCanvas.height = Math.max(1, cropHeight)
        const exportContext = exportCanvas.getContext("2d")
        if (!exportContext) return ""

        exportContext.drawImage(state.canvasElement, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
        let snapshot = exportCanvas.toDataURL("image/webp", 0.8)
        if (!snapshot.startsWith("data:image/webp")) snapshot = exportCanvas.toDataURL("image/png")

        const maxLength = 200000
        let resizedCanvas = exportCanvas
        while (snapshot.length > maxLength && resizedCanvas.width > 300 && resizedCanvas.height > 300) {
            const nextCanvas = document.createElement("canvas")
            nextCanvas.width = Math.max(1, Math.floor(resizedCanvas.width * 0.88))
            nextCanvas.height = Math.max(1, Math.floor(resizedCanvas.height * 0.88))
            const nextContext = nextCanvas.getContext("2d")
            if (!nextContext) break
            nextContext.drawImage(resizedCanvas, 0, 0, resizedCanvas.width, resizedCanvas.height, 0, 0, nextCanvas.width, nextCanvas.height)
            resizedCanvas = nextCanvas
            snapshot = resizedCanvas.toDataURL("image/webp", 0.8)
            if (!snapshot.startsWith("data:image/webp")) snapshot = resizedCanvas.toDataURL("image/png")
        }
        return snapshot
    }

    const pushHistorySnapshot = (state, snapshot) => {
        const normalizedSnapshot = typeof snapshot === "string" ? snapshot : ""
        const previousSnapshot = state.historyStack[state.historyStack.length - 1] || ""
        if (previousSnapshot === normalizedSnapshot) return
        state.historyStack.push(normalizedSnapshot)
        if (state.historyStack.length > 120) state.historyStack.shift()
        state.redoStack = []
    }

    const attachObservers = (state) => {
        if (!state.pageElement) return
        if (state.resizeObserver) state.resizeObserver.disconnect()
        if (state.mutationObserver) state.mutationObserver.disconnect()
        state.scrollElement?.removeEventListener("scroll", state.handleScroll)

        if (typeof ResizeObserver !== "undefined") {
            state.resizeObserver = new ResizeObserver(() => scheduleLayoutSync(state))
            state.resizeObserver.observe(state.pageElement)
        }

        state.mutationObserver = new MutationObserver(() => scheduleLayoutSync(state))
        state.mutationObserver.observe(state.pageElement, { childList: true, subtree: true, characterData: true })

        if (!state.handleScroll) {
            state.handleScroll = () => scheduleScrollSync(state)
        }
        state.scrollElement?.addEventListener("scroll", state.handleScroll, { passive: true })
    }

    const detachObservers = (state) => {
        if (state.resizeObserver) state.resizeObserver.disconnect()
        if (state.mutationObserver) state.mutationObserver.disconnect()
        state.resizeObserver = null
        state.mutationObserver = null
        if (state.handleScroll) state.scrollElement?.removeEventListener("scroll", state.handleScroll)
    }

    const createEngine = () => {
        const state = createState()

        const applyInteractionState = () => {
            if (state.canvasElement) {
                state.canvasElement.style.pointerEvents = state.isActive ? "auto" : "none"
            }
            if (!state.scrollElement) return
            state.scrollElement.style.overflow = state.isActive ? "hidden" : ""
            state.scrollElement.style.touchAction = state.isActive ? "none" : ""
        }

        const applyStrokeStyle = () => {
            if (!state.canvasContext) return
            const strokeStyle = buildStrokeStyle(state.activeTool, state.activeColor, state.activeSize)
            state.canvasContext.globalCompositeOperation = strokeStyle.compositeOperation
            state.canvasContext.strokeStyle = strokeStyle.color
            state.canvasContext.globalAlpha = strokeStyle.alpha
            state.canvasContext.lineWidth = strokeStyle.width
            state.canvasContext.lineCap = "round"
            state.canvasContext.lineJoin = "round"
            updatePointerPreviewStyle(state)
        }

        const startStroke = (pointerEvent) => {
            if (!state.isActive || !state.canvasContext) return
            pointerEvent.preventDefault()
            state.canvasElement?.setPointerCapture?.(pointerEvent.pointerId)
            const point = getCanvasPoint(state, pointerEvent)
            if (!point) return
            state.isPointerDown = true
            state.pointerIdentifier = pointerEvent.pointerId
            applyStrokeStyle()
            state.canvasContext.beginPath()
            state.canvasContext.moveTo(point.x, point.y)
            updatePointerPreview(state, pointerEvent)
        }

        const continueStroke = (pointerEvent) => {
            if (!state.isPointerDown || !state.canvasContext) return
            if (state.pointerIdentifier !== pointerEvent.pointerId) return
            pointerEvent.preventDefault()
            const events = typeof pointerEvent.getCoalescedEvents === "function" ? pointerEvent.getCoalescedEvents() : [pointerEvent]
            events.forEach((eventItem) => {
                const point = getCanvasPoint(state, eventItem)
                if (!point) return
                state.canvasContext.lineTo(point.x, point.y)
            })
            state.canvasContext.stroke()
            updatePointerPreview(state, pointerEvent)
        }

        const finishStroke = (pointerEvent) => {
            if (!state.isPointerDown || !state.canvasContext) return
            if (pointerEvent && state.pointerIdentifier !== pointerEvent.pointerId) return
            pointerEvent?.preventDefault()
            state.isPointerDown = false
            state.pointerIdentifier = null
            const snapshot = buildExportSnapshot(state)
            state.currentSnapshot = snapshot
            pushHistorySnapshot(state, snapshot)
            state.onSnapshotChange(snapshot)
        }

        const setHost = (hostElement, pageElement, scrollElement) => {
            state.hostElement = hostElement || null
            state.pageElement = pageElement || null
            state.scrollElement = scrollElement || hostElement || null
            ensureCanvas(state)
            bindCanvasEvents()
            ensurePointerPreview(state)
            attachObservers(state)
            scheduleLayoutSync(state)
            applyInteractionState()
            applyStrokeStyle()
        }

        const bindCanvasEvents = () => {
            ensureCanvas(state)
            if (!state.canvasElement || state.canvasEventsBound) return
            state.canvasElement.addEventListener("pointerdown", startStroke)
            state.canvasElement.addEventListener("pointermove", continueStroke)
            state.canvasElement.addEventListener("pointermove", (pointerEvent) => updatePointerPreview(state, pointerEvent))
            state.canvasElement.addEventListener("pointerup", finishStroke)
            state.canvasElement.addEventListener("pointercancel", finishStroke)
            state.canvasElement.addEventListener("pointerleave", () => hidePointerPreview(state))
            state.canvasEventsBound = true
        }

        const setSnapshot = async (snapshot, options = {}) => {
            const normalizedSnapshot = typeof snapshot === "string" ? snapshot : ""
            scheduleLayoutSync(state)
            await new Promise(resolve => requestAnimationFrame(resolve))
            await drawSnapshotToCanvas(state, normalizedSnapshot)
            if (options.resetHistory) {
                state.historyStack = [normalizedSnapshot]
                state.redoStack = []
            }
            state.currentSnapshot = normalizedSnapshot
        }

        const undoStroke = async () => {
            if (state.historyStack.length <= 1) return state.currentSnapshot
            const removedSnapshot = state.historyStack.pop()
            state.redoStack.push(removedSnapshot || "")
            const previousSnapshot = state.historyStack[state.historyStack.length - 1] || ""
            await drawSnapshotToCanvas(state, previousSnapshot)
            state.currentSnapshot = previousSnapshot
            state.onSnapshotChange(previousSnapshot)
            return previousSnapshot
        }

        const redoStroke = async () => {
            if (!state.redoStack.length) return state.currentSnapshot
            const nextSnapshot = state.redoStack.pop() || ""
            state.historyStack.push(nextSnapshot)
            await drawSnapshotToCanvas(state, nextSnapshot)
            state.currentSnapshot = nextSnapshot
            state.onSnapshotChange(nextSnapshot)
            return nextSnapshot
        }

        const destroy = () => {
            state.isActive = false
            state.isPointerDown = false
            state.pointerIdentifier = null
            applyInteractionState()
            hidePointerPreview(state)
            detachObservers(state)
            if (state.layoutFrame) cancelAnimationFrame(state.layoutFrame)
            if (state.scrollFrame) cancelAnimationFrame(state.scrollFrame)
            state.layoutFrame = 0
            state.scrollFrame = 0
            if (state.pointerPreviewElement) {
                state.pointerPreviewElement.remove()
                state.pointerPreviewElement = null
            }
            state.historyStack = [""]
            state.redoStack = []
            state.currentSnapshot = ""
            clearCanvas(state)
        }

        return {
            getState() {
                return state
            },
            setHost,
            setTool(tool) {
                state.activeTool = tool
                applyStrokeStyle()
            },
            setColor(color) {
                state.activeColor = color
                applyStrokeStyle()
            },
            setSize(size) {
                state.activeSize = size
                applyStrokeStyle()
            },
            setActive(active) {
                state.isActive = !!active
                if (!state.isActive) {
                    state.isPointerDown = false
                    state.pointerIdentifier = null
                    hidePointerPreview(state)
                }
                applyInteractionState()
            },
            setSnapshot,
            getSnapshot() {
                return state.currentSnapshot
            },
            buildSnapshot() {
                return buildExportSnapshot(state)
            },
            undoStroke,
            redoStroke,
            refreshLayout() {
                scheduleLayoutSync(state)
            },
            setSnapshotChangeHandler(handler) {
                state.onSnapshotChange = typeof handler === "function" ? handler : () => {}
            },
            updatePointerPreviewStyle() {
                updatePointerPreviewStyle(state)
            },
            hidePointerPreview() {
                hidePointerPreview(state)
            },
            destroy
        }
    }

    return { createEngine }
})()
