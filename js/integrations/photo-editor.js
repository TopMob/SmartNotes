;(() => {
  if (window.PhotoEditor) return

  let canvas = null
  let ctx = null
  let baseImage = null
  let drawing = false
  let history = []
  let onSaveCallback = null

  const resizeCanvas = () => {
    if (!canvas || !baseImage) return
    const rect = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    drawBase()
    redrawFromHistory()
  }

  const drawBase = () => {
    if (!ctx || !baseImage) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const ratio = Math.min(canvas.width / baseImage.width, canvas.height / baseImage.height)
    const w = baseImage.width * ratio
    const h = baseImage.height * ratio
    const x = (canvas.width - w) / 2
    const y = (canvas.height - h) / 2
    ctx.drawImage(baseImage, x, y, w, h)
  }

  const redrawFromHistory = () => {
    if (!ctx) return
    if (!history.length) return
    ctx.putImageData(history[history.length - 1], 0, 0)
  }

  const pushHistory = () => {
    if (!ctx) return
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    history.push(data)
    if (history.length > 30) history.shift()
  }

  const startDraw = (e) => {
    drawing = true
    ctx.beginPath()
    ctx.moveTo(e.offsetX, e.offsetY)
  }

  const moveDraw = (e) => {
    if (!drawing) return
    ctx.lineTo(e.offsetX, e.offsetY)
    ctx.stroke()
  }

  const endDraw = () => {
    if (!drawing) return
    drawing = false
    pushHistory()
  }

  const bind = () => {
    if (!canvas) return
    canvas.addEventListener("pointerdown", startDraw)
    canvas.addEventListener("pointermove", moveDraw)
    canvas.addEventListener("pointerup", endDraw)
    canvas.addEventListener("pointerleave", endDraw)
    window.addEventListener("resize", resizeCanvas)
  }

  const setBrush = (color, width) => {
    if (!ctx) return
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = "round"
  }

  const open = (src, onSave) => {
    canvas = document.getElementById("photo-editor-canvas")
    if (!canvas) return
    ctx = canvas.getContext("2d")
    history = []
    onSaveCallback = onSave
    baseImage = new Image()
    baseImage.onload = () => {
      resizeCanvas()
      pushHistory()
    }
    baseImage.src = src
    const color = document.getElementById("photo-color-picker")?.value || "#00f2ff"
    const width = parseInt(document.getElementById("photo-width-picker")?.value || "3", 10)
    setBrush(color, width)
    bind()
  }

  const undo = () => {
    if (history.length <= 1) return
    history.pop()
    drawBase()
    redrawFromHistory()
  }

  const clear = () => {
    history = []
    drawBase()
    pushHistory()
  }

  const save = () => {
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    if (onSaveCallback) onSaveCallback(dataUrl)
    if (window.UIModals) UIModals.close("photo-editor-modal")
  }

  window.PhotoEditor = {
    open,
    undo,
    clear,
    save,
    setBrush
  }
})()
