;(() => {
  if (window.UIToast) return

  let container = null

  const ensure = () => {
    if (container) return
    container = document.getElementById("toast-container")
    if (!container) {
      container = document.createElement("div")
      container.className = "toast-container"
      document.body.appendChild(container)
    }
  }

  const show = (text, type = "default", timeout = 2500) => {
    ensure()
    const el = document.createElement("div")
    el.className = `toast ${type}`
    el.textContent = String(text)
    container.appendChild(el)
    requestAnimationFrame(() => el.classList.add("active"))
    setTimeout(() => {
      el.classList.remove("active")
      setTimeout(() => el.remove(), 300)
    }, timeout)
  }

  window.UIToast = { show }
})()
