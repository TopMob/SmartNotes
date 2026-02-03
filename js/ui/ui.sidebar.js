(() => {
  if (window.UISidebar) return

  let bound = false

  const bind = () => {
    if (bound) return
    bound = true

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]")
      if (!btn) return

      e.preventDefault()
      e.stopPropagation()

      const a = btn.dataset.action

      if (a === "create-note" && window.Editor?.create) Editor.create()
      if (a === "create-folder" && window.UIFolders?.create) UIFolders.create()
      if (a === "view-notes" && window.switchView) return switchView("notes")
      if (a === "view-favorites" && window.switchView) return switchView("favorites")
      if (a === "view-archive" && window.switchView) return switchView("archive")
      if (a === "view-folders" && window.switchView) return switchView("folders")

      if (a === "open-settings" && window.UIModals) UIModals.open("settings-modal")
      if (a === "logout" && window.Auth) Auth.logout()
      if (a === "switch-account" && window.Auth) Auth.switchAccount()

      if (window.UI) UI.render()
    })
  }

  window.UISidebar = { bind }
})()
