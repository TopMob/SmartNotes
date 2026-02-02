;(() => {
  if (window.AppRuntime) return

  const safe = (fn) => {
    try { fn() } catch {}
  }

  const bindGlobalGuards = () => {
    document.addEventListener("click", (e) => {
      const inEditor = e.target.closest("#note-editor")
      const inModal = e.target.closest(".modal-layer")
      if (inModal) return
      if (inEditor) return
    })
  }

  const initUI = () => {
    safe(() => window.UI && UI.init && UI.init())
    safe(() => window.UIModals && 0)
    safe(() => window.UISettings && UISettings.bind && UISettings.bind())
    safe(() => window.UISidebar && UISidebar.bind && UISidebar.bind())
    safe(() => window.UINoteActions && UINoteActions.bind && UINoteActions.bind())
  }

  const initEditor = () => {
    safe(() => window.Editor && Editor.init && Editor.init())
    safe(() => window.EditorMedia && EditorMedia.bind && EditorMedia.bind())
  }

  const initIntegrations = () => {
    safe(() => window.DriveService && DriveService.init && DriveService.init())
  }

  const overrideLegacyHooks = () => {
    const noop = () => {}
    const legacy = [
      "openSettings",
      "toggleArchive",
      "toggleFavorite",
      "togglePin",
      "downloadNote",
      "uploadToDrive"
    ]
    legacy.forEach((k) => {
      if (window[k]) window[k] = noop
    })
  }

  const boot = () => {
    bindGlobalGuards()
    initEditor()
    initUI()
    initIntegrations()
    overrideLegacyHooks()
    safe(() => window.UI && UI.render && UI.render())
  }

  document.addEventListener("DOMContentLoaded", boot)

  window.AppRuntime = { boot }
})()
