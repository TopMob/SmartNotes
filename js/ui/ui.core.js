;(() => {
  if (window.UI) return

  const render = () => {
    if (typeof window.renderNotes === "function") {
      window.renderNotes()
    }
  }

  const toggleSidebar = (force) => {
    const sidebar = document.getElementById("sidebar")
    if (!sidebar) return
    const shouldOpen = typeof force === "boolean" ? force : !sidebar.classList.contains("active")
    sidebar.classList.toggle("active", shouldOpen)
  }

  const primaryAction = () => {
    if (window.Editor?.create) Editor.create()
  }

  const triggerImport = () => {
    const input = document.getElementById("note-import")
    if (input) input.click()
  }

  const toggleUserMenu = () => {
    const menu = document.getElementById("user-dropdown")
    if (!menu) return
    menu.classList.toggle("active")
  }

  const submitFeedback = () => {
    const note = document.getElementById("feedback-text")
    const text = String(note?.value || "").trim()
    const rating = window.state?.tempRating || 0
    if (!rating && !text) {
      if (window.UIToast) UIToast.show("Введите отзыв или выберите оценку", "error")
      return
    }
    if (window.UIToast) UIToast.show("Спасибо за отзыв!", "success")
    if (note) note.value = ""
    if (window.state) state.tempRating = 0
    document.querySelectorAll(".stars-row .star").forEach((star) => {
      star.textContent = "star_border"
    })
    if (window.UIModals) UIModals.close("rate-modal")
  }

  const onAuthReady = (user) => {
    const name = document.getElementById("user-name")
    const photo = document.getElementById("user-photo")
    if (name) name.textContent = user?.displayName || "Пользователь"
    if (photo) photo.src = user?.photoURL || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    if (window.App && typeof App.handleUserChange === "function") App.handleUserChange(user)
  }

  const showToast = (message, type = "default") => {
    if (window.UIToast) UIToast.show(message, type)
    else alert(message)
  }

  const init = () => {
    if (window.UISidebar) UISidebar.bind()
    if (window.UISettings) UISettings.bind()
    if (window.UINoteActions) UINoteActions.bind()

    document.addEventListener("click", (e) => {
      const menu = document.getElementById("user-dropdown")
      if (!menu) return
      const inMenu = e.target.closest("#user-dropdown")
      const inAvatar = e.target.closest("#user-photo")
      if (!inMenu && !inAvatar) menu.classList.remove("active")
    })

    const toggle = document.getElementById("toolbar-toggle")
    const toolbar = document.getElementById("editor-toolbar")
    if (toggle && toolbar) {
      toggle.addEventListener("click", () => {
        const hidden = toolbar.classList.toggle("is-hidden")
        toggle.setAttribute("aria-label", hidden ? "Показать панель инструментов" : "Скрыть панель инструментов")
        toggle.querySelector("i").textContent = hidden ? "expand_more" : "expand_less"
      })
    }

    document.querySelectorAll(".stars-row .star").forEach((star) => {
      star.addEventListener("click", () => {
        const val = parseInt(star.dataset.val, 10)
        if (!val || !window.state) return
        state.tempRating = val
        document.querySelectorAll(".stars-row .star").forEach((s) => {
          const v = parseInt(s.dataset.val, 10)
          s.textContent = v <= val ? "star" : "star_border"
        })
      })
    })
  }

  window.UI = { init, render, toggleSidebar, primaryAction, triggerImport, toggleUserMenu, submitFeedback, onAuthReady, showToast }
})()
