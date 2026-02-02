(() => {
  if (window.UINoteActions) return

  let bound = false

  const bind = () => {
    if (bound) return
    bound = true

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-note-action]")
      if (!btn) return

      e.preventDefault()
      e.stopPropagation()

      const card = btn.closest(".note-card")
      const id = card?.dataset?.noteId
      if (!id) return

      const note = state.notes.find((n) => n.id === id)
      if (!note) return

      const a = btn.dataset.noteAction

      if (a === "archive") note.archived = !note.archived
      if (a === "download" && window.NoteExport) NoteExport.download(note)

      if (a === "cloud") {
        if (window.DriveService?.upload) DriveService.upload(note)
        else if (window.UIToast) UIToast.show("Drive недоступен", "error")
      }

      if (window.UI) UI.render()
    })
  }

  window.UINoteActions = { bind }
})()
