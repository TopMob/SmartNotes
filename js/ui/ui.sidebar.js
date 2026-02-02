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
      if (a === "view-notes") state.view = "notes"
      if (a === "view-favorites") state.view = "favorites"
      if (a === "view-archive") state.view = "archive"
      if (a === "view-folders") state.view = "folders"

      if (a === "open-settings" && window.UIModals) UIModals.open("settings-modal")
      if (a === "logout" && window.Auth) Auth.logout()
      if (a === "switch-account" && window.Auth) Auth.switchAccount()

      if (window.UI) UI.render()
    })
  }

  window.UISidebar = { bind }
})()
