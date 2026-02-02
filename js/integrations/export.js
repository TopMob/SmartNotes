(() => {
  if (window.NoteExport) return

  const buildText = (note) => {
    const title = note.title || "Untitled"
    const tags = Array.isArray(note.tags) ? `\n\n#${note.tags.join(" #")}` : ""
    const content = Utils.stripHtml(note.content || "")
    return `${title}\n\n${content}${tags}`
  }

  const safeName = (name) => {
    const base = String(name || "note").trim() || "note"
    const cleaned = base.replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim()
    return (cleaned || "note").slice(0, 32)
  }

  const download = (note) => {
    const text = buildText(note)
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${safeName(note.title)}.txt`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(a.href)
      a.remove()
    }, 0)
  }

  window.NoteExport = { download }
})()
