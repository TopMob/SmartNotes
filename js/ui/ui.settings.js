(() => {
  if (window.UISettings) return

  let bound = false

  const bind = () => {
    if (bound) return
    bound = true

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='open-settings']")
      if (!btn) return
      e.preventDefault()
      e.stopPropagation()
      if (window.UIModals) UIModals.open("settings-modal")
    })
  }

  window.UISettings = { bind }
})()
