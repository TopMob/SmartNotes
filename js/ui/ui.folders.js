;(() => {
  if (window.UIFolders) return

  const create = async () => {
    if (!window.UI?.prompt) return
    const name = (await UI.prompt("Название папки")).trim()
    if (!name) return
    const exists = state.folders.some((f) => f.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      if (window.UIToast) UIToast.show("Папка уже существует", "error")
      return
    }
    const folder = { id: Utils.generateId(), name }
    state.folders.push(folder)
    localStorage.setItem("smartnotes:data:v1", JSON.stringify({ notes: state.notes, folders: state.folders, config: state.config }))
    if (window.UI) UI.render()
  }

  window.UIFolders = { create }
})()
