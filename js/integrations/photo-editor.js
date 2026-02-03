;(() => {
  if (window.PhotoEditor) return

  let canvas = null
  let ctx = null
  let drawing = false
  let history = []
  let onSave = null
  let baseImage = null
  let bound = false
  let resizeBound = false

  const ensureCanvas = () => {
    canvas = document.getElementById("photo-editor-canvas")
    if (!canvas) return null
    ctx = canvas.getContext("2d")
    ctx.lineCap = "round"
    return canvas
  }

  const resizeCanvas = () => {
    if (!canvas || !baseImage) return
    const rect = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    drawBase()
  }

  const drawBase = () => {
    if (!canvas || !baseImage) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const ratio = Math.min(canvas.width / baseImage.width, canvas.height / baseImage.height)
    const w = baseImage.width * ratio
    const h = baseImage.height * ratio
    const x = (canvas.width - w) / 2
    const y = (canvas.height - h) / 2
    ctx.drawImage(baseImage, x, y, w, h)
  }

  const snapshot = () => {
    if (!canvas) return
    history.push(canvas.toDataURL("image/png"))
    if (history.length > 30) history.shift()
  }

  const redraw = () => {
    if (!history.length) {
      drawBase()
      return
    }
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = history[history.length - 1]
  }

  const applyStyle = () => {
    const colorPicker = document.getElementById("photo-color-picker")
    const widthPicker = document.getElementById("photo-width-picker")
    if (colorPicker) ctx.strokeStyle = colorPicker.value
    if (widthPicker) ctx.lineWidth = parseInt(widthPicker.value, 10) || 3
  }

  const bind = () => {
    if (!canvas) return
    if (bound) return
    bound = true
    canvas.addEventListener("pointerdown", (e) => {
      drawing = true
      ctx.beginPath()
      ctx.moveTo(e.offsetX, e.offsetY)
      snapshot()
    })

    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return
      ctx.lineTo(e.offsetX, e.offsetY)
      ctx.stroke()
    })

    document.addEventListener("pointerup", () => drawing = false)
  }

  const open = (src, onSaveCallback) => {
    if (!src) return
    if (window.UIModals) UIModals.open("photo-editor-modal")
    ensureCanvas()
    history = []
    onSave = onSaveCallback
    baseImage = new Image()
    baseImage.onload = () => {
      resizeCanvas()
      applyStyle()
      bind()
    }
    baseImage.src = src
    if (!resizeBound) {
      window.addEventListener("resize", resizeCanvas)
      resizeBound = true
    }
  }

  const undo = () => {
    if (!history.length) return
    history.pop()
    redraw()
  }

  const clear = () => {
    history = []
    drawBase()
  }

  const save = () => {
    if (!canvas) return
    const data = canvas.toDataURL("image/png")
    if (onSave) onSave(data)
    if (window.UIModals) UIModals.close("photo-editor-modal")
  }

  document.addEventListener("input", (e) => {
    if (e.target?.id === "photo-color-picker" || e.target?.id === "photo-width-picker") {
      applyStyle()
    }
  })

  window.PhotoEditor = { open, undo, clear, save }
})()
