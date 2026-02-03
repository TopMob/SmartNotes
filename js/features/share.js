;(() => {
  if (window.NoteShare) return

  const encode = (data) => btoa(unescape(encodeURIComponent(JSON.stringify(data))))
  const decode = (value) => JSON.parse(decodeURIComponent(escape(atob(value))))

  const createLink = (note) => {
    const payload = {
      id: note.id,
      title: note.title || "",
      content: note.content || "",
      tags: Array.isArray(note.tags) ? note.tags : [],
      owner: state.user?.uid,
      t: Date.now()
    }
    return `${location.origin}${location.pathname}?share=${encode(payload)}`
  }

  const readLink = () => {
    const q = new URLSearchParams(location.search)
    if (!q.has("share")) return null
    try {
      return decode(q.get("share"))
    } catch {
      return null
    }
  }

  window.NoteShare = { createLink, readLink }
})()
