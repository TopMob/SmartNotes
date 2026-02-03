;(() => {
  if (window.NoteShare) return

  const createLink = (note) => {
    const payload = {
      t: Date.now(),
      data: {
        title: note.title || "",
        content: note.content || "",
        tags: Array.isArray(note.tags) ? note.tags : []
      }
    }
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    return `${location.origin}${location.pathname}?share=${encoded}`
  }

  const readLink = () => {
    const q = new URLSearchParams(location.search)
    if (!q.has("share")) return null
    try {
      const raw = decodeURIComponent(escape(atob(q.get("share"))))
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  window.NoteShare = { createLink, readLink }
})()
