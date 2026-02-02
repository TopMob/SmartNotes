;(() => {
  if (window.NoteTags) return

  const normalize = (tag) =>
    tag.trim().toLowerCase().replace(/\s+/g, "-")

  const addTag = (note, tag) => {
    const t = normalize(tag)
    if (!t) return
    if (!note.tags) note.tags = []
    if (!note.tags.includes(t)) note.tags.push(t)
  }

  const removeTag = (note, tag) => {
    if (!note.tags) return
    note.tags = note.tags.filter((t) => t !== tag)
  }

  window.NoteTags = { addTag, removeTag }
})()
