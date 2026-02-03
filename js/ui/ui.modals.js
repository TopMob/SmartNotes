(() => {
  if (window.UIModals) return

  const active = new Set()

  const open = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    el.style.display = "flex"
    requestAnimationFrame(() => el.classList.add("active"))
    active.add(el)
    document.documentElement.style.overflow = "hidden"
  }

  const close = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    el.classList.remove("active")
    setTimeout(() => (el.style.display = "none"), 200)
    active.delete(el)
    if (!active.size) document.documentElement.style.overflow = ""
  }

  document.addEventListener("click", (e) => {
    const layer = e.target.closest(".modal-overlay")
    if (layer && e.target === layer) close(layer.id)
  })

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return
    Array.from(active).forEach((m) => close(m.id))
  })

  window.UIModals = { open, close }
})()
