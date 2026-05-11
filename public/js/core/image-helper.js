window.ImageHelper = {
    optimizeImageDataUrl: (dataUrl, options = {}) => new Promise((resolve) => {
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
}
