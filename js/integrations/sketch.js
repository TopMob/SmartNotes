;(() => {
  if (window.SketchService) return

  let ctx = null
  let drawing = false

  const init = (canvas) => {
    ctx = canvas.getContext("2d")
    ctx.lineCap = "round"
  }

  const bind = (canvas) => {
    canvas.addEventListener("pointerdown", (e) => {
      drawing = true
      ctx.beginPath()
      ctx.moveTo(e.offsetX, e.offsetY)
    })

    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return
      ctx.lineTo(e.offsetX, e.offsetY)
      ctx.stroke()
    })

    document.addEventListener("pointerup", () => drawing = false)
  }

  window.SketchService = { init, bind }
})()
