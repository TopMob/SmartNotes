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
