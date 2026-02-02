;(() => {
  if (window.UI) return

  const render = () => {
    if (typeof window.renderNotes === "function") {
      window.renderNotes()
    }
  }

  const init = () => {
    if (window.UISidebar) UISidebar.bind()
    if (window.UISettings) UISettings.bind()
    if (window.UINoteActions) UINoteActions.bind()
  }

  window.UI = { init, render }
})()
