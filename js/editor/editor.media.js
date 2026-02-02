;(() => {
  if (window.EditorMedia) return

  const isMedia = (el) => el && el.closest && el.closest(".media-wrapper")

  const bind = () => {
    document.addEventListener("mousedown", (e) => {
      if (isMedia(e.target)) {
        e.preventDefault()
        e.stopPropagation()
      }
    })
  }

  window.EditorMedia = { bind }
})()
