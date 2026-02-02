;(() => {
  if (window.AutoFolders) return

  const rules = [
    { name: "Работа", keys: ["проект", "задач", "дедлайн"] },
    { name: "Идеи", keys: ["идея", "мысль"] },
    { name: "Учёба", keys: ["лекция", "курс", "дз"] }
  ]

  const detect = (note) => {
    const text = `${note.title} ${Utils.stripHtml(note.content)}`.toLowerCase()
    return rules.find(r => r.keys.some(k => text.includes(k)))?.name || null
  }

  const apply = (note) => {
    if (note.folderId) return
    const name = detect(note)
    if (!name) return

    let folder = state.folders.find(f => f.name === name)
    if (!folder) {
      folder = { id: Utils.generateId(), name }
      state.folders.push(folder)
    }
    note.folderId = folder.id
  }

  window.AutoFolders = { apply }
})()
